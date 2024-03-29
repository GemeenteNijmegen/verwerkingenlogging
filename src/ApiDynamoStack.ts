import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { AwsIntegration, RestApi, PassthroughBehavior } from 'aws-cdk-lib/aws-apigateway';
import { Table, BillingMode, AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class ApiDynamoStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // DynamoDB Table
    const ddbTable = new Table(this, 'verwerkingen-api-dynamo-table', {
      partitionKey: { name: 'actieId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // TODO: Lambda voor GET

    // TODO: Lambda voor POST / PATCH

    // TODO: Lambda voor verwerking (PROC)

    // TODO: SQS queue

    // RestApi
    const restApi = new RestApi(this, 'verwerkingen-api-dynamo-rest-api');

    // Allow the RestApi to access DynamoDb by assigning this role to the integration
    const integrationRole = new Role(this, 'verwerkingen-integration-role', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
    });
    ddbTable.grantReadWriteData(integrationRole);

    // POST Integration to DynamoDb
    const dynamoPostIntegration = new AwsIntegration({
      service: 'dynamodb',
      action: 'PutItem',
      options: {
        passthroughBehavior: PassthroughBehavior.WHEN_NO_TEMPLATES,
        credentialsRole: integrationRole,
        requestTemplates: {
          'application/json': JSON.stringify({
            TableName: ddbTable.tableName,
            Item: {
              actieId: { S: '$context.requestId' },
              tijdstipRegistratie: { S: '$context.requestTime' },
            },
          }),
        },
        integrationResponses: [
          {
            statusCode: '200',
            responseTemplates: {
              'application/json': JSON.stringify({
                actieId: '$context.requestId',
                tijdstipRegistratie: '$context.requestTime',
              }),
            },
          },
        ],
      },
    });
    const verwerkingsactiesRoute = restApi.root.addResource('verwerkingsacties');
    verwerkingsactiesRoute.addMethod('POST', dynamoPostIntegration, {
      methodResponses: [{ statusCode: '200' }],
    });

    // GET Integration with DynamoDb
    const dynamoQueryIntegration = new AwsIntegration({
      service: 'dynamodb',
      action: 'Query',
      options: {
        passthroughBehavior: PassthroughBehavior.WHEN_NO_TEMPLATES,
        credentialsRole: integrationRole,
        requestParameters: {
          'integration.request.path.id': 'method.request.path.id',
        },
        requestTemplates: {
          'application/json': JSON.stringify({
            TableName: ddbTable.tableName,
            KeyConditionExpression: 'actieId = :v1',
            ExpressionAttributeValues: {
              ':v1': { S: "$input.params('actieId')" },
            },
          }),
        },
        integrationResponses: [{ statusCode: '200' }],
      },
    });
    const actieIdRoute = verwerkingsactiesRoute.addResource('{actieId}');
    actieIdRoute.addMethod('GET', dynamoQueryIntegration, {
      apiKeyRequired: true,
      methodResponses: [{ statusCode: '200' }],
      requestParameters: {
        'method.request.path.id': true,
      },
    });

    // PUT Integration to DynamoDb
    const dynamoPutIntegration = new AwsIntegration({
      service: 'dynamodb',
      action: 'PutItem',
      options: {
        passthroughBehavior: PassthroughBehavior.WHEN_NO_TEMPLATES,
        credentialsRole: integrationRole,
        requestParameters: {
          'integration.request.path.id': 'method.request.path.id',
        },
        requestTemplates: {
          'application/json': JSON.stringify({
            TableName: ddbTable.tableName,
            Item: {
              actieId: { S: "$input.path('actieId')" },
              tijdstipRegistratie: { S: '$context.requestTime' },
            },
          }),
        },
        integrationResponses: [
          {
            statusCode: '200',
          },
        ],
      },
    });
    actieIdRoute.addMethod('PUT', dynamoPutIntegration, {
      apiKeyRequired: true,
      methodResponses: [{ statusCode: '200' }],
      requestParameters: {
        'method.request.path.id': true,
      },
    });

    // DELETE Integration with DynamoDb
    const dynamoDeleteIntegration = new AwsIntegration({
      service: 'dynamodb',
      action: 'DeleteItem',
      options: {
        passthroughBehavior: PassthroughBehavior.WHEN_NO_TEMPLATES,
        credentialsRole: integrationRole,
        requestParameters: {
          'integration.request.path.id': 'method.request.path.id',
        },
        requestTemplates: {
          'application/json': JSON.stringify({
            TableName: ddbTable.tableName,
            Key: {
              actieId: { S: "$input.params('actieId')" },
            },
          }),
        },
        integrationResponses: [{ statusCode: '200' }],
      },
    });
    actieIdRoute.addMethod('DELETE', dynamoDeleteIntegration, {
      apiKeyRequired: true,
      methodResponses: [{ statusCode: '200' }],
      requestParameters: {
        'method.request.path.id': true,
      },
    });
  }
}
