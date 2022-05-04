import {
  Stack,
  aws_apigateway as ApiGateway,
  aws_lambda as Lambda,
} from 'aws-cdk-lib';
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';
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
    this.verwerkingenLambdaFunction.grantInvoke(new ServicePrincipal('apigateway.amazonaws.com'));

    // Create Integration & Attach Lambda to API Gateway routes.
    this.verwerkingenLambdaIntegration = new ApiGateway.LambdaIntegration(this.verwerkingenLambdaFunction);

    // Route: /verwerkingsacties
    const verwerkingsactiesRoute = this.verwerkingenAPI.root.addResource('verwerkingsacties');
    verwerkingsactiesRoute.addMethod('POST', this.verwerkingenLambdaIntegration);
    verwerkingsactiesRoute.addMethod('GET', this.verwerkingenLambdaIntegration);
    verwerkingsactiesRoute.addMethod('PATCH', this.verwerkingenLambdaIntegration);

    // Route: /verwerkingsacties/{actieId}
    const actieIdRoute = verwerkingsactiesRoute.addResource('{actieId}');
    actieIdRoute.addMethod('DELETE', this.verwerkingenLambdaIntegration);
    actieIdRoute.addMethod('PUT', this.verwerkingenLambdaIntegration);
    actieIdRoute.addMethod('GET', this.verwerkingenLambdaIntegration);
  }
}