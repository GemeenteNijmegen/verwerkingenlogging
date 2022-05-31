import boto3
import os
from handler import handleRequest

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['DYNAMO_TABLE_NAME'])

def handler(event, context):
    handleRequest(event, table)