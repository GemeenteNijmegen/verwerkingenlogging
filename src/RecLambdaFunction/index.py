import os
import boto3
from handler import handle_request

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['DYNAMO_TABLE_NAME'])
debug = os.getenv('DEBUG', 'false') == 'true'

def handler(event, context):
    if debug:
        print(event)
    return handle_request(event, table)