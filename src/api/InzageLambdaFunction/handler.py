import json
import os
import uuid
from datetime import datetime
# from Shared.helpers import hashHelper, logApiCall
# from Shared.responses import badRequestResponse, successResponse


# from boto3.dynamodb.conditions import Key, Attr

apiBaseUrl = os.getenv('API_BASE_URL', 'api.vwlog-prod.csp-nijmegen.nl')

# Receives the event object and routes it to the correct function
def handle_request(event, table):
    print(event)


