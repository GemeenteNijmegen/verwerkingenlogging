import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { PipelineStack } from '../src/PipelineStack';
import { Statics } from '../src/statics';

const testEnv = {
  account: 'test',
  region: 'eu-west-1',
};

test('Snapshot', () => {
  const app = new App();
  const stack = new PipelineStack(app, 'test', {
    configuration: {
      branchName: 'test',
      codeStarConnectionArn: Statics.gnBuildCodeStarConnectionArn,
      buildEnvironment: testEnv,
      targetEnvironment: testEnv,
    },
    env: {
      account: 'test',
      region: 'eu-west-1',
    },
  });
  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});

test('MainPipelineExists', () => {
  const app = new App();
  const stack = new PipelineStack(app, 'test', {
    configuration: {
      branchName: 'test',
      codeStarConnectionArn: Statics.gnBuildCodeStarConnectionArn,
      buildEnvironment: testEnv,
      targetEnvironment: testEnv,
    },
    env: {
      account: 'test',
      region: 'eu-west-1',
    },
  });
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::CodePipeline::Pipeline', 1);
});