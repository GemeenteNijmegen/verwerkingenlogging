const { awscdk } = require('projen');
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.1.0',
  defaultReleaseBranch: 'main',
  name: 'verwerkingenlogging',
  release: true,
  defaultReleaseBranch: 'production',
  majorVersion: 0,
  depsUpgradeOptions: {
    workflow: true,
    workflowOptions: {
      branches: ['development'],
    },
  },
  scripts: {
    lint: 'cfn-lint cdk.out/**/*.template.json -i W3005 W2001',
  },
  deps: [
    'cdk-nag@ˆ2.0.0',
  ],
  devDeps: [
    '@playwright/test',
    'dotenv',
  ],
  gitignore: [
    'test/__snapshots__/*',
    '.env',
    '.vscode',
    '.DS_Store',
    'test/playwright/report',
    'test/playwright/screenshots'
  ],

  // deps: [],                /* Runtime dependencies of this module. */
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  // devDeps: [],             /* Build dependencies for this module. */
  // packageName: undefined,  /* The "name" in package.json. */
});

project.synth();