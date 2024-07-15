import {
  aws_apigateway as ApiGateway,
  aws_iam as IAM,
  aws_ssm as SSM,
  Stack,
  StackProps,
  aws_route53 as route53,
  aws_route53_targets as targets,
} from 'aws-cdk-lib';
import { ApiKeySourceType } from 'aws-cdk-lib/aws-apigateway';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { ITable, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { IKey, Key } from 'aws-cdk-lib/aws-kms';
import { ARecord, AaaaRecord, HostedZone, IHostedZone } from 'aws-cdk-lib/aws-route53';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { ApiFunction } from './ApiFunction';
import { Configurable } from './Configuration';
import { Statics } from './statics';

export interface ApiStackProps extends StackProps, Configurable {}

/**
 * Database Stack responsible for creating the verwerkingen API Gateway and all other related services.
 */
export class ApiStack extends Stack {

  /**
   * API Gateway for verwerkingenlogging.
   */
  declare verwerkingenAPI: ApiGateway.RestApi;


  declare inzageAPI: ApiGateway.RestApi;

  /**
   * Lambda function attached to routes within the verwerkingen API Gateway.
   * Generating the actieId, URL and verwerktObjectId on POST request.
   * Returning a direct response.
   */
  declare verwerkingenGenLambdaFunction: ApiFunction;

  /**
   * Lambda integration to attach routes (POST/PATCH) within the verwerkingen API Gateway.
   */
  declare verwerkingenGenLambdaIntegration: ApiGateway.LambdaIntegration;

  /**
 * Lambda function attached to GET /verwerkingsacties route within the verwerkingen API Gateway.
 */
  declare verwerkingenRecLambdaFunction: ApiFunction;

  /**
 * Lambda integration to attach GET /verwerkingsacties route within the verwerkingen API Gateway.
 */
  declare verwerkingenRecLambdaIntegration: ApiGateway.LambdaIntegration;

  /**
 * Lambda function attached to GET /verwerkte-objecten route within the inzage API Gateway.
 */
  declare inzageLambdaFunction: ApiFunction;

  /**
   * Lambda integration to attach GET /verwerkte-objecten route within the inzage API Gateway.
   */
  declare inzageLambdaIntegration: ApiGateway.LambdaIntegration;


  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const hostedzone = this.hostedzone();
    const certificate = this.certificate(hostedzone);
    // Create the API Gateway (REST)
    this.verwerkingenAPI = new ApiGateway.RestApi(this, 'verwerkingen-api', {
      restApiName: Statics.verwerkingenApiName,
      description: 'Verwerkingen API Gateway (REST)',
      apiKeySourceType: ApiKeySourceType.HEADER,
      domainName: {
        certificate: certificate,
        domainName: hostedzone.zoneName,
      },
    });

    const inzageCertficate = this.inzageCertificate(hostedzone);
    // Create the Inzage API Gateway (REST)
    this.inzageAPI = new ApiGateway.RestApi(this, 'inzage-api', {
      restApiName: Statics.inzageApiName,
      description: 'Inzage API Gateway (REST)',
      apiKeySourceType: ApiKeySourceType.HEADER,
      domainName: {
        certificate: inzageCertficate,
        domainName: 'inzage-' + hostedzone.zoneName,
      },
    });

    this.setupDnsRecords(hostedzone);

    // Allow the RestApi to access DynamoDb by assigning this role to the integration
    const integrationRole = new Role(this, 'verwerkingen-integration-role', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
    });

    // Import DynamoDB table (from DatabaseStack)
    // Grant DynamoDB table Read-Write permissions to integration role
    const ddbTable = Table.fromTableArn(this, 'verwerkingen-api-dynamo-table-v4', SSM.StringParameter.valueForStringParameter(this, Statics.ssmName_verwerkingenTableArn));
    ddbTable.grantReadWriteData(integrationRole);

    // Verwerkingen API
    this.initializeVerwerkingenLambdaIntegrations(props, ddbTable, hostedzone);

    // Inzage API
    this.initializeInzageLambdaIntegrations(props, ddbTable, hostedzone);

    // Create API Key and add a new usage plan
    this.addUsagePlan();

  }

  private initializeVerwerkingenLambdaIntegrations(props: ApiStackProps, ddbTable: ITable, hostedzone: route53.IHostedZone ) {

    // Setup lambdas
    const verboseLogs = props.configuration.enableVerboseAndSensitiveLogging;
    const keyArn = SSM.StringParameter.valueForStringParameter(this, Statics.ssmName_dynamodbKmsKeyArn);
    const key = Key.fromKeyArn(this, 'key', keyArn);
    this.verwerkingenGenLambdaFunction = this.setupVerwerkingenGenLambdaFunction(ddbTable, key, hostedzone.zoneName, verboseLogs);
    this.verwerkingenRecLambdaFunction = this.setupVerwerkingenRecLambdaFunction(ddbTable, key, verboseLogs);

    // Create Integrations
    this.verwerkingenGenLambdaIntegration = new ApiGateway.LambdaIntegration(this.verwerkingenGenLambdaFunction.lambda);
    this.verwerkingenRecLambdaIntegration = new ApiGateway.LambdaIntegration(this.verwerkingenRecLambdaFunction.lambda);

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

  }

  private initializeInzageLambdaIntegrations(props: ApiStackProps, ddbTable: ITable, _hostedzone: route53.IHostedZone) {

    // Setup lambdas
    const verboseLogs = props.configuration.enableVerboseAndSensitiveLogging;
    const keyArn = SSM.StringParameter.valueForStringParameter(this, Statics.ssmName_dynamodbKmsKeyArn);
    const key = Key.fromKeyArn(this, 'key-inzage-lambda-integration', keyArn);
    this.inzageLambdaFunction = this.setupInzageLambdaFunction(ddbTable, key, verboseLogs);

    // Create Integrations
    this.inzageLambdaIntegration = new ApiGateway.LambdaIntegration(this.inzageLambdaFunction.lambda);

    // Route: /verwerkte-objecten
    const verwerkteObjectenRoute = this.inzageAPI.root.addResource('verwerkte-objecten');
    verwerkteObjectenRoute.addMethod('GET', this.inzageLambdaIntegration, { apiKeyRequired: true });

    // Route: /verwerkte-objecten/{verwerktObjectId}
    const verwerktObjectIdRoute = verwerkteObjectenRoute.addResource('{verwerkteObjectId}');
    verwerktObjectIdRoute.addMethod('GET', this.inzageLambdaIntegration, { apiKeyRequired: true });
  }

  private setupInzageLambdaFunction(table: ITable, key: IKey, enableVerboseAndSensitiveLogging?: boolean): ApiFunction {
    const lambda = new ApiFunction(this, 'inzage-api-function', {
      description: 'Responsible for providing verwerkingen on inzage request',
      code: 'src/api/InzageLambdaFunction',
      pythonLayerArn: StringParameter.valueForStringParameter(this, Statics.ssmName_pythonLambdaLayerArn),
      environment: {
        DYNAMO_TABLE_NAME: table.tableName,
        ENABLE_VERBOSE_AND_SENSITIVE_LOGGING: enableVerboseAndSensitiveLogging ? 'true' : 'false',
      },
    });
    key.grantEncryptDecrypt(lambda.lambda);
    lambda.lambda.grantInvoke(new IAM.ServicePrincipal('apigateway.amazonaws.com'));
    lambda.lambda.addToRolePolicy(new IAM.PolicyStatement({
      effect: IAM.Effect.ALLOW,
      actions: [
        'dynamodb:DescribeTable',
        'dynamodb:Query',
        'dynamodb:GetItem',
        'dynamodb:Scan',
      ],
      resources: [
        table.tableArn,
        table.tableArn + '/index/' + Statics.verwerkingenTableIndex_objectTypeSoortId, // Is equal to old verwerkingen static, no change required
        table.tableArn + '/index/' + Statics.verwerkingenTableIndex_verwerkingId, // Is equal to old verwerkingen static, no change required
      ],
    }));
    new StringParameter(this, 'inzage-log-group-arn-ssm', {
      stringValue: lambda.lambda.logGroup.logGroupArn,
      parameterName: Statics.ssmName_inzageLambdaLogGroupArn,
    });
    return lambda;
  }

  /**
   * Lambda for forwaring to queue and sync responses
   * @param table
   * @param enableVerboseAndSensitiveLogging
   */
  private setupVerwerkingenGenLambdaFunction(table: ITable, key: IKey, apiBaseUrl: string, enableVerboseAndSensitiveLogging?: boolean) {
    // Create Lambda & Grant API Gateway permission to invoke the Lambda function.

    const lambda = new ApiFunction(this, 'generation', {
      description: 'Receive calls and place on queue',
      code: 'src/api/GenLambdaFunction',
      pythonLayerArn: StringParameter.valueForStringParameter(this, Statics.ssmName_pythonLambdaLayerArn),
      environment: {
        S3_BACKUP_BUCKET_NAME: SSM.StringParameter.valueForStringParameter(this, Statics.ssmName_verwerkingenS3BackupBucketName),
        SQS_URL: SSM.StringParameter.valueForStringParameter(this, Statics.ssmName_verwerkingenSQSqueueUrl),
        DYNAMO_TABLE_NAME: table.tableName,
        ENABLE_VERBOSE_AND_SENSITIVE_LOGGING: enableVerboseAndSensitiveLogging ? 'true' : 'false',
        API_BASE_URL: apiBaseUrl,
      },
    });
    key.grantEncryptDecrypt(lambda.lambda);
    lambda.lambda.grantInvoke(new IAM.ServicePrincipal('apigateway.amazonaws.com'));
    lambda.lambda.addToRolePolicy(new IAM.PolicyStatement({
      effect: IAM.Effect.ALLOW,
      actions: [
        's3:PutObject',
        'sqs:SendMessage',
        'dynamodb:Query',
      ],
      resources: [
        SSM.StringParameter.valueForStringParameter(this, Statics.ssmName_verwerkingenS3BackupBucketArn),
        SSM.StringParameter.valueForStringParameter(this, Statics.ssmName_verwerkingenS3BackupBucketArn) + '/*',
        SSM.StringParameter.valueForStringParameter(this, Statics.ssmName_verwerkingenSQSqueueArn),
        table.tableArn,
        table.tableArn + '/index/' + Statics.verwerkingenTableIndex_objectTypeSoortId,
        table.tableArn + '/index/' + Statics.verwerkingenTableIndex_verwerkingId,
      ],
    }));
    new StringParameter(this, 'gen-log-group-arn-ssm', {
      stringValue: lambda.lambda.logGroup.logGroupArn,
      parameterName: Statics.ssmName_genLambdaLogGroupArn,
    });
    return lambda;
  }

  /**
   * Lambda for processing get and delete verwerkingsacties
   * @param table
   * @param enableVerboseAndSensitiveLogging
   * @returns
   */
  private setupVerwerkingenRecLambdaFunction(table: ITable, key: IKey, enableVerboseAndSensitiveLogging?: boolean) {
    const lambda = new ApiFunction(this, 'receiver', {
      description: 'Responsible for get and delete verwerkingsacties',
      code: 'src/api/RecLambdaFunction',
      pythonLayerArn: StringParameter.valueForStringParameter(this, Statics.ssmName_pythonLambdaLayerArn),
      environment: {
        DYNAMO_TABLE_NAME: table.tableName,
        ENABLE_VERBOSE_AND_SENSITIVE_LOGGING: enableVerboseAndSensitiveLogging ? 'true' : 'false',
      },
    });
    key.grantEncryptDecrypt(lambda.lambda);
    lambda.lambda.grantInvoke(new IAM.ServicePrincipal('apigateway.amazonaws.com'));
    lambda.lambda.addToRolePolicy(new IAM.PolicyStatement({
      effect: IAM.Effect.ALLOW,
      actions: [
        'dynamodb:Query',
        'dynamodb:PutItem',
      ],
      resources: [
        table.tableArn,
        table.tableArn + '/index/' + Statics.verwerkingenTableIndex_objectTypeSoortId,
        table.tableArn + '/index/' + Statics.verwerkingenTableIndex_verwerkingId,
      ],
    }));
    new StringParameter(this, 'rec-log-group-arn-ssm', {
      stringValue: lambda.lambda.logGroup.logGroupArn,
      parameterName: Statics.ssmName_recLambdaLogGroupArn,
    });
    return lambda;
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
    const externalUserKey = this.verwerkingenAPI.addApiKey('verwerkingen-api-key-external-user');
    plan.addApiKey(key);
    plan.addApiKey(externalUserKey);

    // Add Stage to Plan
    plan.addApiStage({
      stage: this.verwerkingenAPI.deploymentStage,
    });
  }

  private hostedzone() {
    return HostedZone.fromHostedZoneAttributes(this, 'hostedzone', {
      hostedZoneId: StringParameter.valueForStringParameter(this, Statics.ssmName_projectHostedZoneId),
      zoneName: StringParameter.valueForStringParameter(this, Statics.ssmName_projectHostedZoneName),
    });
  }

  private certificate(hostedzone: IHostedZone) {
    const cert = new Certificate(this, 'cert', {
      domainName: hostedzone.zoneName,
      validation: CertificateValidation.fromDns(hostedzone),
    });
    return cert;
  }

  private inzageCertificate(hostedZone: IHostedZone) {
    const cert = new Certificate(this, 'inzager-cert', {
      domainName: 'inzage- ' + hostedZone.zoneName,
      validation: CertificateValidation.fromDns(hostedZone),
    });
    return cert;
  }

  private setupDnsRecords(hostedzone: IHostedZone) {

    new ARecord(this, 'a-record', {
      target: route53.RecordTarget.fromAlias(new targets.ApiGateway(this.verwerkingenAPI)),
      zone: hostedzone,
      comment: 'A-record for API gateway',
    });

    new AaaaRecord(this, 'aaaa-record', {
      target: route53.RecordTarget.fromAlias(new targets.ApiGateway(this.verwerkingenAPI)),
      zone: hostedzone,
      comment: 'AAAA-record for API gateway',
    });

    new ARecord(this, 'a-record-inzage', {
      target: route53.RecordTarget.fromAlias(new targets.ApiGateway(this.inzageAPI)),
      zone: hostedzone,
      comment: 'A-record for Inzage API gateway',
    });

    new AaaaRecord(this, 'aaaa-record-inzage', {
      target: route53.RecordTarget.fromAlias(new targets.ApiGateway(this.inzageAPI)),
      zone: hostedzone,
      comment: 'AAAA-record for Inzage API gateway',
    });
  }

}