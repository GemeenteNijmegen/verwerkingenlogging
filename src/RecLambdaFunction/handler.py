import json

from boto3.dynamodb.conditions import Key, Attr

# Parse the event object and extract relevant information.
# After extraction, validates the object for valid parameter combinations.
def parse_event(event):
    params = {
        'method': event['httpMethod'],
        'resource': event['resource'],
        'parameters': event.get('queryStringParameters'),
        'pathParameters': event.get('pathParameters')
    }
    return validate_params(params)

# Validate parameters before request is processed.
def validate_params(params):
    if('/verwerkingsacties' in params['resource'] and params['method'] != 'POST' and params['pathParameters'] == None):
        if(params['parameters'] == None):
            raise Exception("GET and PUT requests to /verwerkingsacties should have query parameters")
    return params

def handle_request(event, table):
    params = parse_event(event)

    if(params['method'] == 'GET' and params['resource'] == '/verwerkingsacties/{actieId}'):
        return get_verwerkingsacties_actieid(event, table)

    if(params['method'] == 'GET' and params['resource'] == '/verwerkingsacties'):
        return get_verwerkings_acties(event, table)

    if(params['method'] == 'DELETE' and params['resource'] == '/verwerkingsacties/{actieId}'):
        return delete_verwerkingsacties_actieid(event, table)


def get_verwerkingsacties_actieid(event, table):
    response = table.query(
            KeyConditionExpression=Key('actieId').eq(event['pathParameters']['actieId'])
    )
    
    # Check if requested record is found. If not, the list of items is empty (0).
    if ( len(response.get('Items')) == 0 ):
        return {
            'statusCode': 400,
            'body': 'Record not found',
            'headers': { "Content-Type": "text/plain" },
        }
    else:
        return {
            'statusCode': 200,
            'body': json.dumps(response.get('Items')[0]),
            'headers': { "Content-Type": "application/json" },
        }

def get_verwerkings_acties(event, table):
    object_key = event['queryStringParameters']['objecttype'] + event['queryStringParameters']['soortObjectId'] + event['queryStringParameters']['objectId']
    
    attrs = None
    if (event['queryStringParameters'].get('beginDatum') != None or event['queryStringParameters'].get('eindDatum') != None):
        attrs = Attr("tijdstip").between(event['queryStringParameters'].get('beginDatum'), event['queryStringParameters'].get('eindDatum'))
    if (event['queryStringParameters'].get('verwerkingsactiviteitId') != None):
        if (attrs != None):
            attrs &= Attr("verwerkingsactiviteitId").eq(event['queryStringParameters'].get('verwerkingsactiviteitId'))
        else:
            attrs = Attr("verwerkingsactiviteitId").eq(event['queryStringParameters'].get('verwerkingsactiviteitId'))
    if(event['queryStringParameters'].get('vertrouwelijkheid') != None):
        if (attrs != None):
            attrs &= Attr("vertrouwelijkheid").eq(event['queryStringParameters'].get('vertrouwelijkheid'))
        else:
            attrs = Attr("vertrouwelijkheid").eq(event['queryStringParameters'].get('vertrouwelijkheid'))
    
    if (attrs != None):
        response = table.query(
                IndexName='objectTypeSoortId-index',
                KeyConditionExpression=Key('objectTypeSoortId').eq(object_key),
                FilterExpression=attrs)
    else:
        response = table.query(
                IndexName='objectTypeSoortId-index',
                KeyConditionExpression=Key('objectTypeSoortId').eq(object_key))
        
    return {
        'statusCode': 200,
        'body': json.dumps(response),
        'headers': { "Content-Type": "application/json" },
    }

def delete_verwerkingsacties_actieid(event, table):
    response = table.query(
            KeyConditionExpression=Key('actieId').eq(event['pathParameters']['actieId'])
    )

    deletedResponses = {}

    for item in response.get('Items'):
        deleteResponse = table.delete_item(
            Key={
                'actieId': item.get('actieId'),
                'objectTypeSoortId': item.get('objectTypeSoortId')
            },
            ReturnValues= "ALL_OLD"
        )
        deletedResponses.append(deleteResponse)

    return {
        'statusCode': 200,
        'body': json.dumps(deletedResponses),
        'headers': { "Content-Type": "application/json" }
    }