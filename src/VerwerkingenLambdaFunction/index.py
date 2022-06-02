import os
import boto3
from handler import handleRequest

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['DYNAMO_TABLE_NAME'])

s3 = boto3.resource('s3')
bucket = s3.Bucket(os.environ['S3_BACKUP_BUCKET_NAME'])

def handler(event, context):
    print(event)
    handleRequest(event, table, bucket)