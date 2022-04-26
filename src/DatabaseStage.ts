import { Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DatabaseStack } from './DatabaseStack';

export interface DynamoStageProps extends StageProps {

}

/**
 * Stage responsible for the DynamoDB Table.
 */
export class DynamoStage extends Stage {
  constructor(scope: Construct, id: string, props: DynamoStageProps) {
    super(scope, id, props);

    new DatabaseStack(this, 'database-stack');
  }
}
