import json

from boto3.dynamodb.conditions import Key, Attr

def handle_request(event, table):
    return get_verwerkings_acties(event, table)

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