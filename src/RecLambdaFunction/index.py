import os
import boto3
from handler import handle_request

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['DYNAMO_TABLE_NAME'])

def handler(event, context):
    print(event)
    return handle_request(event, table)