import json
import uuid
from datetime import datetime

from boto3.dynamodb.conditions import Key, Attr

# Parse the event object and extract relevant information.
# After extraction, validates the object for valid parameter combinations.
def parse_event(event):
    params = {
        'method': event['httpMethod'],
        'resource': event['resource'],
        'parameters': event.get('queryStringParameters')
    }
    return validate_params(params)

# Validate parameters before request is processed.
def validate_params(params):
    if('/verwerkingsacties' in params['resource'] and params['method'] != 'POST'):
        if(params['parameters'] == None):
            raise Exception("GET and PUT requests to /verwerkingsacties should have query parameters")
    return params

def filled_item(requestJSON, actieId, tijdstipRegistratie):
    return {
        'url': "https://verwerkingenlogging-bewerking-api.vng.cloud/api/v1/verwerkingsacties/" + actieId,
        'actieId': actieId,
        'actieNaam': requestJSON['actieNaam'],
        'handelingNaam': requestJSON['handelingNaam'],
        'verwerkingId': requestJSON['verwerkingId'],
        'verwerkingsactiviteitId': requestJSON['verwerkingsactiviteitId'],
        'verwerkingsactiviteitUrl': requestJSON['verwerkingsactiviteitUrl'],
        'vertrouwelijkheid': requestJSON['vertrouwelijkheid'],
        'bewaartermijn': requestJSON['bewaartermijn'],
        'uitvoerder': requestJSON['uitvoerder'],
        'systeem': requestJSON['systeem'],
        'gebruiker': requestJSON['gebruiker'],
        'gegevensbron': requestJSON['gegevensbron'],
        'soortAfnemerId': requestJSON['soortAfnemerId'],
        'afnemerId': requestJSON['afnemerId'],
        'verwerkingsactiviteitIdAfnemer': requestJSON['verwerkingsactiviteitIdAfnemer'],
        'verwerkingsactiviteitUrlAfnemer': requestJSON['verwerkingsactiviteitUrlAfnemer'],
        'verwerkingIdAfnemer': requestJSON['verwerkingIdAfnemer'],
        'tijdstip': requestJSON['tijdstip'],
        'tijdstipRegistratie': tijdstipRegistratie,
        'verwerkteObjecten': requestJSON['verwerkteObjecten'],
        'objecttypesoortObjectIdobjectId': requestJSON['verwerkteObjecten'][0]['objecttype'] + "_" + requestJSON['verwerkteObjecten'][0]['soortObjectId'] + "_" + requestJSON['verwerkteObjecten'][0]['objectId'],
    }

############################
## GET /verwerkingsacties ##
############################
def get_verwerkings_acties(event, table):
    # ONLY verwerkingsactiviteitId
    object_key = event['queryStringParameters']['objecttype'] + "_" + event['queryStringParameters']['soortObjectId'] + "_" + event['queryStringParameters']['objectId']
    
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
                IndexName='objecttypesoortObjectIdobjectId-index',
                KeyConditionExpression=Key('objecttypesoortObjectIdobjectId').eq(object_key),
                FilterExpression=attrs)
    else:
        response = table.query(
                IndexName='objecttypesoortObjectIdobjectId-index',
                KeyConditionExpression=Key('objecttypesoortObjectIdobjectId').eq(object_key))
        
    return {
        'statusCode': 200,
        'body': json.dumps(response),
        'headers': { "Content-Type": "application/json" },
    }

#############################
## POST /verwerkingsacties ##
#############################
def post_verwerkings_acties(event, table):
    if (event['httpMethod'] == 'POST' and event['resource'] == '/verwerkingsacties'):
        # Generate UUID for actieId.
        actieId = str(uuid.uuid1()) # V1 Timestamp
        
        # Generate timestamp for tijdstipRegistratie.
        tijdstipRegistratie = datetime.now().isoformat(timespec='seconds')
        
        requestJSON = json.loads(event['body'])
        item=filled_item(requestJSON, actieId, tijdstipRegistratie)
        
        table.put_item(
            Item=item
        )

        return {
            'statusCode': 201,
            'body': json.dumps(item),
            'headers': { "Content-Type": "application/json" }
        }

