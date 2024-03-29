from datetime import datetime
import os
from Shared.helpers import hashHelper, logApiCall
from Shared.responses import badRequestResponse, notFoundResponse, successResponse

from boto3.dynamodb.conditions import Key, Attr

debug = os.getenv('ENABLE_VERBOSE_AND_SENSITIVE_LOGGING', 'false') == 'true'

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

# Validate query parameters before request is processed.


def validate_params(params):
    if ('/verwerkingsacties' in params.get('resource') and params.get('method') == 'GET'):
        # GET /verwerkingsacties
        if (params.get('resouce') == '/verwerkingsacties'):
            if ('objectType' not in params.get('parameters') or 'soortObjectId' not in params.get('parameters') or 'objectId' not in params.get('parameters')):
                raise Exception(
                    "GET requests to /verwerkingsacties should have (required) query parameters")

    return params


def handle_request(event, table):
    params = parse_event(event)

    if (params['method'] == 'GET' and params.get('resource') == '/verwerkingsacties/{actieId}'):
        logApiCall(params['method'], params.get('resource'))
        return get_verwerkingsacties_actieid(event, table)

    if (params['method'] == 'GET' and params.get('resource') == '/verwerkingsacties'):
        logApiCall(params['method'], params.get('resource'))
        return get_verwerkings_acties(event, table)

    if (params['method'] == 'DELETE' and params.get('resource') == '/verwerkingsacties/{actieId}'):
        logApiCall(params['method'], params.get('resource'))
        return delete_verwerkingsacties_actieid(event, table)
    
    # Not a valid request
    return badRequestResponse()

# Get specific verwerkingsactie based on actieId
def get_verwerkingsacties_actieid(event, table):
    response = table.query(
        KeyConditionExpression=Key('actieId').eq(
            event.get('pathParameters').get('actieId'))
    )

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
    hashedObjectId = hashHelper(event.get('queryStringParameters').get('objectId'))
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
    if (event['queryStringParameters'].get('vertrouwelijkheid') != None):
        if (attrs != None):
            attrs &= Attr("vertrouwelijkheid").eq(
                event.get('queryStringParameters').get('vertrouwelijkheid'))
        else:
            attrs = Attr("vertrouwelijkheid").eq(
                event.get('queryStringParameters').get('vertrouwelijkheid'))

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

# Mark specific verwerkingsactie deleted based on actieId
def delete_verwerkingsacties_actieid(event, table):
    response = table.query(
        KeyConditionExpression=Key('actieId').eq(
            event.get('pathParameters').get('actieId'))
    )

    for item in response.get('Items'):
        if debug:
            print(item) # TODO alternative implementation as described below

    # TODO: Efficiency improvement --> another query not required. Data is already available using previous query.
    for item in response.get('Items'):
        response = table.query(
            KeyConditionExpression=Key('actieId').eq(
                item.get('actieId')) & Key('compositeSortKey').eq(item.get('compositeSortKey')),
            ScanIndexForward=False,  # descending order
            Limit=1  # top of list
        )

        # Get first (and only) item
        item = response.get('Items')[0]

        # Update tijdstipRegistratie and and vervallen flag
        item.update({
            'tijdstipRegistratie': datetime.now().isoformat(timespec='seconds'),
            'vervallen': True
        })

        table.put_item(
            Item=item
        )

    return successResponse()
