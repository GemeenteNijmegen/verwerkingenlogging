import json
import boto3
import uuid
import os
from datetime import datetime
from boto3.dynamodb.conditions import Key, Attr

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['DYNAMO_TABLE_NAME'])

def handler(event, context):
    
    print(event)
    
    ############################
    ## GET /verwerkingsacties ##
    ############################
    
    if (event['httpMethod'] == 'GET' and event['resource'] == '/verwerkingsacties'):

        # ONLY verwerkingsactiviteitId
        if (event['queryStringParameters'].get('verwerkingsactiviteitId') != None and event['queryStringParameters'].get('vertrouwelijkheid') == None):
            response = table.query(
                IndexName='objecttypesoortObjectIdobjectId-index',
                KeyConditionExpression=Key('objecttypesoortObjectIdobjectId').eq(event['queryStringParameters']['objecttype'] + "_" + event['queryStringParameters']['soortObjectId'] + "_" + event['queryStringParameters']['objectId']),
                FilterExpression=Attr("verwerkingsactiviteitId").eq(event['queryStringParameters'].get('verwerkingsactiviteitId')) & Attr("tijdstip").between(event['queryStringParameters']['beginDatum'], event['queryStringParameters']['eindDatum'])
            )
        
        # ONLY vertrouwelijkheid
        if (event['queryStringParameters'].get('verwerkingsactiviteitId') == None and event['queryStringParameters'].get('vertrouwelijkheid') != None):
            response = table.query(
                IndexName='objecttypesoortObjectIdobjectId-index',
                KeyConditionExpression=Key('objecttypesoortObjectIdobjectId').eq(event['queryStringParameters']['objecttype'] + "_" + event['queryStringParameters']['soortObjectId'] + "_" + event['queryStringParameters']['objectId']),
                FilterExpression=Attr("vertrouwelijkheid").eq(event['queryStringParameters'].get('vertrouwelijkheid')) & Attr("tijdstip").between(event['queryStringParameters']['beginDatum'], event['queryStringParameters']['eindDatum'])
            )
            
        # BOTH verwerkingsactiviteitId & vertrouwelijkheid
        if (event['queryStringParameters'].get('verwerkingsactiviteitId') != None and event['queryStringParameters'].get('vertrouwelijkheid') != None):
            response = table.query(
                IndexName='objecttypesoortObjectIdobjectId-index',
                KeyConditionExpression=Key('objecttypesoortObjectIdobjectId').eq(event['queryStringParameters']['objecttype'] + "_" + event['queryStringParameters']['soortObjectId'] + "_" + event['queryStringParameters']['objectId']),
                FilterExpression=Attr("vertrouwelijkheid").eq(event['queryStringParameters'].get('vertrouwelijkheid')) & Attr("verwerkingsactiviteitId").eq(event['queryStringParameters'].get('verwerkingsactiviteitId')) & Attr("tijdstip").between(event['queryStringParameters']['beginDatum'], event['queryStringParameters']['eindDatum'])
            )
            
        # NONE verwerkingsactiviteitId & vertrouwelijkheid
        if (event['queryStringParameters'].get('verwerkingsactiviteitId') == None and event['queryStringParameters'].get('vertrouwelijkheid') == None):
            response = table.query(
                IndexName='objecttypesoortObjectIdobjectId-index',
                KeyConditionExpression=Key('objecttypesoortObjectIdobjectId').eq(event['queryStringParameters']['objecttype'] + "_" + event['queryStringParameters']['soortObjectId'] + "_" + event['queryStringParameters']['objectId']),
                FilterExpression=Attr("tijdstip").between(event['queryStringParameters']['beginDatum'], event['queryStringParameters']['eindDatum'])
            )
        
        return {
            'statusCode': 200,
            'body': json.dumps(response),
            'headers': { "Content-Type": "application/json" },
        }
        
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
        
        print(requestJSON['verwerkteObjecten'])
        response = table.put_item(
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
    
    if (event['httpMethod'] == 'PATCH' and event['resource'] == '/verwerkingsacties'):
        requestJSON = json.loads(event['body'])
        verwerkingen = table.query(
            IndexName='verwerkingId-index',
            KeyConditionExpression=Key('verwerkingId').eq(event['queryStringParameters']['verwerkingId'])
        )
        
        for item in verwerkingen.get('Items'):
            print(item.get('actieId'))
            response = table.update_item(
                Key={ 
                    'actieId': item.get('actieId') 
                },
                UpdateExpression="SET vertrouwelijkheid= :var1, bewaartermijn= :var2",
                ExpressionAttributeValues={
                    ':var1': requestJSON['vertrouwelijkheid'],
                    ':var2': requestJSON['bewaartermijn']
                }
            )

        return {
            'statusCode': 200,
            'body': json.dumps(response),
            'headers': { "Content-Type": "application/json" },
        }
        
    ######################################
    ## GET /verwerkingsacties/{actieId} ##
    ######################################
        
    if (event['httpMethod'] == 'GET' and event['resource'] == '/verwerkingsacties/{actieId}'):
        response = table.query(
            KeyConditionExpression=Key('actieId').eq(event['queryStringParameters']['actieId'])
        )

        return {
            'statusCode': 200,
            'body': json.dumps(response.get('Items')[0]),
            'headers': { "Content-Type": "application/json" },
        }
        
    ######################################
    ## PUT /verwerkingsacties/{actieId} ##
    ######################################
        
    if (event['httpMethod'] == 'PUT' and event['resource'] == '/verwerkingsacties/{actieId}'):
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
    
    #########################################
    ## DELETE /verwerkingsacties/{actieId} ##
    #########################################
    
    if (event['httpMethod'] == 'DELETE' and event['resource'] == '/verwerkingsacties/{actieId}'):
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