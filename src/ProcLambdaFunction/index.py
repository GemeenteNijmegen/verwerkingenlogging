import os
import boto3
from handler import process_message

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['DYNAMO_TABLE_NAME'])
debug = os.getenv('DEBUG', 'false') == 'true'

def handler(event, context):
    if debug:
        print(event)
    return process_message(event, table)