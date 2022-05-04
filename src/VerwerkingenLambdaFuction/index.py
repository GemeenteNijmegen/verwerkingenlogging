def handler(event, context): 
    print("Inside Lambda")
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": 'Successfully Invoked Lambda through API Gateway'
    }
