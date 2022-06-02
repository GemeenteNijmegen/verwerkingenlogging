import json
import uuid
from datetime import datetime

from boto3.dynamodb.conditions import Key, Attr


def parse_event(event):
    """Parse the event object and extract relevant information.
    After extraction, validates the object for valid parameter combinations.
    """
    params = {
        'method': event['httpMethod'],
        'resource': event['resource'],
        'parameters': event.get('queryStringParameters')
    }
    return validate_params(params)

def validate_params(params):
    if('/verwerkingsacties' in params['resource'] and params['method'] != 'POST'):
        if(params['parameters'] == None):
            raise Exception("GET and PUT requests to /verwerkingsacties should have query parameters")
    return params

def get_verwerkings_acties(event, table):
    ############################
    ## GET /verwerkingsacties ##
    ############################
    # ONLY verwerkingsactiviteitId
    object_key = event['queryStringParameters']['objecttype'] + "_" + event['queryStringParameters']['soortObjectId'] + "_" + event['queryStringParameters']['objectId']

    attrs = Attr("tijdstip").between(event['queryStringParameters']['beginDatum'], event['queryStringParameters']['eindDatum'])
    if (event['queryStringParameters'].get('verwerkingsactiviteitId') != None):
        attrs &= Attr("verwerkingsactiviteitId").eq(event['queryStringParameters'].get('verwerkingsactiviteitId'))
    if(event['queryStringParameters'].get('vertrouwelijkheid') != None):
        attrs &= Attr("vertrouwelijkheid").eq(event['queryStringParameters'].get('vertrouwelijkheid'))

    if (event['queryStringParameters'].get('verwerkingsactiviteitId') != None and event['queryStringParameters'].get('vertrouwelijkheid') == None):
        response = table.query(
            IndexName='objecttypesoortObjectIdobjectId-index',
            KeyConditionExpression=Key('objecttypesoortObjectIdobjectId').eq(object_key),
            FilterExpression=attrs)
    
    # ONLY vertrouwelijkheid
    if (event['queryStringParameters'].get('verwerkingsactiviteitId') == None and event['queryStringParameters'].get('vertrouwelijkheid') != None):
        response = table.query(
            IndexName='objecttypesoortObjectIdobjectId-index',
            KeyConditionExpression=Key('objecttypesoortObjectIdobjectId').eq(object_key),
            FilterExpression=attrs)
        
    # BOTH verwerkingsactiviteitId & vertrouwelijkheid
    if (event['queryStringParameters'].get('verwerkingsactiviteitId') != None and event['queryStringParameters'].get('vertrouwelijkheid') != None):
        response = table.query(
            IndexName='objecttypesoortObjectIdobjectId-index',
            KeyConditionExpression=Key('objecttypesoortObjectIdobjectId').eq(object_key),
            FilterExpression=attrs)
        
    # NONE verwerkingsactiviteitId & vertrouwelijkheid
    if (event['queryStringParameters'].get('verwerkingsactiviteitId') == None and event['queryStringParameters'].get('vertrouwelijkheid') == None):
        response = table.query(
            IndexName='objecttypesoortObjectIdobjectId-index',
            KeyConditionExpression=Key('objecttypesoortObjectIdobjectId').eq(object_key),
            FilterExpression=attrs)
        
    return {
        'statusCode': 200,
        'body': json.dumps(response),
        'headers': { "Content-Type": "application/json" },
    }

def post_verwerkings_acties(event, table):
    #############################
    ## POST /verwerkingsacties ##
    #############################
    
    if (event['httpMethod'] == 'POST' and event['resource'] == '/verwerkingsacties'):
        # Generate UUID for actieId.
        actieId = str(uuid.uuid1()) # V1 Timestamp
        
        # Generate timestamp for tijdstipRegistratie.
        tijdstipRegistratie = datetime.now().isoformat(timespec='seconds')
        
        requestJSON = json.loads(event['body'])
        item={
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
        
        response = table.put_item(
            Item=item
        )

        return {
            'statusCode': 201,
            'body': json.dumps(item),
            'headers': { "Content-Type": "application/json" }
        }

def patch_verwerkings_acties(event, table):
    ##############################
    ## PATCH /verwerkingsacties ##
    ##############################
    requestJSON = json.loads(event['body'])
    verwerkingen = table.query(
        IndexName='verwerkingId-index',
        KeyConditionExpression=Key('verwerkingId').eq(event['queryStringParameters']['verwerkingId'])
    )
    response = []
    for item in verwerkingen.get('Items'):
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
    return {
        'statusCode': 200,
        'body': json.dumps(response),
        'headers': { "Content-Type": "application/json" },
    }

def get_verwerkingsacties_actieid(event, table):
    ######################################
    ## GET /verwerkingsacties/{actieId} ##
    ######################################
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

def put_verwerkingsacties_actieid(event, table):
    ######################################
    ## PUT /verwerkingsacties/{actieId} ##
    ######################################
    requestJSON = json.loads(event['body'])
    item ={
            'url': "https://verwerkingenlogging-bewerking-api.vng.cloud/api/v1/verwerkingsacties/" + event['queryStringParameters']['actieId'],
            'actieId': event['queryStringParameters']['actieId'],
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
            'tijdstipRegistratie': "2024-04-05T14:36:42+01:00",
            'verwerkteObjecten': requestJSON['verwerkteObjecten'],
            'objecttypesoortObjectIdobjectId': requestJSON['verwerkteObjecten'][0]['objecttype'] + "_" + requestJSON['verwerkteObjecten'][0]['soortObjectId'] + "_" + requestJSON['verwerkteObjecten'][0]['objectId'],
        }
    response = table.put_item(
        Item=item
    )

    return {
        'statusCode': 200,
        'body': json.dumps(item),
        'headers': { "Content-Type": "application/json" }
    }

def store_item_in_s3(item_json, bucket):
    # Store (backup) verwerking item in S3 Backup Bucket
    path = datetime.now().isoformat(timespec='seconds') + "_" + json.loads(item_json)['actieId']
    data = bytes(item_json.encode('UTF-8'))
    bucket.put_object(
        ContentType='application/json',
        Key=path,
        Body=data,
    )

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
        
    # Validate if queryStringParameters exists
    boolQueryParam = True
    if (event.get('queryStringParameters') == None):
        boolQueryParam = False
    
    #########################################
    ## DELETE /verwerkingsacties/{actieId} ##
    #########################################
    
    if (event['httpMethod'] == 'DELETE' and event['resource'] == '/verwerkingsacties/{actieId}' and boolQueryParam):
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

    return {
            'statusCode': 400,
            'body': '400 Bad Request',
            'headers': { "Content-Type": "text/plain" }
    }