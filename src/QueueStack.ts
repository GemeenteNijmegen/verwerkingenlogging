import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as IAM from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import * as LambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as Sqs from 'aws-cdk-lib/aws-sqs';
import * as SSM from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { ApiFunction } from './ApiFunction';
import { Configurable } from './Configuration';
import { Statics } from './statics';

export interface QueueStackProps extends StackProps, Configurable { }

export class QueueStack extends Stack {

  /**
   * Message Dead Letter Queue (DLQ)
   */
  declare verwerkingenMessageDeadLetterQueue: Sqs.Queue;

  /**
   * Message Queue (SQS)
   * Receives messages from the Gen Lambda
   */
  declare verwerkingenMessageQueue: Sqs.Queue;

  /**
   * Lambda function processing messages received from the Message Queue (SQS)
   */
  declare verwerkingenProcLambdaFunction: ApiFunction;

  /**
    * Sqs event source attachable to a Lambda fucntion
    */
  declare verwerkingenLambdaSqsEventSource: LambdaEventSources.SqsEventSource;

  constructor(scope: Construct, id: string, props: QueueStackProps) {
    super(scope, id, props);

    // Message Dead-Letter-Queue (DLQ)
    this.verwerkingenMessageDeadLetterQueue = new Sqs.Queue(this, 'verwerkingen-message-dead-letter-queue', {
      encryption: Sqs.QueueEncryption.KMS_MANAGED,
    });
    this.setupDlqAlarm();

    // Message Queue (SQS)
    this.verwerkingenMessageQueue = new Sqs.Queue(this, 'verwerkingen-message-queue', {
      encryption: Sqs.QueueEncryption.KMS_MANAGED,
      deadLetterQueue: {
        queue: this.verwerkingenMessageDeadLetterQueue,
        maxReceiveCount: 3, //TODO: change amount?
      },
    });

    // Add SQS url to parameter store.
    new SSM.StringParameter(this, 'ssm_verwerkingen-sqs-queue-url', {
      stringValue: this.verwerkingenMessageQueue.queueUrl,
      parameterName: Statics.ssmName_verwerkingenSQSqueueUrl,
    });

    // Add SQS arn to parameter store.
    new SSM.StringParameter(this, 'ssm_verwerkingn-sqs-queue-arn', {
      stringValue: this.verwerkingenMessageQueue.queueArn,
      parameterName: Statics.ssmName_verwerkingenSQSqueueArn,
    });

    this.verwerkingenProcLambdaFunction = this.setupProcessingLambda(
      this.verwerkingenMessageQueue.queueUrl,
      props.configuration.enableVerboseAndSensitiveLogging,
    );

    // Add Lambda trigger to the Sqs Queue.
    this.verwerkingenLambdaSqsEventSource = new LambdaEventSources.SqsEventSource(this.verwerkingenMessageQueue);
    this.verwerkingenProcLambdaFunction.lambda.addEventSource(this.verwerkingenLambdaSqsEventSource);
  }

  /**
   * Creates the lambda responsible for processing the queues messages
   * @param queueUrl
   * @param enableVerboseAndSensitiveLogging
   * @returns
   */
  private setupProcessingLambda(queueUrl: string, enableVerboseAndSensitiveLogging?: boolean) {

    const keyArn = SSM.StringParameter.valueForStringParameter(this, Statics.ssmName_dynamodbKmsKeyArn);
    const key = Key.fromKeyArn(this, 'key', keyArn);

    const lambda = new ApiFunction(this, 'processing', {
      description: 'Responsible for processing messages from the verwerkingenlog queue',
      entry: 'src/api/ProcLambdaFunction',
      pythonLayerArn: SSM.StringParameter.valueForStringParameter(this, Statics.ssmName_pythonLambdaLayerArn),
      environment: {
        DYNAMO_TABLE_NAME: Statics.verwerkingenTableName,
        SQS_URL: queueUrl, //this.verwerkingenMessageQueue.queueUrl,
        ENABLE_VERBOSE_AND_SENSITIVE_LOGGING: enableVerboseAndSensitiveLogging ? 'true' : 'false',
      },
    });

    key.grantEncryptDecrypt(lambda.lambda);

    lambda.lambda.addToRolePolicy(new IAM.PolicyStatement({
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
        `arn:aws:dynamodb:${this.region}:${this.account}:table/` + Statics.verwerkingenTableName + '/index/' + Statics.verwerkingenTableIndex_objectTypeSoortId,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/` + Statics.verwerkingenTableName + '/index/' + Statics.verwerkingenTableIndex_verwerkingId,
      ],
    }));
    return lambda;
  }


  private setupDlqAlarm() {
    new cloudwatch.Alarm(this, 'dql-alarm', {
      metric: this.verwerkingenMessageDeadLetterQueue.metricNumberOfMessagesReceived({
        period: Duration.minutes(1),
      }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      alarmName: 'verwerkingenlogging-DLQ-alarm',
      alarmDescription: `There are messages on the DQL for ${Statics.projectName}`,
    });
  }

}