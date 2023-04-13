import json
import uuid
from datetime import datetime

from boto3.dynamodb.conditions import Key

# Receives and processes the message. 
# Trying to insert the message into the DynamoDB database.
def process_message(event, table):
    records = event.get('Records') # Get 'records' from queue message

    for record in records:
        body = record.get('body')
        messageAttributes = json.loads(record.get('messageAttributes'))

        if messageAttributes.get('path') == 'POST':
            post_verwerkings_acties(body, table)
        
        if messageAttributes.get('path') == 'PATCH':
            patch_verwerkings_acties(body, table)


# Post verwerkingsacties
def post_verwerkings_acties(body, table):        

    table.put_item(
        Item=body
    )

    return {
        'statusCode': 201,
        'body': json.dumps(body),
        'headers': { "Content-Type": "application/json" }
    }

# Patch verwerkingsacties
def patch_verwerkings_acties(body, table):

    verwerkingen = table.query(
        IndexName='verwerkingId-index',
        KeyConditionExpression=Key('verwerkingId').eq(body.get('verwerkingId'))
    )
    response = []
    for item in verwerkingen.get('Items'):
        if (body.get('vertrouwelijkheid') != None and body.get('bewaartermijn') == None):
            response.append(table.update_item(
                Key={ 
                    'actieId': item.get('actieId') 
                },
                UpdateExpression="SET vertrouwelijkheid= :var1",
                ExpressionAttributeValues={
                    ':var1': body.get('vertrouwelijkheid')
                }
            ))
        if (body.get('vertrouwelijkheid') == None and body.get('bewaartermijn') != None):
            response.append(table.update_item(
                Key={ 
                    'actieId': item.get('actieId') 
                },
                UpdateExpression="SET bewaartermijn= :var1",
                ExpressionAttributeValues={
                    ':var1': body.get('bewaartermijn')
                }
            ))
        if (body.get('vertrouwelijkheid') != None and body.get('bewaartermijn') != None):
            response.append(table.update_item(
                Key={ 
                    'actieId': item.get('actieId') 
                },
                UpdateExpression="SET vertrouwelijkheid= :var1, bewaartermijn= :var2",
                ExpressionAttributeValues={
                    ':var1': body.get('vertrouwelijkheid'),
                    ':var2': body.get('bewaartermijn')
                }
            ))
        
    if (response == []):
        print('verwerkingId not found!')
        return {
            'statusCode': 400,
            'body': 'verwerkingId not found!',
            'headers': { "Content-Type": "text/plain" },
            }
    else:
        print('Function completed!')
        return {
            'statusCode': 200,
            'body': json.dumps(response),
            'headers': { "Content-Type": "application/json" },
        }