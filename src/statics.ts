export abstract class Statics {

  /**
   * Project name.
   */
  static readonly projectName: string = 'verwerkingenlogging';

  /**
   * DynamoDB table name for verwerkingen.
   */
  static readonly verwerkingenTableName: string = 'verwerkingen-table';

  /**
   * DynamoDB table arn (parameter).
   */
  static readonly ssmName_verwerkingenTableArn: string = '/cdk/verwerkingenlogging/verwerkingen-table-arn';

  /**
   * DynamoDB index name for objecttypesoortObjectIdobjectId.
   */
  static readonly verwerkingenTableIndex_ObjecttypesoortObjectIdobjectId: string = 'objecttypesoortObjectIdobjectId-index';

  /**
   * DynamoDB index name for verwerkingId.
   */
  static readonly verwerkingenTableIndex_verwerkingId: string = 'verwerkingId-index';

  /**
   * S3 Backup Bucket name for verwerkingen.
   */
  static readonly verwerkingenS3BackupBucketName: string = 'verwerkingen-backup-bucket';

  /**
   * S3 Backup Bucket arn (parameter).
   */
  static readonly ssmName_verwerkingenS3BackupBucketArn: string = '/cdk/verwerkingenlogging/verwerkingen-s3-backup-bucket-arn';

  /**
   * Codestar connection ARN to connect to GitHub.
   */
  static readonly connectionArn: string = 'arn:aws:codestar-connections:eu-west-1:418648875085:connection/4f647929-c982-4f30-94f4-24ff7dbf9766';

  /**
   * API Gateway name for verwerkingen.
   */
  static readonly verwerkingenApiName: 'verwerkingen-api';
}