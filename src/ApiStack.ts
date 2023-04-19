import {
  Stack,
  aws_apigateway as ApiGateway,
  aws_lambda as Lambda,
  aws_iam as IAM,
  aws_ssm as SSM,
} from 'aws-cdk-lib';
import { ApiKeySourceType, AwsIntegration, PassthroughBehavior, Resource } from 'aws-cdk-lib/aws-apigateway';
import { ITable, Table } from 'aws-cdk-lib/aws-dynamodb';
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
    const ddbTable = Table.fromTableArn(this, 'verwerkingen-api-dynamo-table', SSM.StringParameter.valueForStringParameter(this, Statics.ssmName_verwerkingenTableArn));
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
      ],
      resources: [
        ddbTable.tableArn,
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
    this.addDeleteMethod(integrationRole, ddbTable, actieIdRoute);
    this.addPutMethod(integrationRole, actieIdRoute);
    this.addGetMethod(integrationRole, ddbTable, actieIdRoute);

    // Create API Key and add a new usage plan
    this.addUsagePlan();

  }

  /**
   * GET Integration with DynamoDb
   * @param integrationRole
   * @param ddbTable
   * @param actieIdRoute
   */
  private addGetMethod(integrationRole: Role, ddbTable: ITable, actieIdRoute: Resource) {
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
    actieIdRoute.addMethod('GET', dynamoQueryIntegration, {
      apiKeyRequired: true,
      methodResponses: [{ statusCode: '200' }],
      requestParameters: {
        'method.request.path.id': true,
      },
    });
  }

  /**
   * PUT Integration with DynamoDb
   * @param integrationRole
   * @param ddbTable
   * @param actieIdRoute
   */
  private addPutMethod(integrationRole: Role, actieIdRoute: Resource) {
    const reqTemplate = "{\"TableName\": \"verwerkingen-table\",\"Item\": { \"actieId\": {\"S\": \"$input.params(\'actieId\')\"},\"url\": {\"S\": \"$input.path(\'url\')\"},\"actieNaam\": {\"S\": \"$input.path(\'actieNaam\')\"},\"handelingNaam\": {\"S\": \"$input.path(\'handelingNaam\')\"},\"verwerkingId\": {\"S\": \"$input.path(\'verwerkingId\')\"},\"verwerkingNaam\": {\"S\": \"$input.path(\'verwerkingNaam\')\"},\"verwerkingsactiviteitId\": {\"S\": \"$input.path(\'verwerkingsactiviteitId\')\"},\"verwerkingsactiviteitUrl\": {\"S\": \"$input.path(\'verwerkingsactiviteitUrl\')\"},\"vertrouwelijkheid\": {\"S\": \"$input.path(\'vertrouwelijkheid\')\"},\"bewaartermijn\": {\"S\": \"$input.path(\'bewaartermijn\')\"},\"uitvoerder\": {\"S\": \"$input.path(\'uitvoerder\')\"},\"systeem\": {\"S\": \"$input.path(\'systeem\')\"},\"gebruiker\": {\"S\": \"$input.path(\'gebruiker\')\"},\"gegevensbron\": {\"S\": \"$input.path(\'gegevensbron\')\"},\"soortAfnemerId\": {\"S\": \"$input.path(\'soortAfnemerId\')\"},\"afnemerId\": {\"S\": \"$input.path(\'afnemerId\')\"},\"verwerkingsactiviteitIdAfnemer\": {\"S\": \"$input.path(\'verwerkingsactiviteitIdAfnemer\')\"},\"verwerkingsactiviteitUrlAfnemer\": {\"S\": \"$input.path(\'verwerkingsactiviteitUrlAfnemer\')\"},\"verwerkingIdAfnemer\": {\"S\": \"$input.path(\'verwerkingIdAfnemer\')\"},\"tijdstip\": {\"S\": \"$input.path(\'tijdstip\')\"},\"tijdstipRegistratie\": {\"S\": \"$context.requestTime\"},\"verwerkteObjecten\": { #set($inputroot = $input.path(\"$\"))\"L\":[#foreach($object in $inputroot.verwerkteObjecten) {\"M\" : {\"objecttype\": { \"S\": \"$object.objecttype\" },\"soortObjectId\": { \"S\": \"$object.soortObjectId\" },\"objectId\": { \"S\": \"$object.objectId\" },\"betrokkenheid\": { \"S\": \"$object.betrokkenheid\" },\"verwerkteSoortenGegevens\": { \"L\": [#foreach($sobject in $object.verwerkteSoortenGegevens) {\"M\": {\"soortGegeven\": { \"S\": \"$sobject.soortGegeven\" }}}#if($foreach.hasNext),#end#end] }}}#if($foreach.hasNext),#end#end] }}}";

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
          'application/json': reqTemplate,
          // 'application/json': JSON.stringify({
          //   TableName: ddbTable.tableName,
          //   Item: {
          //     actieId: { S: "$input.params('actieId')" },
          //     url: { S: "$input.path('url')" },
          //     actieNaam: { S: "$input.path('actieNaam')" },
          //     handelingNaam: { S: "$input.path('handelingNaam')" },
          //     verwerkingId: { S: "$input.path('verwerkingId')" },
          //     verwerkingNaam: { S: "$input.path('verwerkingNaam')" },
          //     verwerkingsactiviteitId: { S: "$input.path('verwerkingsactiviteitId')" },
          //     verwerkingsactiviteitUrl: { S: "$input.path('verwerkingsactiviteitUrl')" },
          //     vertrouwelijkheid: { S: "$input.path('vertrouwelijkheid')" },
          //     bewaartermijn: { S: "$input.path('bewaartermijn')" },
          //     uitvoerder: { S: "$input.path('uitvoerder')" },
          //     systeem: { S: "$input.path('systeem')" },
          //     gebruiker: { S: "$input.path('gebruiker')" },
          //     gegevensbron: { S: "$input.path('gegevensbron')" },
          //     soortAfnemerId: { S: "$input.path('soortAfnemerId')" },
          //     afnemerId: { S: "$input.path('afnemerId')" },
          //     verwerkingsactiviteitIdAfnemer: { S: "$input.path('verwerkingsactiviteitIdAfnemer')" },
          //     verwerkingsactiviteitUrlAfnemer: { S: "$input.path('verwerkingsactiviteitUrlAfnemer')" },
          //     verwerkingIdAfnemer:{ S: "$input.path('verwerkingIdAfnemer')" },
          //     tijdstip: { S: "$input.path('tijdstip')" },
          //     tijdstipRegistratie: { S: '$context.requestTime' },
          //     verwerkteObjecten: '{ #set($inputroot = $input.path("$"))"L":[#foreach($object in $inputroot.verwerkteObjecten) {"M" : {"objecttype": { "S": "$object.objecttype" },"soortObjectId": { "S": "$object.soortObjectId" },"objectId": { "S": "$object.objectId" },"betrokkenheid": { "S": "$object.betrokkenheid" },"verwerkteSoortenGegevens": { "L": [#foreach($sobject in $object.verwerkteSoortenGegevens) {"M": {"soortGegeven": { "S": "$sobject.soortGegeven" }}}#if($foreach.hasNext),#end#end] }}}#if($foreach.hasNext),#end#end] }'
          //   },
          // }),
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
  }

  /**
   * DELETE Integration with DynamoDb
   * @param integrationRole
   * @param ddbTable
   * @param actieIdRoute
   */
  private addDeleteMethod(integrationRole: Role, ddbTable: ITable, actieIdRoute: Resource) {
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