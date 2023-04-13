import os
import boto3
from handler import process_message

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['DYNAMO_TABLE_NAME'])

def handler(event, context):
    print(event)
    return process_message(event, table)