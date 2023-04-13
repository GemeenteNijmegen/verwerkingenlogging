import { Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { QueueStack } from './QueueStack';

export interface QueueStageProps extends StageProps {

}

/**
 * Stage responsible for the Queue.
 */
export class QueueStage extends Stage {
  constructor(scope: Construct, id: string, props: QueueStageProps) {
    super(scope, id, props);

    new QueueStack(this, 'queue-stack');
  }
}
