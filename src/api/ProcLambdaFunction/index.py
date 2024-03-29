import logging
import os
from Shared.responses import internalServerErrorResponse
import boto3
from handler import process_message

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['DYNAMO_TABLE_NAME'])
debug = os.getenv('ENABLE_VERBOSE_AND_SENSITIVE_LOGGING', 'false') == 'true'

def handler(event, context):
    if debug:
        print(event)
    try:
        return process_message(event, table)
    except Exception as e:
        logging.error(e)
        return internalServerErrorResponse()