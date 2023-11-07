import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import { Stack, Tags, Stage, StageProps, Aspects } from 'aws-cdk-lib';
//import { Stack, Tags, Stage, aws_ssm as SSM, aws_secretsmanager as SecretsManager, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { Statics } from './statics';

export interface ParameterStageProps extends StageProps, Configurable {}

/**
 * Stage for creating SSM parameters. This needs to run
 * before stages that use them.
 */
export class ParameterStage extends Stage {
  constructor(scope: Construct, id: string, props: ParameterStageProps) {
    super(scope, id, props);
    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);
    Aspects.of(this).add(new PermissionsBoundaryAspect());

    new ParameterStack(this, 'stack');
  }
}
/**
 * Stack that creates ssm parameters for the application.
 * These need to be present before stack that use them.
 */

export class ParameterStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);

    new ssmParamsConstruct(this, 'plain');
  }
}
/**
 * All SSM parameters needed for the application.
 * Some are created with a sensible default, others are
 * empty and need to be filled or changed via the console.
 */

export class ssmParamsConstruct extends Construct {

  constructor(scope: Construct, id: string) {
    super(scope, id);
    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);

    /**
     * Parameters
     */
    // new SSM.StringParameter(this, 'ssm_auth_1', {
    //   stringValue: 'https://authenticatie-accp.nijmegen.nl',
    //   parameterName: Statics.ssmAuthUrlBaseParameter,
    // });

    /**
     * Secrets
     */
    // new SecretsManager.Secret(this, 'secret_1', {
    //   secretName: Statics.secretOIDCClientSecret,
    //   description: 'OpenIDConnect client secret',
    // });
  }
}