import json
import uuid
import hashlib
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

# Validate parameters before request is processed.
def validate_params(params):
    if('/verwerkingsacties' in params.get('resource') and params.get('method') != 'POST' and params.get('pathParameters') == None):
        if(params.get('parameters') == None):
            raise Exception("GET and PATCH requests to /verwerkingsacties should have query parameters")

    if(params.get('method') == 'PATCH' and 'verwerkingId' not in params.get('parameters')):
            raise Exception("PATCH requests to /verwerkingsacties should have (required) query parameters")

    return params

# Parse message
def filled_item(requestJSON, objectTypeSoortId, actieId, url, tijdstipRegistratie, verwerkteObjecten):
    return {
        'url': url,
        'actieId': actieId,
        'objectTypeSoortId': objectTypeSoortId,
        'actieNaam': requestJSON.get('actieNaam'),
        'handelingNaam': requestJSON.get('handelingNaam'),
        'verwerkingId': requestJSON.get('verwerkingId'),
        'verwerkingNaam': requestJSON.get('verwerkingNaam'),
        'verwerkingsactiviteitId': requestJSON.get('verwerkingsactiviteitId'),
        'verwerkingsactiviteitUrl': requestJSON.get('verwerkingsactiviteitUrl'),
        'vertrouwelijkheid': requestJSON.get('vertrouwelijkheid'),
        'bewaartermijn': requestJSON.get('bewaartermijn'),
        'uitvoerder': requestJSON.get('uitvoerder'),
        'systeem': requestJSON.get('systeem'),
        'gebruiker': requestJSON.get('gebruiker'),
        'gegevensbron': requestJSON.get('gegevensbron'),
        'soortAfnemerId': requestJSON.get('soortAfnemerId'),
        'afnemerId': requestJSON.get('afnemerId'),
        'verwerkingsactiviteitIdAfnemer': requestJSON.get('verwerkingsactiviteitIdAfnemer'),
        'verwerkingsactiviteitUrlAfnemer': requestJSON.get('verwerkingsactiviteitUrlAfnemer'),
        'verwerkingIdAfnemer': requestJSON.get('verwerkingIdAfnemer'),
        'tijdstip': requestJSON.get('tijdstip'),
        'tijdstipRegistratie': tijdstipRegistratie,
        'verwerkteObjecten': verwerkteObjecten,
    }

# Validate if required fields are included in body
def validate_body(item):
    for verwerktObject in item.get('verwerkteObjecten'):
        if(verwerktObject.get('objecttype') == None or verwerktObject.get('soortObjectId') == None or verwerktObject.get('objectId') == None):
            raise Exception("Post requests to /verwerkingsacties should have (required) body parameters")
        for verwerkteSoortenGegeven in verwerktObject.get('verwerkteSoortenGegevens'):
            if(verwerkteSoortenGegeven.get('soortGegeven') == None):
                raise Exception("Post requests to /verwerkingsacties should have (required) body parameters")


    if(item.get('vertrouwelijkheid') == None or item.get('tijdstip') == None):
        raise Exception("Post requests to /verwerkingsacties should have (required) body parameters")
    else:
        return item

# Store (backup) verwerking item in S3 Backup Bucket
def store_item_in_s3(item_json, bucket):
    path = item_json.get('actieId')
    data = bytes(json.dumps(item_json).encode('UTF-8'))
    bucket.put_object(
        ContentType='application/json',
        Key=path,
        Body=data,
    )

# Create a new POST message
def generate_post_message(requestJson, object, actieId, url, tijdstipRegistratie, verwerkteObjecten):
    objectTypeSoortId = object.get('objecttype') + object.get('soortObjectId') + object.get('objectId')
    item = filled_item(requestJson, objectTypeSoortId, actieId, url, tijdstipRegistratie, verwerkteObjecten)

    # hash objectId
    verwerkteObjecten = item.get('verwerkteObjecten')
    for verwerktObject in verwerkteObjecten:
        objectId = verwerktObject.get('objectId')
        hashedObjectId = hashHelper(objectId)
        verwerktObject.update({ 'objectId': hashedObjectId })
    
    # Update item with hashed objectId's
    item.update({ 'verwerkteObjecten': verwerkteObjecten })

    return validate_body(item)

# Create a new PATCH message
def generate_patch_message(event):
    requestJson = json.loads(event.get('body'))

    msg = {
        "verwerkingId": event.get('queryStringParameters').get('verwerkingId'),
        "bewaartermijn": requestJson.get('bewaartermijn'), # Optional
        "vertouwelijkheid": requestJson.get('vertrouwelijkheid') # Optional
    }

    return json.dumps(msg)

# Create a new PUT message
def generate_put_message(event, object, requestJson, tijdstipRegistratie):
    # TODO: validate if actieId in pathParameters equals the actieId in the request body (requestJson)
    # If they are not equal it's an invalid / forbidden request. 
    actieId = event.get('pathParameters').get('actieId')
    objectTypeSoortId = object.get('objecttype') + object.get('soortObjectId') + object.get('objectId')
    requestJson.update({ "actieId": actieId, "objectTypeSoortId": objectTypeSoortId, "tijdstipRegistratie": tijdstipRegistratie })

    return validate_body(requestJson)

# Send message to queue
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

    if(params.get('method') == 'POST' and params.get('resource') == '/verwerkingsacties'):

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
        # Remove objectTypeSoortId from return message
        msg.pop('objectTypeSoortId')
        return { 'statusCode': 200, 'body': json.dumps(msg), 'headers': { "Content-Type": "application/json" }}

    if(params.get('method') == 'PATCH' and params.get('resource') =='/verwerkingsacties'):
        # Backup using verwerkingId (instead of actieId)??

        msg = generate_patch_message(event)

        # Send message to queue.
        send_to_queue(msg, queue, 'PATCH')

        return { 'statusCode': 200 }

    if(params.get('method') == 'PUT' and params.get('resource') == '/verwerkingsacties/{actieId}'):

        verwerkteObjecten = requestJson.get('verwerkteObjecten')

        for object in verwerkteObjecten:
            msg = generate_put_message(event, object, requestJson, tijdstipRegistratie)

            store_item_in_s3(msg, bucket)

            send_to_queue(msg, queue, 'PUT')

        # Remove objectTypeSoortId from return message
        msg.pop('objectTypeSoortId')
        return { 'statusCode': 200, 'body': json.dumps(msg), 'headers': { "Content-Type": "application/json" }}
        

    # if no matches were found, handle this as a malformed request
    return {
            'statusCode': 400,
            'body': '400 Bad Request',
            'headers': { "Content-Type": "text/plain" }
    }

def hashHelper(input):
    # salt = secrets.token_hex(8)
    h = hashlib.new('sha3_256')
    h.update(bytes(input, encoding='UTF-8'))
    # h.update(bytes(salt))
    hash = h.hexdigest()
    return hash