
import { Stack, StackProps, Tags, pipelines } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiStage } from './ApiStage';
import { Configurable } from './Configuration';
import { DatabaseStage } from './DatabaseStage';
import { ParameterStage } from './ParameterStage';
import { QueueStage } from './QueueStage';
import { Statics } from './statics';

export interface PipelineStackProps extends StackProps, Configurable{}

export class PipelineStack extends Stack {

  branchName: string;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);

    this.branchName = props.configuration.branchName;

    const pipeline = this.pipeline(props);

    // **Stages**
    // API Stage depends on the Database Stage.
    // Reason: The DynamoDB table needs to be available to give access permissions to
    // the Api Gateway and Lambda.
    pipeline.addStage(new ParameterStage(this, 'ParametersStage', { env: props.configuration.targetEnvironment, configuration: props.configuration }));
    pipeline.addStage(new DatabaseStage(this, 'DatabaseStage', { env: props.configuration.targetEnvironment, configuration: props.configuration }));
    pipeline.addStage(new QueueStage(this, 'QueueStage', { env: props.configuration.targetEnvironment, configuration: props.configuration }));
    pipeline.addStage(new ApiStage(this, 'ApiStage', { env: props.configuration.targetEnvironment, configuration: props.configuration }));
  }

  pipeline(props: PipelineStackProps): pipelines.CodePipeline {
    const source = pipelines.CodePipelineSource.connection('GemeenteNijmegen/verwerkingenlogging', this.branchName, {
      connectionArn: props.configuration.codeStarConnectionArn,
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
          'yarn build',
        ],
      }),
    });
    return pipeline;
  }
}