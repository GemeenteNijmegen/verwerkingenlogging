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

def filled_item(requestJSON, url, actieId, tijdstipRegistratie, verwerkteObjecten):
    return {
        'url': url,
        'actieId': actieId,
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

def generate_post_message(event):
    # Generate UUID for actieId
    actieId = str(uuid.uuid1()) # V1 Timestamp

    # Create DB url using generated actieId
    url = "https://verwerkingenlogging-bewerking-api.vng.cloud/api/v1/verwerkingsacties/" + actieId
    
    # Generate timestamp for tijdstipRegistratie.
    tijdstipRegistratie = datetime.now().isoformat(timespec='seconds')

    requestJson = json.loads(event.get('body'))

    # Add verwerktObjectId to each verwerktObject
    verwerkteObjecten = requestJson.get('verwerkteObjecten')
    if (len(verwerkteObjecten) >= 1):
        for object in verwerkteObjecten:
            verwerktObjectId = str(uuid.uuid4()) # uuid4 to make uuid random within a for loop (uuid1 gives same uuid to each object)
            objectTypeSoortId = object.get('objecttype') + object.get('soortObjectId') + object.get('objectId')
            object.update({ "verwerktObjectId": verwerktObjectId, "objectTypeSoortId": objectTypeSoortId })

    return filled_item(requestJson, url, actieId, tijdstipRegistratie, verwerkteObjecten)

def generate_patch_message(event):
    requestJson = event.get('body')

    msg = {
        "verwerkingId": requestJson.get('verwerkingId'),
        "bewaartermijn": requestJson.get('bewaartermijn'), # Optional
        "vertouwelijkheid": requestJson.get('vertrouwelijkheid') # Optional
    }

    return msg

def send_to_queue(msg, path, queue):
    queue.send_message(MessageBody=msg, MessageAttributes={'path': path})

def instant_response(msg):
    {
            'statusCode': 200,
            'body': msg,
            'headers': { "Content-Type": "application/json" }
    }

# Receives the event object and routes it to the correct function
def handle_request(event, bucket, queue):
    params = parse_event(event)

    if(params['method'] == 'POST' and params['resource'] == '/verwerkingsacties'):
        # Generate actieId, Url, verwerktObjectId and objectTypeSoortId
        msg = generate_post_message(event)

        # Store message as backup in S3
        store_item_in_s3(msg, bucket)

        # Send message to queue
        send_to_queue(msg, queue, 'POST')

        # Message inlcudes original request combined with actieId and Url
        return instant_response(msg)

    if(params['method'] == 'PATCH' and params['resource'] =='/verwerkingsacties'):
        # Backup using verwerkingId (instead of actieId)??

        msg = generate_patch_message(event)

        # Send message to queue. Note: no instant repsonse required.
        send_to_queue(msg, queue, 'PATCH')

    # if no matches were found, handle this as a malformed request
    return {
            'statusCode': 400,
            'body': '400 Bad Request',
            'headers': { "Content-Type": "text/plain" }
    }