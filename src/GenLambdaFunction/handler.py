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
        'parameters': event.get('queryStringParameters'),
        'pathParameters': event.get('pathParameters')
    }
    return validate_params(params)

# Validate parameters before request is processed.
def validate_params(params):
    if('/verwerkingsacties' in params['resource'] and params['method'] != 'POST' and params['pathParameters'] == None):
        if(params['parameters'] == None):
            raise Exception("GET and PATCH requests to /verwerkingsacties should have query parameters")
    return params

def filled_item(requestJSON, objectTypeSoortId, actieId, url, tijdstipRegistratie, verwerkteObjecten):
    return {
        'url': url,
        'actieId': actieId,
        'objectTypeSoortId': objectTypeSoortId,
        'actieNaam': requestJSON['actieNaam'],
        'handelingNaam': requestJSON['handelingNaam'],
        'verwerkingId': requestJSON['verwerkingId'],
        'verwerkingNaam': requestJSON['verwerkingNaam'],
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
        'verwerkteObjecten': verwerkteObjecten,
    }

# Store (backup) verwerking item in S3 Backup Bucket
def store_item_in_s3(item_json, bucket):
    path = item_json.get('actieId')
    data = bytes(json.dumps(item_json).encode('UTF-8'))
    bucket.put_object(
        ContentType='application/json',
        Key=path,
        Body=data,
    )

def generate_post_message(requestJson, object, actieId, url, tijdstipRegistratie, verwerkteObjecten):
    objectTypeSoortId = object.get('objecttype') + object.get('soortObjectId') + object.get('objectId')
    return filled_item(requestJson, objectTypeSoortId, actieId, url, tijdstipRegistratie, verwerkteObjecten)

def generate_patch_message(event):
    requestJson = json.loads(event.get('body'))

    msg = {
        "verwerkingId": event.get('queryStringParameters').get('verwerkingId'),
        "bewaartermijn": requestJson.get('bewaartermijn'), # Optional
        "vertouwelijkheid": requestJson.get('vertrouwelijkheid') # Optional
    }

    return json.dumps(msg)


def generate_put_message(event, requestJson, tijdstipRegistratie):
    # TODO: validate if actieId in pathParameters equals the actieId in the request body (requestJson)
    # If they are not equal it's an invalid / forbidden request. 
    actieId = event.get('pathParameters').get('actieId')
    requestJson.update({ "actieId": actieId, "tijdstipRegistratie": tijdstipRegistratie })

    return requestJson


def send_to_queue(msg, queue, path):
    body = json.dumps(msg)
    queue.send_message(MessageBody=body, MessageAttributes={
        'path': {
            'DataType': 'String',
            'StringValue': path
        }})

# Receives the event object and routes it to the correct function
def handle_request(event, bucket, queue):
    params = parse_event(event)
    requestJson = json.loads(event.get('body'))

    # Generate timestamp for tijdstipRegistratie.
    tijdstipRegistratie = datetime.now().isoformat(timespec='seconds')

    if(params['method'] == 'POST' and params['resource'] == '/verwerkingsacties'):

        # Generate UUID for actieId
        actieId = str(uuid.uuid1()) # V1 Timestamp

        # Create DB url using generated actieId
        url = "https://verwerkingenlogging-bewerking-api.vng.cloud/api/v1/verwerkingsacties/" + actieId

        # Add verwerktObjectId to each verwerktObject before proceeding
        verwerkteObjecten = requestJson.get('verwerkteObjecten')
        if (len(verwerkteObjecten) >= 1):
            for object in verwerkteObjecten:
                verwerktObjectId = str(uuid.uuid4()) # uuid4 to make uuid random within a for loop (uuid1 gives same uuid to each object)
                object.update({ "verwerktObjectId": verwerktObjectId })

        # Create a seperate item (db record) for each verwerktObject
        # PK = actieId | SK = objectTypeSoortId
        for object in verwerkteObjecten:

            # Generate post message (including verwerktObjectId and objectTypeSoortId)
            msg = generate_post_message(requestJson, object, actieId, url, tijdstipRegistratie, verwerkteObjecten)

            # Store message as backup in S3
            store_item_in_s3(msg, bucket)

            # Send message to queue
            send_to_queue(msg, queue, 'POST')

        # Message inlcudes original request combined with actieId and Url
        return { 'statusCode': 200, 'body': json.dumps(msg), 'headers': { "Content-Type": "application/json" }}

    if(params['method'] == 'PATCH' and params['resource'] =='/verwerkingsacties'):
        # Backup using verwerkingId (instead of actieId)??

        msg = generate_patch_message(event)

        # Send message to queue.
        send_to_queue(msg, queue, 'PATCH')

        return { 'statusCode': 200, 'body': json.dumps(msg), 'headers': { "Content-Type": "application/json" }}

    if(params['method'] == 'PUT' and params['resource'] == '/verwerkingsacties/{actieId}'):

        msg = generate_put_message(event, requestJson, tijdstipRegistratie)

        store_item_in_s3(msg, bucket)

        send_to_queue(msg, queue, 'PUT')

        return { 'statusCode': 200, 'body': json.dumps(msg), 'headers': { "Content-Type": "application/json" }}
        

    # if no matches were found, handle this as a malformed request
    return {
            'statusCode': 400,
            'body': '400 Bad Request',
            'headers': { "Content-Type": "text/plain" }
    }