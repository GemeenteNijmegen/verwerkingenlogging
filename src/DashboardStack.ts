import {
  Stack,
  StackProps,
  aws_cloudwatch as cloudwatch,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Statics } from './statics';
import { IQueue, Queue } from 'aws-cdk-lib/aws-sqs';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';


export class DashboardStack extends Stack {

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);


    const queueArn = StringParameter.valueForStringParameter(this, Statics.ssmName_verwerkingenSQSqueueArn);
    const dlqArn = StringParameter.valueForStringParameter(this, Statics.ssmName_verwerkingenSQSqueueArn);
    const queue = Queue.fromQueueArn(this, 'queue', queueArn);
    const dlq = Queue.fromQueueArn(this, 'dlq', dlqArn);

    // Create the widgets
    const timeLine = this.createQueueWidged(queue, dlq);

    // Create the layout (each array is one row)
    const layout = [
      [timeLine],
    ];

    // Create the dashboard
    this.createDashboard(layout);

  }

  createQueueWidged(q: IQueue, dlq: IQueue){
    return new cloudwatch.GraphWidget({
      title: 'Overview of messages on queue and DLQ',
      height:6,
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
      ]
    })
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