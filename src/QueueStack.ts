import { Stack } from 'aws-cdk-lib';
import * as IAM from 'aws-cdk-lib/aws-iam';
import * as Lambda from 'aws-cdk-lib/aws-lambda';
import * as LambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as Sqs from 'aws-cdk-lib/aws-sqs';
import * as SSM from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { Statics } from './statics';

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
  declare verwerkingenProcLambdaFunction: Lambda.Function;

  /**
    * Sqs event source attachable to a Lambda fucntion
    */
  declare verwerkingenLambdaSqsEventSource: LambdaEventSources.SqsEventSource;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Message Dead-Letter-Queue (DLQ)
    this.verwerkingenMessageDeadLetterQueue = new Sqs.Queue(this, 'verwerkingen-message-dead-letter-queue', {
      encryption: Sqs.QueueEncryption.KMS_MANAGED,
    });

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

    // Processing Lambda
    this.verwerkingenProcLambdaFunction = new Lambda.Function(this, 'verwerkingen-proc-lambda-function', {
      code: Lambda.Code.fromAsset('src/ProcLambdaFunction'),
      handler: 'index.handler',
      runtime: Lambda.Runtime.PYTHON_3_9,
      environment: {
        DYNAMO_TABLE_NAME: Statics.verwerkingenTableName,
        SQS_URL: this.verwerkingenMessageQueue.queueUrl,
      },
    });
    this.verwerkingenProcLambdaFunction.addToRolePolicy(new IAM.PolicyStatement({
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

    // Add Lambda trigger to the Sqs Queue.
    this.verwerkingenLambdaSqsEventSource = new LambdaEventSources.SqsEventSource(this.verwerkingenMessageQueue);
    this.verwerkingenProcLambdaFunction.addEventSource(this.verwerkingenLambdaSqsEventSource);
  }
}