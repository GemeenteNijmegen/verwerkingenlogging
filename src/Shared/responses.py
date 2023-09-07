
import json
from Shared.version import VERWERKINGENLOGGING_API_VERSION

def successResponse(body, code=200):
  responseBody = ''
  if body is not None:
    responseBody = json.dumps(body)
  return {
    'statusCode': code,
    'body': json.dumps(responseBody),
    'headers': { 
      "Content-Type": "application/json",
      "API-version": VERWERKINGENLOGGING_API_VERSION,
    }
  }

def badRequestResponse():
  return errorResponse('Bad request', 400)

def internalServerErrorResponse():
  return errorResponse('Internal server error', 500)

def notFoundResponse():
  return errorResponse('Not found', 404)

def errorResponse(title, status):
  problem = {
    "title": title,
    "status": status,
  }
  return {
    'statusCode': status,
    'body': json.dumps(problem),
    'headers': { 
      "Content-Type": "application/problem+json",
      "API-version": VERWERKINGENLOGGING_API_VERSION,
    },
  }
