import os
import boto3
from handler import handle_request

s3 = boto3.resource('s3')
bucketName = s3.Bucket(os.environ['S3_BACKUP_BUCKET_NAME'])
sqs = boto3.resource('sqs')
queue = sqs.Queue(os.environ['SQS_URL'])
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['DYNAMO_TABLE_NAME'])

def handler(event, context):
    print(event)
    return handle_request(event, bucketName, queue, table)