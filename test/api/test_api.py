"""
File: test_api.py
Description: Test the verwerkingslogging api
"""
#pylint: disable=wrong-import-position
#pylint: enable=wrong-import-position

import os
import sys
import boto3
import pytest
import json

from moto import mock_dynamodb, mock_s3

# Getting to the Lambda directory
sys.path.append(os.path.join(os.path.dirname(os.path.realpath(__file__)),"../../src/VerwerkingenLambdaFunction"))

from handler import handle_request, parse_event

def test_parse_event(get_event):
    """Test parsing and validation of events
    """

    params = parse_event(get_event)
    assert params['method'] == 'GET'

    event = {
        'httpMethod': 'GET',
        'resource': '/verwerkingsacties',
    }
    with pytest.raises(Exception):
        parse_event(event)

@mock_s3
@mock_dynamodb
def test_post_verwerkingsactie(post_event):
    """Posting a new action to the API
    """
    table = mock_table()
    bucket = mock_s3_bucket()
    response = handle_request(post_event, table, bucket)
    assert response['statusCode'] == 201
    result = json.loads(response['body'])
    assert len(result['actieId']) > 0
    assert result['actieNaam'] == 'Zoeken personen'

@mock_s3
@mock_dynamodb
def test_get_verwerkingsactie_empty(get_event):
    """Testing getting an action from the API when there are no contents
    """
    table = mock_table()
    bucket = mock_s3_bucket()

    response = handle_request(get_event, table, bucket)
    assert response['statusCode'] == 200
    result = json.loads(response['body'])
    assert len(result['Items']) == 0

@mock_s3
@mock_dynamodb
def test_get_verwerkingsactie_non_empty(get_event, post_event):
    """Testing getting an action from the API when there are contents in the log
    """
    table = mock_table()
    bucket = mock_s3_bucket()

     # First post so there's something to get
    response = handle_request(post_event, table, bucket)


    response = handle_request(get_event, table, bucket)
    assert response['statusCode'] == 200
    result = json.loads(response['body'])
    assert len(result['Items']) == 1

@mock_s3
@mock_dynamodb
def test_get_verwerkingsactie_vertrouwelijk(get_event_vertrouwelijk, post_event):
    """Testing getting an action from the API when there are contents in the log
    """
    table = mock_table()
    bucket = mock_s3_bucket()

     # First post so there's something to get
    response = handle_request(post_event, table, bucket)

    response = handle_request(get_event_vertrouwelijk, table, bucket)
    assert response['statusCode'] == 200
    result = json.loads(response['body'])
    assert len(result['Items']) == 0

@mock_s3
@mock_dynamodb
def test_get_verwerkingsactie_time_only(get_event_time_only, post_event):
    """Testing getting an action from the API when there are contents in the log
    """
    table = mock_table()
    bucket = mock_s3_bucket()

     # First post so there's something to get
    response = handle_request(post_event, table, bucket)


    response = handle_request(get_event_time_only, table, bucket)
    assert response['statusCode'] == 200
    result = json.loads(response['body'])
    assert len(result['Items']) == 1


@mock_s3
@mock_dynamodb
def test_get_specific_verwerkingsactie(get_specific_event, post_event):
    """Getting a specific action from the API
    """
    table = mock_table()
    bucket = mock_s3_bucket()

     # First post so there's something to get
    response = handle_request(post_event, table, bucket)

    response = handle_request(get_specific_event, table, bucket)
    assert response['statusCode'] == 200
    result = json.loads(response['body'])
    assert len(result['Items']) == 1

@mock_s3
@mock_dynamodb
def test_patch_verwerkingsactie(post_event, patch_event, get_event):
    """Patching a specific action from the API and getting resulting item
    """
    table = mock_table()
    bucket = mock_s3_bucket()

     # First post so there's something to patch
    response = handle_request(post_event, table, bucket)

    # patch the posted event
    response = handle_request(patch_event, table, bucket)
    assert response['statusCode'] == 200
    result = json.loads(response['body'])
    assert len(result) == 1
    
    # Get the modified record and check for changes
    response = handle_request(get_event, table, bucket)
    assert response['statusCode'] == 200
    result = json.loads(response['body'])
    assert result['Items'][0]['bewaartermijn'] == 'P1Y';

@pytest.fixture
def post_event():
    event = {
        'httpMethod': 'POST',
        'resource': '/verwerkingsacties',
        "body": json.dumps({
            "actieNaam": "Zoeken personen",
            "handelingNaam": "Intake",
            "verwerkingNaam": "Huwelijk",
            "verwerkingId": "48086bf2-11b7-4603-9526-67d7c3bb6587",
            "verwerkingsactiviteitId": "5f0bef4c-f66f-4311-84a5-19e8bf359eaf",
            "verwerkingsactiviteitUrl": "https://verwerkingsactiviteiten-api.vng.cloud/api/v1/verwerkingsactiviteiten/5f0bef4c-f66f-4311-84a5-19e8bf359eaf",
            "vertrouwelijkheid": "normaal",
            "bewaartermijn": "P10Y",
            "uitvoerder": "00000001821002193000",
            "systeem": "FooBarApp v2.1",
            "gebruiker": "123456789",
            "gegevensbron": "FooBar Database Publiekszaken",
            "soortAfnemerId": "OIN",
            "afnemerId": "00000001821002193000",
            "verwerkingsactiviteitIdAfnemer": "c5b9f4e7-8c79-41b9-91e2-6268419cb167",
            "verwerkingsactiviteitUrlAfnemer": "https://www.amsterdam.nl/var/api/v1/verwerkingsactiviteiten/5f0bef4c-f66f-4311-84a5-19e8bf359eaf",
            "verwerkingIdAfnemer": "4b698de3-ffba-45e7-8697-a283ec863db2",
            "tijdstip": "2024-04-05T14:35:42+01:00",
            "verwerkteObjecten": [
                {
                    "objecttype": "persoon",
                    "soortObjectId": "BSN",
                    "objectId": "1234567",
                    "betrokkenheid": "Getuige",
                    "verwerkteSoortenGegevens": [
                        {
                            "soortGegeven": "BSN"
                        }
                    ]
                }
            ]
        })
    }
    return event

