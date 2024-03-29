import { PythonLayerVersion } from '@aws-cdk/aws-lambda-python-alpha';
import { aws_lambda as Lambda, RemovalPolicy, Duration, Stack } from 'aws-cdk-lib';
import { Alarm } from 'aws-cdk-lib/aws-cloudwatch';
import { FilterPattern, IFilterPattern, MetricFilter, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { Statics } from './statics';

export interface ApiFunctionProps {

  /**
   * Description of the lambda function
   */
  description: string;

  /**
   * Environment variables to pass to the lambda
   */
  environment?: {[key: string]: string};

  /**
   * Filter pattern to monitor in the logging
   *
   * @default - Any log line that contains ERROR
   */
  monitorFilterPattern?: IFilterPattern;

  /**
   * Reference to the lambda source dir
   */
  code: string;

  /**
   * Python layer arn
   */
  pythonLayerArn?: string;
}

export class ApiFunction extends Construct {
  lambda: Lambda.Function;

  constructor(scope: Construct, id: string, props: ApiFunctionProps) {
    super(scope, id);

    // See https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Lambda-Insights-extension-versionsx86-64.html
    const insightsArn = `arn:aws:lambda:${Stack.of(this).region}:580247275435:layer:LambdaInsightsExtension:21`;

    const layers = [];
    if (props.pythonLayerArn) {
      layers.push(PythonLayerVersion.fromLayerVersionArn(this, 'lambda-layer', props.pythonLayerArn));
    }

    this.lambda = new Lambda.Function(this, 'lambda', {
      handler: 'index.handler',
      code: Lambda.Code.fromAsset(props.code),
      runtime: Lambda.Runtime.PYTHON_3_9,
      memorySize: 512,
      description: props.description,
      insightsVersion: Lambda.LambdaInsightsVersion.fromInsightVersionArn(insightsArn),
      logRetention: RetentionDays.ONE_MONTH,
      layers: layers,
      environment: {
        ...props.environment,
      },
    });

    this.monitor(props.monitorFilterPattern);
  }

  /**
   * Monitor the logs generated by this function for a filter pattern, generate metric
   * and alarm on increased error rate.
   *
   * @param filterPattern Pattern to filter by (default: containing ERROR)
   */
  private monitor(filterPattern?: IFilterPattern) {
    const errorMetricFilter = new MetricFilter(this, 'MetricFilter', {
      logGroup: this.lambda.logGroup,
      metricNamespace: `${Statics.projectName}/${this.node.id}`,
      metricName: 'Errors',
      filterPattern: filterPattern ?? FilterPattern.anyTerm('ERROR'),
      metricValue: '1',
    });
    errorMetricFilter.applyRemovalPolicy(RemovalPolicy.DESTROY);

    const alarm = new Alarm(this, `${Statics.projectName}-${this.node.id}-alarm`, {
      metric: errorMetricFilter.metric({
        statistic: 'sum',
        period: Duration.minutes(5),
      }),
      evaluationPeriods: 3,
      threshold: 5,
      alarmName: `Increased error rate for ${this.node.id}`,
      alarmDescription: `This alarm triggers if the function ${this.node.id} is logging more than 5 errors over n minutes.`,
    });
    alarm.applyRemovalPolicy(RemovalPolicy.DESTROY);
  }

}