##############################
## PATCH /verwerkingsacties ##
##############################
def patch_verwerkings_acties(event, table):
    requestJSON = json.loads(event['body'])
    verwerkingen = table.query(
        IndexName='verwerkingId-index',
        KeyConditionExpression=Key('verwerkingId').eq(event['queryStringParameters']['verwerkingId'])
    )
    response = []
    for item in verwerkingen.get('Items'):
        if (requestJSON.get('vertrouwelijkheid') != None and requestJSON.get('bewaartermijn') == None):
            response.append(table.update_item(
                Key={ 
                    'actieId': item.get('actieId') 
                },
                UpdateExpression="SET vertrouwelijkheid= :var1",
                ExpressionAttributeValues={
                    ':var1': requestJSON['vertrouwelijkheid']
                }
            ))
        if (requestJSON.get('vertrouwelijkheid') == None and requestJSON.get('bewaartermijn') != None):
            response.append(table.update_item(
                Key={ 
                    'actieId': item.get('actieId') 
                },
                UpdateExpression="SET bewaartermijn= :var1",
                ExpressionAttributeValues={
                    ':var1': requestJSON['bewaartermijn']
                }
            ))
        if (requestJSON.get('vertrouwelijkheid') != None and requestJSON.get('bewaartermijn') != None):
            response.append(table.update_item(
                Key={ 
                    'actieId': item.get('actieId') 
                },
                UpdateExpression="SET vertrouwelijkheid= :var1, bewaartermijn= :var2",
                ExpressionAttributeValues={
                    ':var1': requestJSON['vertrouwelijkheid'],
                    ':var2': requestJSON['bewaartermijn']
                }
            ))
        
    if (response == []):
        return {
            'statusCode': 400,
            'body': 'verwerkingId not found!',
            'headers': { "Content-Type": "text/plain" },
            }
    else:
        return {
            'statusCode': 200,
            'body': json.dumps(response),
            'headers': { "Content-Type": "application/json" },
        }

######################################
## GET /verwerkingsacties/{actieId} ##
######################################
def get_verwerkingsacties_actieid(event, table):
    response = table.query(
            KeyConditionExpression=Key('actieId').eq(event['queryStringParameters']['actieId'])
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

######################################
## PUT /verwerkingsacties/{actieId} ##
######################################
def put_verwerkingsacties_actieid(event, table):
    requestJSON = json.loads(event['body'])
    actieId = event['queryStringParameters']['actieId']
    item = filled_item(requestJSON, actieId, "2024-04-05T14:36:42+01:00")

    table.put_item(
        Item=item
    )

    return {
        'statusCode': 200,
        'body': json.dumps(item),
        'headers': { "Content-Type": "application/json" }
    }

#########################################
## DELETE /verwerkingsacties/{actieId} ##
#########################################
def delete_verwerkingsacties_actieid(event, table):
    response = table.delete_item(
        Key={
            'actieId': event['queryStringParameters']['actieId'],
        }
    )

    return {
        'statusCode': 200,
        'body': json.dumps(response),
        'headers': { "Content-Type": "application/json" }
    }

# Store (backup) verwerking item in S3 Backup Bucket
def store_item_in_s3(item_json, bucket):
    path = datetime.now().isoformat(timespec='seconds') + "_" + json.loads(item_json)['actieId']
    data = bytes(item_json.encode('UTF-8'))
    bucket.put_object(
        ContentType='application/json',
        Key=path,
        Body=data,
    )

#Receives the event object and routes it to the correct function
def handle_request(event, table, bucket):
    params = parse_event(event)
    if(params['method'] == 'GET' and params['resource'] == '/verwerkingsacties'):
        return get_verwerkings_acties(event, table)

    if(params['method'] == 'POST' and params['resource'] == '/verwerkingsacties'):
        result = post_verwerkings_acties(event, table)
        store_item_in_s3(result['body'], bucket)
        return result

    if(params['method'] == 'PATCH' and params['resource'] =='/verwerkingsacties'):
        return patch_verwerkings_acties(event, table)

    if(params['method'] == 'GET' and params['resource'] == '/verwerkingsacties/{actieId}'):
        return get_verwerkingsacties_actieid(event, table)

    if(params['method'] == 'PUT' and params['resource'] == '/verwerkingsacties/{actieId}'):
        result = put_verwerkingsacties_actieid(event, table)
        store_item_in_s3(result['body'], bucket)
        return result

    if(params['method'] == 'DELETE' and params['resource'] == '/verwerkingsacties/{actieId}'):
        return delete_verwerkingsacties_actieid(event, table)

    # if no matches were found, handle this as a malformed request
    return {
            'statusCode': 400,
            'body': '400 Bad Request',
            'headers': { "Content-Type": "text/plain" }
    }