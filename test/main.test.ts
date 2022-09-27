import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { PipelineStackDevelopment } from '../src/PipelineStackDevelopment';

test('Snapshot', () => {
  const app = new App();
  const stack = new PipelineStackDevelopment(app, 'test', { env: { account: 'test', region: 'eu-west-1' }, branchName: 'development', deployToEnvironment: { account: 'test', region: 'eu-west-1' } });
  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});

test('MainPipelineExists', () => {
  const app = new App();
  const stack = new PipelineStackDevelopment(app, 'test', { env: { account: 'test', region: 'eu-west-1' }, branchName: 'development', deployToEnvironment: { account: 'test', region: 'eu-west-1' } });
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::CodePipeline::Pipeline', 1);
});