import {
  RemovalPolicy,
  Stack,
  Duration,
  aws_dynamodb as DynamoDB,
  aws_ssm as SSM,
  aws_s3 as S3,
  aws_iam as IAM,
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

  /**
   * IAM Read Only Role to view DynamoDB table, S3 Bucket, and CloudWatch logging.
   */
  verwerkingenReadOnlyRole: IAM.Role;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Create the DynamoDB verwerkingen table.
    this.verwerkingenTable = new DynamoDB.Table(this, 'verwerkingen-table-v2', {
      partitionKey: { name: 'actieId', type: DynamoDB.AttributeType.STRING },
      sortKey: { name: 'objectTypeSoortId', type: DynamoDB.AttributeType.STRING },
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

    this.verwerkingenTable.addGlobalSecondaryIndex({
      indexName: Statics.verwerkingenTableIndex_verwerkingId,
      partitionKey: { name: 'verwerkingId', type: DynamoDB.AttributeType.STRING },
    });


    // Create S3 Backup Bucket
    this.verwerkingenS3BackupBucket = new S3.Bucket(this, 'verwerkingen-s3-backup-bucket', {
      bucketName: Statics.verwerkingenS3BackupBucketName,
      blockPublicAccess: S3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      eventBridgeEnabled: true,
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


    // Assumable read only role to view DynamoDB table, S3 Bucket and CloudWatch logging.
    this.verwerkingenReadOnlyRole = new IAM.Role(this, 'verwerkingen-read-only-role', {
      roleName: 'verwerkingen-full-read',
      description: 'Read-only role for Verwerkingenlogging with access to DynamoDB, S3 and CloudWatch.',
      assumedBy: new IAM.PrincipalWithConditions(
        new IAM.AccountPrincipal(Statics.iamAccountId), //IAM account
        {
          Bool: {
            'aws:MultiFactorAuthPresent': true,
          },
        },
      ),
      managedPolicies: [
        IAM.ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBReadOnlyAccess'),
        IAM.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'),
        IAM.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchReadOnlyAccess'),
      ],
    });

    // Add Read Only Role ARN to parameter store.
    new SSM.StringParameter(this, 'ssm_verwerkingen-read-only-role-arn', {
      stringValue: this.verwerkingenReadOnlyRole.roleArn,
      parameterName: Statics.ssmName_verwerkingenReadOnlyRoleArn,
    });
  }
}