import os
import boto3
from handler import handle_request
import logging

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['DYNAMO_TABLE_NAME'])
debug = os.getenv('ENABLE_VERBOSE_AND_SENSITIVE_LOGGING', 'false') == 'true'

def handler(event, context):
    if debug:
        print(event)
    try:
        return handle_request(event, table)
    except Exception as e:
        logging.error(e)