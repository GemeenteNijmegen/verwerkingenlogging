export abstract class Statics {

  /**
   * Project name.
   */
  static readonly projectName: string = 'verwerkingenlogging';

  // Environments

  static readonly gnBuildEnvironment = {
    account: '836443378780',
    region: 'eu-central-1',
  };

  static readonly gnVerwerkingenloggingAccp = {
    account: '649781704230',
    region: 'eu-central-1',
  };

  static readonly gnVerwerkingenloggingProd = {
    account: '887474129159',
    region: 'eu-central-1',
  };

  /**
   * Codestar connection ARN to connect to GitHub.
   */
  static readonly gnBuildCodeStarConnectionArn = 'arn:aws:codestar-connections:eu-central-1:836443378780:connection/9d20671d-91bc-49e2-8680-59ff96e2ab11';

  /**
   * DynamoDB table name for verwerkingen.
   */
  static readonly verwerkingenTableName: string = 'verwerkingen-table-v4';

  /**
   * DynamoDB table arn (parameter).
   */
  static readonly ssmName_verwerkingenTableArn: string = '/cdk/verwerkingenlogging/verwerkingen-table-arn';

  /**
   * DynamoDB index name for objectTypeSoortId.
   */
  static readonly verwerkingenTableIndex_objectTypeSoortId: string = 'objectTypeSoortId-index';

  /**
   * DynamoDB index name for verwerkingId.
   */
  static readonly verwerkingenTableIndex_verwerkingId: string = 'verwerkingId-index';

  /**
   * S3 Backup Bucket name for verwerkingen.
   */
  static readonly ssmName_verwerkingenS3BackupBucketName: string = '/cdk/verwerkingenlogging/verwerkingen-s3-backup-bucket-name';

  /**
   * S3 Backup Bucket arn (parameter).
   */
  static readonly ssmName_verwerkingenS3BackupBucketArn: string = '/cdk/verwerkingenlogging/verwerkingen-s3-backup-bucket-arn';

  /**
   * API Gateway name for verwerkingen.
   */
  static readonly verwerkingenApiName: 'verwerkingen-api';

  /**
   * IAM Account ID.
   */
  static readonly iamAccountId: string = '098799052470';

  /**
   * IAM Read Only Role arn (parameter).
   */
  static readonly ssmName_verwerkingenReadOnlyRoleArn: string = '/cdk/verwerkingenlogging/verwerkingen-read-only-role-arn';

  /**
   * SQS Queue Url
   */
  static readonly ssmName_verwerkingenSQSqueueUrl: string = '/cdk/verwerkingenlogging/verwerkingen-sqs-queue-url';

  /**
   * SQS Queue Arn
   */
  static readonly ssmName_verwerkingenSQSqueueArn: string = '/cdk/verwerkingenlogging/verwerkingen-sqs-queue-arn';

  /**
   * Arn for the pyton lambda layer
   */
  static readonly ssmName_pythonLambdaLayerArn: string = '/cdk/verwerkingenlogging/python-lambda-layer-arn';


  // DNS Hosted zone ssm
  static readonly accountRootHostedZoneId: string = '/gemeente-nijmegen/account/hostedzone/id';
  static readonly accountRootHostedZoneName: string = '/gemeente-nijmegen/account/hostedzone/name';
  static readonly ssmName_projectHostedZoneId: string = '/cdk/verwerkingenlogging/hostedZone/id';
  static readonly ssmName_projectHostedZoneName: string = '/cdk/verwerkingenlogging/hostedZone/name';

  static readonly subdomain = (hostedzoneName: string) => `api.${hostedzoneName}`;
}