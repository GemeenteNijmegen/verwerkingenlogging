import {
  Stack,
  aws_apigateway as ApiGateway,
  aws_lambda as Lambda,
  aws_iam as IAM,
  aws_ssm as SSM,
} from 'aws-cdk-lib';
import { ApiKeySourceType } from 'aws-cdk-lib/aws-apigateway';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { Statics } from './statics';

/**
 * Database Stack responsible for creating the verwerkingen API Gateway and all other related services.
 */
export class ApiStack extends Stack {

  /**
   * API Gateway for verwerkingenlogging.
   */
  declare verwerkingenAPI: ApiGateway.RestApi;

  /**
   * Lambda function attached to routes within the verwerkingen API Gateway.
   * Generating the actieId, URL and verwerktObjectId on POST request.
   * Returning a direct response.
   */
  declare verwerkingenGenLambdaFunction: Lambda.Function;

  /**
   * Lambda integration to attach routes (POST/PATCH) within the verwerkingen API Gateway.
   */
  declare verwerkingenGenLambdaIntegration: ApiGateway.LambdaIntegration;

  /**
 * Lambda function attached to GET /verwerkingsacties route within the verwerkingen API Gateway.
 */
  declare verwerkingenRecLambdaFunction: Lambda.Function;

  /**
 * Lambda integration to attach GET /verwerkingsacties route within the verwerkingen API Gateway.
 */
  declare verwerkingenRecLambdaIntegration: ApiGateway.LambdaIntegration;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Create the API Gateway (REST).
    this.verwerkingenAPI = new ApiGateway.RestApi(this, 'verwerkingen-api', {
      restApiName: Statics.verwerkingenApiName,
      description: 'Verwerkingen API Gateway (REST)',
      apiKeySourceType: ApiKeySourceType.HEADER,
      deployOptions: {
        stageName: 'dev', //TODO make stageName dynamic.
      },
    });

    // Allow the RestApi to access DynamoDb by assigning this role to the integration
    const integrationRole = new Role(this, 'verwerkingen-integration-role', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
    });

    // Import DynamoDB table (from DatabaseStack)
    // Grant DynamoDB table Read-Write permissions to integration role
    const ddbTable = Table.fromTableArn(this, 'verwerkingen-api-dynamo-table-v2', SSM.StringParameter.valueForStringParameter(this, Statics.ssmName_verwerkingenTableArn));
    ddbTable.grantReadWriteData(integrationRole);

    // Create Lambda & Grant API Gateway permission to invoke the Lambda function.
    this.verwerkingenGenLambdaFunction = new Lambda.Function(this, 'verwerkingen-gen-lambda-function', {
      code: Lambda.Code.fromAsset('src/GenLambdaFunction'),
      handler: 'index.handler',
      runtime: Lambda.Runtime.PYTHON_3_9,
      environment: {
        S3_BACKUP_BUCKET_NAME: Statics.verwerkingenS3BackupBucketName,
        SQS_URL: SSM.StringParameter.valueForStringParameter(this, Statics.ssmName_verwerkingenSQSqueueUrl),
      },
    });
    this.verwerkingenGenLambdaFunction.grantInvoke(new IAM.ServicePrincipal('apigateway.amazonaws.com'));
    this.verwerkingenGenLambdaFunction.addToRolePolicy(new IAM.PolicyStatement({
      effect: IAM.Effect.ALLOW,
      actions: [
        's3:PutObject',
        'sqs:SendMessage',
      ],
      resources: [
        SSM.StringParameter.valueForStringParameter(this, Statics.ssmName_verwerkingenS3BackupBucketArn),
        SSM.StringParameter.valueForStringParameter(this, Statics.ssmName_verwerkingenS3BackupBucketArn) + '/*',
        SSM.StringParameter.valueForStringParameter(this, Statics.ssmName_verwerkingenSQSqueueArn),
      ],
    }));

    // Create Integration & Attach Lambda to API Gateway routes.
    this.verwerkingenGenLambdaIntegration = new ApiGateway.LambdaIntegration(this.verwerkingenGenLambdaFunction);

    // Create Lambda & Grant API Gateway permission to invoke the Lambda function.
    this.verwerkingenRecLambdaFunction = new Lambda.Function(this, 'verwerkingen-rec-lambda-function', {
      code: Lambda.Code.fromAsset('src/RecLambdaFunction'),
      handler: 'index.handler',
      runtime: Lambda.Runtime.PYTHON_3_9,
      environment: {
        DYNAMO_TABLE_NAME: ddbTable.tableName,
      },
    });
    this.verwerkingenRecLambdaFunction.grantInvoke(new IAM.ServicePrincipal('apigateway.amazonaws.com'));
    this.verwerkingenRecLambdaFunction.addToRolePolicy(new IAM.PolicyStatement({
      effect: IAM.Effect.ALLOW,
      actions: [
        'dynamodb:Query',
        'dynamodb:DeleteItem',
      ],
      resources: [
        ddbTable.tableArn,
        ddbTable.tableArn + '/index/' + Statics.verwerkingenTableIndex_objectTypeSoortId,
        ddbTable.tableArn + '/index/' + Statics.verwerkingenTableIndex_verwerkingId,
      ],
    }));

    // Create Integration & Attach Lambda to API Gateway GET /verwerkingsacties route.
    this.verwerkingenRecLambdaIntegration = new ApiGateway.LambdaIntegration(this.verwerkingenRecLambdaFunction);

    // Route: /verwerkingsacties
    const verwerkingsactiesRoute = this.verwerkingenAPI.root.addResource('verwerkingsacties');
    verwerkingsactiesRoute.addMethod('POST', this.verwerkingenGenLambdaIntegration, { apiKeyRequired: true });
    verwerkingsactiesRoute.addMethod('PATCH', this.verwerkingenGenLambdaIntegration, { apiKeyRequired: true });
    verwerkingsactiesRoute.addMethod('GET', this.verwerkingenRecLambdaIntegration, { apiKeyRequired: true });

    // Route: /verwerkingsacties/{actieId}
    const actieIdRoute = verwerkingsactiesRoute.addResource('{actieId}');
    actieIdRoute.addMethod('PUT', this.verwerkingenGenLambdaIntegration, { apiKeyRequired: true });
    actieIdRoute.addMethod('DELETE', this.verwerkingenRecLambdaIntegration, { apiKeyRequired: true });
    actieIdRoute.addMethod('GET', this.verwerkingenRecLambdaIntegration, { apiKeyRequired: true });
    // this.addDeleteMethod(integrationRole, ddbTable, actieIdRoute);
    // this.addPutMethod(integrationRole, actieIdRoute);
    // this.addGetMethod(integrationRole, ddbTable, actieIdRoute);

    // Create API Key and add a new usage plan
    this.addUsagePlan();

  }

  /**
   * Add a usage plan (a container for api keys/limits per user of the api)
   * to the API. (https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-usage-plans.html)
   * API Keys and limits are attached to a usage plan.
   */
  private addUsagePlan() {
    const plan = this.verwerkingenAPI.addUsagePlan('verwerkingen-usage-plan-throttle', {
      throttle: {
        rateLimit: 10,
        burstLimit: 10,
      },
    });

    // Create new API Key
    const key = this.verwerkingenAPI.addApiKey('verwerkingen-api-key');
    plan.addApiKey(key);

    // Add Stage to Plan
    plan.addApiStage({
      stage: this.verwerkingenAPI.deploymentStage,
    });
  }
}