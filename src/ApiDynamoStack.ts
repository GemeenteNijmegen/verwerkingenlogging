import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AwsIntegration, RestApi, PassthroughBehavior } from 'aws-cdk-lib/aws-apigateway'
import { Table, BillingMode, AttributeType } from 'aws-cdk-lib/aws-dynamodb'
import { Role, ServicePrincipal} from 'aws-cdk-lib/aws-iam'

export class ApiDynamoStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // DynamoDB Table
    const ddbTable = new Table(this, 'verwerkingen-api-dynamo-table', {
      partitionKey: {name:'actieId', type: AttributeType.STRING},
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // RestApi
    const restApi = new RestApi(this, 'verwerkingen-api-dynamo-rest-api')
    const verwerkingsactiesRoute = restApi.root.addResource('verwerkingsacties')

    // Allow the RestApi to access DynamoDb by assigning this role to the integration
    const integrationRole = new Role(this, 'verwerkingen-integration-role', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
    })
    ddbTable.grantReadWriteData(integrationRole)

    // POST Integration to DynamoDb
    const dynamoPutIntegration = new AwsIntegration({
      service: 'dynamodb',
      action: 'PutItem',
      options: {
        passthroughBehavior: PassthroughBehavior.WHEN_NO_TEMPLATES,
        credentialsRole: integrationRole,
        requestTemplates: {
          'application/json': JSON.stringify({
              'TableName': ddbTable.tableName,
              'Item': {
                'actieId': {'S': "$context.requestId"},
                'actieNaam': {'S': "$input.path('$.actieNaam')"},
              }
          }),
        },
        integrationResponses: [
          {
            statusCode: '200',
            responseTemplates: {
              'application/json': JSON.stringify({})
            }
          }
        ],
      }
    })
    verwerkingsactiesRoute.addMethod('POST', dynamoPutIntegration, {
      methodResponses: [{statusCode: '200'}],
    })

    // GET Integration with DynamoDb
    // const dynamoQueryIntegration = new AwsIntegration({
    //   service: 'dynamodb',
    //   action: 'Query',
    //   options: {
    //     passthroughBehavior: PassthroughBehavior.WHEN_NO_TEMPLATES,
    //     credentialsRole: integrationRole,
    //     requestParameters: {
    //       'integration.request.path.id': 'method.request.path.id'
    //     },
    //     requestTemplates: {
    //       'application/json': JSON.stringify({
    //           'TableName': ddbTable.tableName,
    //           'KeyConditionExpression': 'pk = :v1',
    //           'ExpressionAttributeValues': {
    //               ':v1': {'S': "$input.params('id')"}
    //           }
    //       }),
    //     },
    //     integrationResponses: [{ statusCode: '200' }],
    //   }
    // })
    // verwerkingsactiesRoute.addMethod('GET', dynamoQueryIntegration, {
    //   methodResponses: [{ statusCode: '200' }],
    //   requestParameters: {
    //     'method.request.path.id': true
    //   }
    // })
  }
}
