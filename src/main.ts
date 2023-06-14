import { App } from 'aws-cdk-lib';
import { getConfiguration } from './Configuration';
import { PipelineStack } from './PipelineStack';

const buildBranch = process.env.BRANCH_NAME ?? 'development';
console.log('Building branch', buildBranch);
const configuration = getConfiguration(buildBranch);

const app = new App();

new PipelineStack(app, `verwerkingenlogging-pipeline-stack-${configuration.branchName}`, {
  env: configuration.deploymentEnvironment,
  configuration: configuration,
});

app.synth();