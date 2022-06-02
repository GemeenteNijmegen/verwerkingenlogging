import {
  RemovalPolicy,
  Stack,
  Duration,
  aws_dynamodb as DynamoDB,
  aws_ssm as SSM,
  aws_s3 as S3,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Statics } from './statics';

/**
 * Database Stack responsible for creating the DynamoDB Table and all other related services.
 */
export class DatabaseStack extends Stack {

  /**
     * DynamoDB table for logging verwerkingen.
     */
  verwerkingenTable: DynamoDB.Table;

  /**
   * S3 Backup Bucket to store (backup) any incoming verwerkingenlog.
   */
  verwerkingenS3BackupBucket: S3.Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Create the DynamoDB verwerkingen table.
    this.verwerkingenTable = new DynamoDB.Table(this, 'verwerkingen-table', {
      partitionKey: { name: 'actieId', type: DynamoDB.AttributeType.STRING },
      billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
      tableName: Statics.verwerkingenTableName,
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.RETAIN,
      encryption: DynamoDB.TableEncryption.AWS_MANAGED,
    });

    // Add DynamoDB table ARN to parameter store.
    new SSM.StringParameter(this, 'ssm_verwerkingen-table-arn', {
      stringValue: this.verwerkingenTable.tableArn,
      parameterName: Statics.ssmName_verwerkingenTableArn,
    });

    // Add Global Secondary Indexes to the verwerkingen table.
    this.verwerkingenTable.addGlobalSecondaryIndex({
      indexName: Statics.verwerkingenTableIndex_ObjecttypesoortObjectIdobjectId,
      partitionKey: { name: 'objecttypesoortObjectIdobjectId', type: DynamoDB.AttributeType.STRING },
    });

    this.verwerkingenTable.addGlobalSecondaryIndex({
      indexName: Statics.verwerkingenTableIndex_verwerkingId,
      partitionKey: { name: 'verwerkingId', type: DynamoDB.AttributeType.STRING },
    });


    // Create S3 Backup Bucket
    this.verwerkingenS3BackupBucket = new S3.Bucket(this, 'verwerkingen-s3-backup-bucket', {
      bucketName: Statics.verwerkingenS3BackupBucketName,
      blockPublicAccess: S3.BlockPublicAccess.BLOCK_ALL,
      encryption: S3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          enabled: true,
          expiration: Duration.days(90),
        },
      ],
    });

    // Add S3 Backup Bucket ARN to parameter store.
    new SSM.StringParameter(this, 'ssm_verwerkingen-s3-backup-bucket-arn', {
      stringValue: this.verwerkingenS3BackupBucket.bucketArn,
      parameterName: Statics.ssmName_verwerkingenS3BackupBucketArn,
    });

  }
}