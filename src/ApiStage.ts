import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import { Aspects, Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiStack } from './ApiStack';
import { Configurable } from './Configuration';
import { DatabaseStack } from './DatabaseStack';
import { DnsStack } from './DnsStack';
import { QueueStack } from './QueueStack';

export interface ApiStageProps extends StageProps, Configurable {

}

/**
 * Stage responsible for the API Gateway and several attached Lambda's.
 */
export class ApiStage extends Stage {
  constructor(scope: Construct, id: string, props: ApiStageProps) {
    super(scope, id, props);
    Aspects.of(this).add(new PermissionsBoundaryAspect());

    const dnsStack = new DnsStack(this, 'dns-stac');
    const queueStack = new QueueStack(this, 'queue-stack');
    const databaseStack = new DatabaseStack(this, 'database-stack');
    const apiStack = new ApiStack(this, 'api-stack');

    apiStack.addDependency(dnsStack);
    apiStack.addDependency(databaseStack);
    apiStack.addDependency(queueStack);


  }
}
