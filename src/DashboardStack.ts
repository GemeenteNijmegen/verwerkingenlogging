import {
  Stack,
  StackProps,
  aws_cloudwatch as cloudwatch,
} from 'aws-cdk-lib';
import { IQueue, Queue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { Statics } from './statics';


export class DashboardStack extends Stack {

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const genLambdaLogGroupArn = StringParameter.valueForStringParameter(this, Statics.ssmName_genLambdaLogGroupArn);
    const recLambdaLogGroupArn = StringParameter.valueForStringParameter(this, Statics.ssmName_recLambdaLogGroupArn);
    const queueArn = StringParameter.valueForStringParameter(this, Statics.ssmName_verwerkingenSQSqueueArn);
    const dlqArn = StringParameter.valueForStringParameter(this, Statics.ssmName_verwerkingenSQSdlqArn);
    const queue = Queue.fromQueueArn(this, 'queue', queueArn);
    const dlq = Queue.fromQueueArn(this, 'dlq', dlqArn);

    // Create the widgets
    const timeLine = this.queueWidged(queue, dlq);
    const table = this.requestsPerEndpointTable([
      genLambdaLogGroupArn,
      recLambdaLogGroupArn,
    ]);

    // Create the layout (each array is one row)
    const layout = [
      [timeLine],
      [table],
    ];

    // Create the dashboard
    this.createDashboard(layout);

  }

  queueWidged(q: IQueue, dlq: IQueue) {
    return new cloudwatch.GraphWidget({
      title: 'Overview of messages on queue and DLQ',
      height: 6,
      width: 24,
      view: cloudwatch.GraphWidgetView.TIME_SERIES,
      left: [
        q.metricNumberOfMessagesSent({
          label: 'Messages on queue',
          statistic: cloudwatch.Stats.SUM,
        }),
        dlq.metricNumberOfMessagesSent({
          label: 'Messages on DLQ',
          statistic: cloudwatch.Stats.SUM,
        }),
      ],
    });
  }

  requestsPerEndpointTable(logGroups: string[]) {
    return new cloudwatch.LogQueryWidget({
      title: 'Requests per endpoint',
      width: 8,
      height: 12,
      logGroupNames: logGroups,
      view: cloudwatch.LogQueryVisualizationType.TABLE,
      queryLines: [
        'filter @message like /API CALL/',
        '| stats count(@message) by @message',
      ],
    });
  }

  /**
   * Create the CloudWatch Dashboard
   * @param layout 2d array (each array specifies a row of widges)
   */
  createDashboard(layout: cloudwatch.IWidget[][]) {
    new cloudwatch.Dashboard(this, 'dashboard', {
      dashboardName: 'Verwerkingenlogging',
      widgets: layout,
    });
  }

}