import json
import os
import uuid
import hashlib
from datetime import datetime

from boto3.dynamodb.conditions import Key, Attr

apiBaseUrl = os.getenv('API_BASE_URL', 'api.vwlog-prod.csp-nijmegen.nl')


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
def filled_item(requestJSON, actieId, url, tijdstipRegistratie):
    return {
        'url': url,
        'actieId': actieId,
        'compositeSortKey': '', # filled later
        'objectTypeSoortId': '', # filled later
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
        'verwerkteObjecten': requestJSON.get('verwerkteObjecten'),
    }

# Validate if required fields are included in body
def validate_body(item):
    for verwerktObject in item.get('verwerkteObjecten'):
        if(verwerktObject.get('objectType') == None or verwerktObject.get('soortObjectId') == None or verwerktObject.get('objectId') == None):
            raise Exception("Post requests to /verwerkingsacties should have (required) body parameters")
        for verwerkteSoortenGegeven in verwerktObject.get('verwerkteSoortenGegevens'):
            if(verwerkteSoortenGegeven.get('soortGegeven') == None):
                raise Exception("Post requests to /verwerkingsacties should have (required) body parameters")


    if(item.get('vertrouwelijkheid') == None or item.get('tijdstip') == None):
        raise Exception("Post requests to /verwerkingsacties should have (required) body parameters")
    else:
        return item

# Store (backup) verwerking item in S3 Backup Bucket
def store_item_in_s3(actieId, event, bucket):
    data = bytes(json.dumps(event).encode('UTF-8'))
    bucket.put_object(
        ContentType='application/json',
        Key=actieId,
        Body=data,
    )

# Generate id(s) for verwerkteObjecten
def verwerktObjectId_check(item, table):
    # cache the created verwerktObjectId for other verwerkteObjecten
    cachedIds = {}

    # Add verwerktObjectId to each verwerktObject before proceeding
    verwerkteObjecten = item.get('verwerkteObjecten')
    if (len(verwerkteObjecten) >= 1):
        for object in verwerkteObjecten:
            # check if objectTypeSoortId already exists in DB
            objectTypeSoortId = object.get('objectType') + object.get('soortObjectId') + object.get('objectId')
            response = table.query(
                    IndexName='objectTypeSoortId-index',
                    KeyConditionExpression=Key('objectTypeSoortId').eq(objectTypeSoortId)
                )

            if ( objectTypeSoortId in cachedIds.keys() ): # validate if verwerkteObjectId was already created before in this function run
                verwerktObjectId = cachedIds[objectTypeSoortId].get('verwerktObjectId')
                object.update({ "verwerktObjectId": verwerktObjectId })
            elif (response.get('Count') == 0):
                verwerktObjectId = str(uuid.uuid4()) # uuid4 to make uuid random within a for loop (uuid1 gives same uuid to each object)
                object.update({ "verwerktObjectId": verwerktObjectId })
                cachedIds.update({ objectTypeSoortId:
                    { "verwerktObjectId": verwerktObjectId }
                    })
            else:
                # search for a verwerkt object (from the query response) where objectTypeSoortId equals that of the main (posted) object
                # this Id is used to update the item, since we don't want to recreate an Id of an already existing (in DB) verwerkt object.
                for verwerktObject in response.get('Items')[0].get('verwerkteObjecten'):
                    if (verwerktObject.get('objectType') + verwerktObject.get('soortObjectId') + verwerktObject.get('objectId') == objectTypeSoortId):
                        verwerktObjectId = verwerktObject.get('verwerktObjectId')
                
                # update verwertkObjectId
                object.update({ "verwerktObjectId": verwerktObjectId })

    return item

# Hash the obejctId
def objectId_check(item):
    for object in item.get('verwerkteObjecten'):
        # hash objectId, create composite sort key and update item
        objectId = object.get('objectId')
        if (len(objectId) < 10): # dirty fix to check whether BSN has already been hashed
            hashedObjectId = hashHelper(objectId)
        else:
            hashedObjectId = objectId
        
        object.update({'objectId': hashedObjectId})

    return item

