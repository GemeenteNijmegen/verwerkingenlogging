
import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import { Aspects, Stack, StackProps, Tags, pipelines } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiStage } from './ApiStage';
import { Configurable } from './Configuration';
import { ParameterStage } from './ParameterStage';
import { Statics } from './statics';
import { BuildSpec } from 'aws-cdk-lib/aws-codebuild';

export interface PipelineStackProps extends StackProps, Configurable{}

export class PipelineStack extends Stack {

  branchName: string;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);
    Aspects.of(this).add(new PermissionsBoundaryAspect());

    this.branchName = props.configuration.branchName;

    const pipeline = this.pipeline(props);

    // **Stages**
    pipeline.addStage(new ParameterStage(this, 'vwlog-parameters', { env: props.configuration.targetEnvironment, configuration: props.configuration }));
    pipeline.addStage(new ApiStage(this, 'vwlog', { env: props.configuration.targetEnvironment, configuration: props.configuration }));
  }

  pipeline(props: PipelineStackProps): pipelines.CodePipeline {
    const source = pipelines.CodePipelineSource.connection('GemeenteNijmegen/verwerkingenlogging', this.branchName, {
      connectionArn: props.configuration.codeStarConnectionArn,
    });

    const pipeline = new pipelines.CodePipeline(this, `verwerkingenlogging-${this.branchName}`, {
      pipelineName: `verwerkingenlogging-${this.branchName}`,
      crossAccountKeys: true,
      synthCodeBuildDefaults: {
        partialBuildSpec: BuildSpec.fromObject({
          artifacts: {
            'enable-symlinks': 'yes',
          }
        })
      },
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