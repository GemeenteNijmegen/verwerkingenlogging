import {
  Stack,
  aws_apigateway as ApiGateway,
  aws_lambda as Lambda,
  aws_iam as IAM,
} from 'aws-cdk-lib';
import { ApiKeySourceType } from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { Statics } from './statics';

/**
 * Database Stack responsible for creating the verwerkingen API Gateway and all other related services.
 */
export class ApiStack extends Stack {

  /**
    * API Gateway for verwerkingenlogging.
    */
  verwerkingenAPI: ApiGateway.RestApi;

  /**
   * Lambda function attached to routes within the verwerkingen API Gateway.
   */
  verwerkingenLambdaFunction: Lambda.Function;

  /**
   * Lambda integration to attach to several routes within the verwerkingen API Gateway.
   */
  verwerkingenLambdaIntegration: ApiGateway.LambdaIntegration;

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

    // Create Lambda & Grant API Gateway permission to invoke the Lambda function.
    this.verwerkingenLambdaFunction = new Lambda.Function(this, 'verwerkingen-lambda-function', {
      code: Lambda.Code.fromAsset('src/VerwerkingenLambdaFunction'),
      handler: 'index.handler',
      runtime: Lambda.Runtime.PYTHON_3_9,
      environment: {
        DYNAMO_TABLE_NAME: Statics.verwerkingenTableName,
      },
    });
    this.verwerkingenLambdaFunction.grantInvoke(new IAM.ServicePrincipal('apigateway.amazonaws.com'));
    this.verwerkingenLambdaFunction.addToRolePolicy(new IAM.PolicyStatement({
      effect: IAM.Effect.ALLOW,
      actions: [
        'dynamodb:PutItem',
        'dynamodb:DeleteItem',
        'dynamodb:GetItem',
        'dynamodb:Scan',
        'dynamodb:UpdateItem',
        'dynamodb:Query',
      ],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/` + Statics.verwerkingenTableName,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/` + Statics.verwerkingenTableName + '/index/' + Statics.verwerkingenTableIndex_ObjecttypesoortObjectIdobjectId,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/` + Statics.verwerkingenTableName + '/index/' + Statics.verwerkingenTableIndex_verwerkingId,
      ],
    }));

    // Create Integration & Attach Lambda to API Gateway routes.
    this.verwerkingenLambdaIntegration = new ApiGateway.LambdaIntegration(this.verwerkingenLambdaFunction);

    // Route: /verwerkingsacties
    const verwerkingsactiesRoute = this.verwerkingenAPI.root.addResource('verwerkingsacties');
    verwerkingsactiesRoute.addMethod('POST', this.verwerkingenLambdaIntegration, { apiKeyRequired: true });
    verwerkingsactiesRoute.addMethod('GET', this.verwerkingenLambdaIntegration, { apiKeyRequired: true });
    verwerkingsactiesRoute.addMethod('PATCH', this.verwerkingenLambdaIntegration, { apiKeyRequired: true });

    // Route: /verwerkingsacties/{actieId}
    const actieIdRoute = verwerkingsactiesRoute.addResource('{actieId}');
    actieIdRoute.addMethod('DELETE', this.verwerkingenLambdaIntegration, { apiKeyRequired: true });
    actieIdRoute.addMethod('PUT', this.verwerkingenLambdaIntegration, { apiKeyRequired: true });
    actieIdRoute.addMethod('GET', this.verwerkingenLambdaIntegration, { apiKeyRequired: true });

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