# Create a new POST message
def generate_post_message(verwerktObject, requestJson, actieId, url, tijdstipRegistratie):
    item = filled_item(requestJson, actieId, url, tijdstipRegistratie)
    
    objectTypeSoortId = verwerktObject.get('objectType') + verwerktObject.get('soortObjectId') + verwerktObject.get('objectId')
    compositeSortKey = objectTypeSoortId + '#' + tijdstipRegistratie   # Composite SK - combining the unique soortObjecTypeId and the tijdstipRegistratie timestamp
    item.update({ 'compositeSortKey': compositeSortKey, 'objectTypeSoortId': objectTypeSoortId })

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
def generate_put_message(event, verwerktObject, item, tijdstipRegistratie):
    # TODO: validate if actieId in pathParameters equals the actieId in the request body (requestJson)
    # If they are not equal it's an invalid / forbidden request. 
    actieId = event.get('pathParameters').get('actieId')
    objectTypeSoortId = verwerktObject.get('objectType') + verwerktObject.get('soortObjectId') + verwerktObject.get('objectId')
    compositeSortKey = objectTypeSoortId + '#' + tijdstipRegistratie   # Composite SK - combining the unique soortObjecTypeId and the tijdstipRegistratie timestamp
    item.update({'actieId': actieId, 'compositeSortKey': compositeSortKey, 'objectTypeSoortId': objectTypeSoortId })

    return validate_body(item)

# Send message to queue
def send_to_queue(msg, queue, path):
    body = json.dumps(msg)
    queue.send_message(MessageBody=body, MessageAttributes={
        'path': {
            'DataType': 'String',
            'StringValue': path
        }})

# Receives the event object and routes it to the correct function
def handle_request(event, bucket, queue, table):
    params = parse_event(event)
    requestJson = json.loads(event.get('body'))

    # Generate timestamp for tijdstipRegistratie.
    tijdstipRegistratie = datetime.now().isoformat(timespec='seconds')

    if(params.get('method') == 'POST' and params.get('resource') == '/verwerkingsacties'):

        # Generate UUID for actieId
        actieId = str(uuid.uuid1()) # V1 Timestamp

        # Store (RAW) message as backup in S3
        store_item_in_s3(actieId, event, bucket)

        # Create DB url using generated actieId
        url = "https://" + apiBaseUrl + "/verwerkingsacties/" + actieId

        item = objectId_check(requestJson)
        item = verwerktObjectId_check(item, table)

        for verwerktObject in item.get('verwerkteObjecten'):

            # Generate post message (including verwerktObjectId)
            msg = generate_post_message(verwerktObject, item, actieId, url, tijdstipRegistratie)

            # Send message to queue
            send_to_queue(msg, queue, 'POST')

        # Message inlcudes original request combined with actieId and Url
        # Remove compositeSortKey and objectTypeSoortId from return message
        msg.pop('compositeSortKey')
        msg.pop('objectTypeSoortId')
        return { 'statusCode': 200, 'body': json.dumps(msg), 'headers': { "Content-Type": "application/json" }}

    if(params.get('method') == 'PATCH' and params.get('resource') =='/verwerkingsacties'):
        # Backup using verwerkingId (instead of actieId)??

        msg = generate_patch_message(event)

        # Send message to queue.
        send_to_queue(msg, queue, 'PATCH')

        return { 'statusCode': 200 }

    if(params.get('method') == 'PUT' and params.get('resource') == '/verwerkingsacties/{actieId}'):

        item = objectId_check(requestJson)
        verwerkteObjecten = item.get('verwerkteObjecten')

        for object in verwerkteObjecten:
            msg = generate_put_message(event, object, requestJson, tijdstipRegistratie)

            store_item_in_s3(item.get('actieId'), msg, bucket)

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