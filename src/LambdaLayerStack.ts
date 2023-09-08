import { PythonLayerVersion } from '@aws-cdk/aws-lambda-python-alpha';
import { Stack, StackProps, aws_lambda as lambda, aws_ssm as ssm } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Statics } from './statics';

export class LambdaLayerStack extends Stack {

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const layer = new PythonLayerVersion(this, 'python-layer', {
      entry: 'src/api/LambdaLayer',
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_9],
      description: 'Python Layer for Verwerkingen API lambdas',
    });

    new ssm.StringParameter(this, 'python-layer-arn', {
      parameterName: Statics.ssmName_pythonLambdaLayerArn,
      stringValue: layer.layerVersionArn,
    });

  }
}