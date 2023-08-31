import { aws_s3 as s3 } from 'aws-cdk-lib';
import { Statics } from './statics';

/**
 * Custom Environment with obligatory accountId and region
 */
export interface Environment {
  account: string;
  region: string;
}

export interface Configurable {
  configuration: Configuration;
}

export interface Configuration {
  /**
     * The git branch name to which this configuration applies.
     */
  branchName: string;


  /**
     * Code star connection arn in the deployment environment
     */
  codeStarConnectionArn: string;

  /**
     * Deployment environment
     */
  buildEnvironment: Environment;

  /**
     * Target environment
     */
  targetEnvironment: Environment;

}

export interface GeoBucketConfig {
  cdkId: string;
  name: string;
  /**
     * If undefined no backup is configured for this bucket
     */
  backupName?: string;
  description: string;
  bucketConfiguration: s3.BucketProps;

  /**
     * @default false
     */
  setupAccessForIamUser?: boolean;
}


export const configurations: { [key: string]: Configuration } = {
  acceptance: {
    branchName: 'acceptance',
    codeStarConnectionArn: Statics.gnBuildCodeStarConnectionArn,
    buildEnvironment: Statics.gnBuildEnvironment,
    targetEnvironment: Statics.gnVerwerkingenloggingAccp,
  },
  main: {
    branchName: 'main',
    codeStarConnectionArn: Statics.gnBuildCodeStarConnectionArn,
    buildEnvironment: Statics.gnBuildEnvironment,
    targetEnvironment: Statics.gnVerwerkingenloggingProd,
  },
};

export function getConfiguration(buildBranch: string) {
  const config = configurations[buildBranch];
  if (!config) {
    throw Error(`No configuration for branch ${buildBranch} found. Add a configuration in Configuration.ts`);
  }
  return config;
}