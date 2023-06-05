import json
from datetime import datetime

from boto3.dynamodb.conditions import Key, Attr

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
            if ('objecttype' not in params.get('parameters') or 'soortObjectId' not in params.get('parameters') or 'objectId' not in params.get('parameters')):
                raise Exception(
                    "GET requests to /verwerkingsacties should have (required) query parameters")

    return params


def handle_request(event, table):
    params = parse_event(event)

    if (params['method'] == 'GET' and params.get('resource') == '/verwerkingsacties/{actieId}'):
        return get_verwerkingsacties_actieid(event, table)

    if (params['method'] == 'GET' and params.get('resource') == '/verwerkingsacties'):
        return get_verwerkings_acties(event, table)

    if (params['method'] == 'DELETE' and params.get('resource') == '/verwerkingsacties/{actieId}'):
        return delete_verwerkingsacties_actieid(event, table)

# Get specific verwerkingsactie based on actieId


def get_verwerkingsacties_actieid(event, table):
    response = table.query(
        KeyConditionExpression=Key('actieId').eq(
            event.get('pathParameters').get('actieId'))
    )

    # Check if requested record is found. If not, the list of items is empty (0).
    if (len(response.get('Items')) == 0):
        return {
            'statusCode': 400,
            'body': 'Record not found',
            'headers': {"Content-Type": "text/plain"},
        }
    else:
        # Remove objectTypeSoortId from return message
        msg = response.get('Items')[0]
        msg.pop('objectTypeSoortId')

        return {
            'statusCode': 200,
            'body': json.dumps(msg),
            'headers': {"Content-Type": "application/json"},
        }

# Get verwerkingsacties based on given filter parameters


def get_verwerkings_acties(event, table):
    object_key = event.get('queryStringParameters').get('objecttype') + event.get(
        'queryStringParameters').get('soortObjectId') + event.get('queryStringParameters').get('objectId')

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

    return {
        'statusCode': 200,
        'body': json.dumps(response),
        'headers': {"Content-Type": "application/json"},
    }

# Mark specific verwerkingsactie deleted based on actieId
def delete_verwerkingsacties_actieid(event, table):
    response = table.query(
        KeyConditionExpression=Key('actieId').eq(
            event.get('pathParameters').get('actieId'))
    )

    # TODO: Efficiency improvement --> another query not required. Data is already available using previous query.
    for item in response.get('Items'):
        response = table.query(
            KeyConditionExpression=Key('actieId').eq(
                event.get('pathParameters').get('actieId')) and Key('compositeSortKey').eq(item.get('compositeSortKey')),
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

    return {'statusCode': 200}
