import { Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiStack } from './ApiStack';

export interface ApiStageProps extends StageProps {

}

/**
 * Stage responsible for the API Gateway and several attached Lambda's.
 */
export class ApiStage extends Stage {
  constructor(scope: Construct, id: string, props: ApiStageProps) {
    super(scope, id, props);

    new ApiStack(this, 'api-stack');
  }
}