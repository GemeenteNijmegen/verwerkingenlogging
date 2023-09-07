const { GemeenteNijmegenCdkApp } = require('@gemeentenijmegen/projen-project-type');
const { awscdk } = require('projen');

const project = new GemeenteNijmegenCdkApp({
  cdkVersion: '2.1.0',
  name: 'verwerkingenlogging',
  defaultReleaseBranch: 'main',
  majorVersion: 0,
  deps: [
    'cdk-nag@^2.0.0',
    '@gemeentenijmegen/aws-constructs',
  ],
  devDeps: [
    'dotenv',
    'axios',
    '@gemeentenijmegen/projen-project-type',
  ],
  gitignore: [
    'test/__snapshots__/*',
    '.env',
    '.vscode',
    '.DS_Store',
  ],
  jestOptions: {
    jestConfig: {
      testPathIgnorePatterns: ['/node_modules/', '/cdk.out', '/test/validation'],
    },
  },
});

project.buildWorkflow.addPostBuildSteps(
  {
    name: 'Install Python 3.9',
    uses: 'actions/setup-python@v3.1.2',
    with: {
      'python-version': 3.9,
    },
  },
  {
    name: 'Install python dependencies',
    run: 'pip install pipenv',
  },
  {
    name: 'Run tests',
    run: 'pipenv install --dev \n\pipenv run pytest',
  },
);

project.synth();