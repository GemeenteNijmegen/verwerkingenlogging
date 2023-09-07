import os
from Shared.responses import internalServerErrorResponse
import boto3
from handler import handle_request
import logging

s3 = boto3.resource('s3')
bucketName = s3.Bucket(os.environ['S3_BACKUP_BUCKET_NAME'])
sqs = boto3.resource('sqs')
queue = sqs.Queue(os.environ['SQS_URL'])
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['DYNAMO_TABLE_NAME'])
debug = os.getenv('ENABLE_VERBOSE_AND_SENSITIVE_LOGGING', 'false') == 'true'

def handler(event, context):
    if debug:
        print(event)
    try:
        return handle_request(event, bucketName, queue, table)
    except Exception as e:
        logging.error(e)
        return internalServerErrorResponse()