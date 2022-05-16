import { aws_dynamodb as DynamoDB, aws_ssm as SSM, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { TableEncryption } from 'aws-cdk-lib/aws-dynamodb';
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

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Create the DynamoDB verwerkingen table.
    this.verwerkingenTable = new DynamoDB.Table(this, 'verwerkingen-table', {
      partitionKey: { name: 'actieId', type: DynamoDB.AttributeType.STRING },
      billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
      tableName: Statics.verwerkingenTableName,
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.RETAIN,
      encryption: TableEncryption.AWS_MANAGED,
    });

    // Add DynamoDB table to parameter store.
    new SSM.StringParameter(this, 'ssm_verwerkingen-table-arn', {
      stringValue: this.verwerkingenTable.tableArn,
      parameterName: Statics.ssmName_verwerkingenTableArn,
    });

    // Add Global Secondary Indexes to the verwerkingen table.
    this.verwerkingenTable.addGlobalSecondaryIndex({
      indexName: 'objecttypesoortObjectIdobjectId-index',
      partitionKey: { name: 'objecttypesoortObjectIdobjectId', type: DynamoDB.AttributeType.STRING },
    });

    this.verwerkingenTable.addGlobalSecondaryIndex({
      indexName: 'verwerkingId-index',
      partitionKey: { name: 'verwerkingId', type: DynamoDB.AttributeType.STRING },
    });

  }
}