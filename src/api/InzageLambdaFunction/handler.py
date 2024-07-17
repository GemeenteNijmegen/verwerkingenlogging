import os
import json
from datetime import datetime
from Shared.helpers import hashHelper, logApiCall
from Shared.responses import badRequestResponse, notFoundResponse, successResponse
from boto3.dynamodb.conditions import Key, Attr

apiBaseUrl = os.getenv('API_BASE_URL', 'api.vwlog-prod.csp-nijmegen.nl')

# Receives the event object and routes it to the correct function
def handle_request(event, table):
    params = parse_event(event)

    if(params.get('method') == 'GET' and params.get('resource') == '/verwerkte-objecten'):
        logApiCall('GET', '/verwerkte-objecten')

        msg = get_verwerkings_acties(event, table)

        return {
            'statusCode': 200,
            'body': json.dumps(msg),
            'headers': { 
            "Content-Type": "application/json",
            }}

    if(params.get('method') == 'GET' and params.get('resource') =='/verwerkte-objecten/{verwerktObjectId}'):
        logApiCall('GET', '/verwerkte-objecten/\{verwerkteObjectId\}')

        msg = get_verwerkteobjecten_verwerktobjectid(event, table)

        return successResponse(msg)

    # if no matches were found, handle this as a malformed request
    return badRequestResponse()

# Get verwerkingsacties based on specific verwerkteObjectId
def get_verwerkteobjecten_verwerktobjectid(event, table):

    response = table.query(
            IndexName='verwerktObjectId-index',
            KeyConditionExpression=Key('verwerkteObjectId').eq(event.get('pathParameters').get('verwerktObjectId')))

    # Check if requested record is found. If not, the list of items is empty (0).
    if (len(response.get('Items')) == 0):
        return notFoundResponse()
    else:
        # Remove objectTypeSoortId and compositeSortKey from return message
        msg = response.get('Items')[0]
        msg.pop('objectTypeSoortId')
        msg.pop('compositeSortKey')

        return successResponse(msg)

# Get verwerkingsacties based on given filter parameters
def get_verwerkings_acties(event, table):
    hashedObjectId = event.get('queryStringParameters').get('objectId')
    object_key = event.get('queryStringParameters').get('objectType') + event.get(
        'queryStringParameters').get('soortObjectId') + hashedObjectId

    attrs = None
    if (event.get('queryStringParameters').get('beginDatum') != None or event.get('queryStringParameters').get('eindDatum') != None):
        attrs = Attr("tijdstip").between(event.get('queryStringParameters').get(
            'beginDatum'), event.get('queryStringParameters').get('eindDatum'))
    if (event['queryStringParameters'].get('verwerkingsactiviteitId') != None):
        if (attrs != None):
            attrs &= Attr("verwerkingsactiviteitId").eq(
                event.get('queryStringParameters').get('verwerkingsactiviteitId'))
        else:
            attrs = Attr("verwerkingsactiviteitId").eq(
                event.get('queryStringParameters').get('verwerkingsactiviteitId'))

    if (attrs != None):
        response = table.query(
            IndexName='objectTypeSoortId-index',
            KeyConditionExpression=Key('objectTypeSoortId').eq(object_key),
            FilterExpression=attrs)
    else:
        response = table.query(
            IndexName='objectTypeSoortId-index',
            KeyConditionExpression=Key('objectTypeSoortId').eq(object_key))

    # Remove objectTypeSoortId from return message
    for item in response['Items']:
        item.pop('objectTypeSoortId')

    return successResponse(response)


# Parse the event object and extract relevant information.
# After extraction, validates the object for valid parameter combinations.
def parse_event(event):
    params = {
        'method': event.get('httpMethod'),
        'resource': event.get('resource'),
        'parameters': event.get('queryStringParameters'),
        'pathParameters': event.get('pathParameters')
    }
    return validate_params(params)

# Validate parameters before request is processed.
def validate_params(params):
    if('/verwerkte-objecten' in params.get('resource') and params.get('pathParameters') == None):
        if(params.get('parameters') == None):
            raise Exception("GET requests to /verwerkte-objecten should have query parameters")

    if('/verwerkte-objecten/{verwerktObjectId}' in params.get('resource') and 'verwerktObjectId' not in params.get('parameters')):
            raise Exception("GET requests to /verwerkingsacties/{verwerktObjectId} should have (required) query parameters")

    return params
