"""
File: test_basic_lambda.py
Description: Runs a test for our 'gefyra-basic-lambda' Lambda
"""
import os
import sys
import boto3
import botocore
from moto import mock_dynamodb
# from botocore.stub import Stubber
# # import json

# Getting to the Lambda directory
sys.path.append(os.path.join(os.path.dirname(os.path.realpath(__file__)),"../../src/VerwerkingenLambdaFunction"))

#pylint: disable=wrong-import-position
from handler import handleRequest
#pylint: enable=wrong-import-position

@mock_dynamodb
def test_verwerkingsactie():
    table = mock_table()

    """
    Testing an empty payload event to the Lambda
    """
    
    event = {
        'queryStringParameters': { 
            'verwerkingsactiviteitId': '123', 
            'objecttype': 'test',
            'soortObjectId': 'test',
            'objectId': 'test',
            'beginDatum': '123',
            'eindDatum': '123',

        },
        'httpMethod': 'GET',
        'resource': '/verwerkingsacties'
    }

    response = handleRequest(event, table)
    assert response['statusCode'] == 200

def mock_table():
    conn = boto3.resource('dynamodb', region_name='us-east-1')
    table = conn.create_table(
    TableName="test",
    KeySchema=[
        {"AttributeName": "partitionKey", "KeyType": "HASH"},
    ],
    BillingMode='PAY_PER_REQUEST',
    AttributeDefinitions=[
        {
            "AttributeName": "partitionKey", "AttributeType": "S"
        },
        {
            "AttributeName": "objecttypesoortObjectIdobjectId", "AttributeType": "S"
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
        }
    ],
    )
    
    return table

# For direct invocation and testing on the local machine
if __name__ == '__main__':
    test_initialization()