@pytest.fixture
def get_event():
    event = {
        'queryStringParameters': { 
            'verwerkingsactiviteitId': '5f0bef4c-f66f-4311-84a5-19e8bf359eaf', 
            'objecttype': 'persoon',
            'soortObjectId': 'BSN',
            'objectId': '1234567',
            'beginDatum': '2022-04-05T14:35:42+01:00',
            'eindDatum': '2025-04-05T14:35:42+01:00',

        },
        'httpMethod': 'GET',
        'resource': '/verwerkingsacties'
    }
    return event

@pytest.fixture
def get_event_vertrouwelijk():
    event = {
        'queryStringParameters': { 
            'verwerkingsactiviteitId': '5f0bef4c-f66f-4311-84a5-19e8bf359eaf', 
            'objecttype': 'persoon',
            'soortObjectId': 'BSN',
            'objectId': '1234567',
            'beginDatum': '2022-04-05T14:35:42+01:00',
            'eindDatum': '2025-04-05T14:35:42+01:00',
            'vertrouwelijkheid': 'hoog'

        },
        'httpMethod': 'GET',
        'resource': '/verwerkingsacties'
    }
    return event


@pytest.fixture
def get_event_time_only():
    event = {
        'queryStringParameters': { 
            'objecttype': 'persoon',
            'soortObjectId': 'BSN',
            'objectId': '1234567',
            'beginDatum': '2022-04-05T14:35:42+01:00',
            'eindDatum': '2025-04-05T14:35:42+01:00',

        },
        'httpMethod': 'GET',
        'resource': '/verwerkingsacties'
    }
    return event


@pytest.fixture
def get_specific_event():
    event = {
        'queryStringParameters': { 
            'verwerkingsactiviteitId': '5f0bef4c-f66f-4311-84a5-19e8bf359eaf', 
            'objecttype': 'persoon',
            'soortObjectId': 'BSN',
            'objectId': '1234567',
            'beginDatum': '2022-04-05T14:35:42+01:00',
            'eindDatum': '2025-04-05T14:35:42+01:00',

        },
        'httpMethod': 'GET',
        'resource': '/verwerkingsacties'
    }
    return event

@pytest.fixture
def patch_event():
    event = {
        'httpMethod': 'PATCH',
        'resource': '/verwerkingsacties',
        "body": json.dumps({
            "vertrouwelijkheid": "hoog",
            "bewaartermijn": "P1Y"
        }),
        'queryStringParameters': {
            'verwerkingId': '48086bf2-11b7-4603-9526-67d7c3bb6587'
        }
    }
    return event

@mock_s3
def mock_s3_bucket():
    conn = boto3.resource('s3', region_name='us-east-1')
    # We need to create the bucket since this is all in Moto's 'virtual' AWS account
    bucket = conn.create_bucket(Bucket='mybucket')
    return bucket

@mock_dynamodb
def mock_table():
    conn = boto3.resource('dynamodb', region_name='us-east-1')
    table = conn.create_table(
    TableName="test",
    KeySchema=[
        {"AttributeName": "actieId", "KeyType": "HASH"},
    ],
    BillingMode='PAY_PER_REQUEST',
    AttributeDefinitions=[
        {
            "AttributeName": "actieId", "AttributeType": "S"
        },
        {
            "AttributeName": "objecttypesoortObjectIdobjectId", "AttributeType": "S"
        },
        {
            "AttributeName": "verwerkingId", "AttributeType": "S"
        }
    ],
    GlobalSecondaryIndexes=[
        {
            'IndexName': 'objecttypesoortObjectIdobjectId-index',
            'KeySchema': [
            {
                'AttributeName': 'objecttypesoortObjectIdobjectId',
                'KeyType': 'HASH'
            }
            ],
            'Projection': {
            'ProjectionType': 'ALL'
            },
            'ProvisionedThroughput': {
                'ReadCapacityUnits': 1,
                'WriteCapacityUnits': 1
            }
        },
         {
            'IndexName': 'verwerkingId-index',
            'KeySchema': [
            {
                'AttributeName': 'verwerkingId',
                'KeyType': 'HASH'
            }
            ],
            'Projection': {
            'ProjectionType': 'ALL'
            },
            'ProvisionedThroughput': {
                'ReadCapacityUnits': 1,
                'WriteCapacityUnits': 1
            }
        }
    ],
    )
    return table

# For direct invocation and testing on the local machine
if __name__ == '__main__':
    test_verwerkingsactie()