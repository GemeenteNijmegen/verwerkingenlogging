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

  /**
   * Flag to enable debugging (logging in lambdas)
   * Caution: should never be true in production!
   * @default false
   */
  enableVerboseAndSensitiveLogging?: boolean;

}

export const configurations: { [key: string]: Configuration } = {
  acceptance: {
    branchName: 'acceptance',
    codeStarConnectionArn: Statics.gnBuildCodeStarConnectionArn,
    buildEnvironment: Statics.gnBuildEnvironment,
    targetEnvironment: Statics.gnVerwerkingenloggingAccp,
    enableVerboseAndSensitiveLogging: true,
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