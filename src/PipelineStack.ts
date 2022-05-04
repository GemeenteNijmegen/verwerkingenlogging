
import { Stack, StackProps, Tags, pipelines, Environment } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiStage } from './ApiStage';
import { DatabaseStage } from './DatabaseStage';
import { ParameterStage } from './ParameterStage';
import { Statics } from './statics';

export interface PipelineStackProps extends StackProps{
  branchName: string;
  deployToEnvironment: Environment;
}

export class PipelineStack extends Stack {
  branchName: string;
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);
    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);
    this.branchName = props.branchName;
    const pipeline = this.pipeline();
    pipeline.addStage(new ParameterStage(this, 'ParametersStage', { env: props.deployToEnvironment }));
    pipeline.addStage(new DatabaseStage(this, 'DatabaseStage', { env: props.deployToEnvironment }));
    pipeline.addStage(new ApiStage(this, 'ApiStage', { env: props.deployToEnvironment }));
  }

  pipeline(): pipelines.CodePipeline {
    const source = pipelines.CodePipelineSource.connection('GemeenteNijmegen/verwerkingenlogging', this.branchName, {
      connectionArn: Statics.connectionArn,
    });
    const pipeline = new pipelines.CodePipeline(this, `verwerkingenlogging-${this.branchName}`, {
      pipelineName: `verwerkingenlogging-${this.branchName}`,
      dockerEnabledForSelfMutation: true,
      dockerEnabledForSynth: true,
      crossAccountKeys: true,
      synth: new pipelines.ShellStep('Synth', {
        input: source,
        env: {
          BRANCH_NAME: this.branchName,
        },
        commands: [
          'yarn install --frozen-lockfile',
          'npx projen build',
          'npx projen synth',
        ],
      }),
    });
    return pipeline;
  }
}