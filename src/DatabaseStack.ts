import {
  RemovalPolicy,
  Stack,
  aws_dynamodb as DynamoDB,
  aws_ssm as SSM,
  aws_s3 as S3,
  aws_iam as IAM,
  StackProps,
} from 'aws-cdk-lib';
import { Key } from 'aws-cdk-lib/aws-kms';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
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

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    // Create the DynamoDB verwerkingen table.
    this.verwerkingenTable = new DynamoDB.Table(this, 'verwerkingen-table-v4', {
      partitionKey: { name: 'actieId', type: DynamoDB.AttributeType.STRING },
      sortKey: { name: 'compositeSortKey', type: DynamoDB.AttributeType.STRING },
      billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
      tableName: Statics.verwerkingenTableName,
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.RETAIN,
      encryption: DynamoDB.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.customKmsKey(),
      deletionProtection: true,
    });

    // Add DynamoDB table ARN to parameter store.
    new SSM.StringParameter(this, 'ssm_verwerkingen-table-arn', {
      stringValue: this.verwerkingenTable.tableArn,
      parameterName: Statics.ssmName_verwerkingenTableArn,
    });

    // Add Global Secondary Indexes to the verwerkingen table.
    this.verwerkingenTable.addGlobalSecondaryIndex({
      indexName: Statics.verwerkingenTableIndex_objectTypeSoortId,
      partitionKey: { name: 'objectTypeSoortId', type: DynamoDB.AttributeType.STRING },
    });

    this.verwerkingenTable.addGlobalSecondaryIndex({
      indexName: Statics.verwerkingenTableIndex_verwerkingId,
      partitionKey: { name: 'verwerkingId', type: DynamoDB.AttributeType.STRING },
    });

    this.verwerkingenTable.addGlobalSecondaryIndex({
      indexName: Statics.verwerkingenTableIndex_verwerktObjectId,
      partitionKey: { name: 'verwerktObjectId', type: DynamoDB.AttributeType.STRING },
    });

    // Create S3 Backup Bucket
    this.verwerkingenS3BackupBucket = new S3.Bucket(this, 'verwerkingen-s3-backup-bucket', {
      blockPublicAccess: S3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      eventBridgeEnabled: true,
      encryption: S3.BucketEncryption.S3_MANAGED,
      // Disabled as we want to be resiliant may something change even after 2 years
      // lifecycleRules: [
      //   {
      //     enabled: true,
      //     expiration: Duration.days(90),
      //   },
      // ],
    });

    // Add S3 Backup Bucket ARN to parameter store.
    new SSM.StringParameter(this, 'ssm_verwerkingen-s3-backup-bucket-arn', {
      stringValue: this.verwerkingenS3BackupBucket.bucketArn,
      parameterName: Statics.ssmName_verwerkingenS3BackupBucketArn,
    });

    // Add S3 Backup Bucket Name to parameter store.
    new SSM.StringParameter(this, 'ssm_verwerkingen-s3-backup-bucket-name', {
      stringValue: this.verwerkingenS3BackupBucket.bucketName,
      parameterName: Statics.ssmName_verwerkingenS3BackupBucketName,
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


  customKmsKey() {
    const key = new Key(this, 'key', {
      alias: '/verwerkingenlogging/dynamodb/kmskey',
      description: 'Key for DynamoDB table for logging verwerkingen',
      enableKeyRotation: true,
    });

    new StringParameter(this, 'key-ssm', {
      stringValue: key.keyArn,
      parameterName: Statics.ssmName_dynamodbKmsKeyArn,
    });

    return key;
  }

}