import { Stack, StackProps, Tags, aws_ssm as SSM } from 'aws-cdk-lib';
import { HostedZone, ZoneDelegationRecord } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { Statics } from './statics';

export class DnsStack extends Stack {

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', 'auth');

    // Import account hosted zone
    const accountRootZoneId = SSM.StringParameter.valueForStringParameter(this, Statics.accountRootHostedZoneId);
    const accountRootZoneName = SSM.StringParameter.valueForStringParameter(this, Statics.accountRootHostedZoneName);
    const accountRootZone = HostedZone.fromHostedZoneAttributes(this, 'account-root-zone', {
      hostedZoneId: accountRootZoneId,
      zoneName: accountRootZoneName,
    });

    // Create webformulieren.* hosted zone
    const projectHostedZoneName = Statics.subdomain(accountRootZoneName);
    const projectHostedZone = new HostedZone(this, 'hostedzone', {
      zoneName: projectHostedZoneName,
      comment: 'Hosted zone for verwerkingenlogging project',
    });

    // Register the new zone in the account root zone
    if (!projectHostedZone.hostedZoneNameServers) {
      throw 'No name servers found for our hosted zone, cannot create dns stack';
    }
    new ZoneDelegationRecord(this, 'webformulieren-zone-delegation', {
      nameServers: projectHostedZone.hostedZoneNameServers,
      zone: accountRootZone,
      recordName: projectHostedZoneName,
    });

    // Register the project hosted zone in parameter (eu-west-1 & us-east-1)
    new SSM.StringParameter(this, 'ssm-webformulieren-zone-id', {
      parameterName: Statics.ssmName_projectHostedZoneId,
      stringValue: projectHostedZone.hostedZoneId,
    });
    new SSM.StringParameter(this, 'ssm-webformulieren-zone-name', {
      parameterName: Statics.ssmName_projectHostedZoneName,
      stringValue: projectHostedZone.zoneName,
    });

  }
}