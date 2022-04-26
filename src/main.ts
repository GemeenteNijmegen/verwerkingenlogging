import { App } from 'aws-cdk-lib';
//import { PipelineStackAcceptance } from './PipelineStackAcceptance';
import { PipelineStackDevelopment } from './PipelineStackDevelopment';
//import { PipelineStackProduction } from './PipelineStackProduction';

// for development, use sandbox account
const deploymentEnvironment = {
  account: '418648875085',
  region: 'eu-west-1',
};

const sandboxEnvironment = {
  account: '122467643252',
  region: 'eu-west-1',
};

// const acceptanceEnvironment = {
//   account: '315037222840',
//   region: 'eu-west-1',
// };

// const productionEnvironment = {
//   account: '196212984627',
//   region: 'eu-west-1',
// };

const app = new App();

if ('BRANCH_NAME' in process.env == false || process.env.BRANCH_NAME == 'development') {
  new PipelineStackDevelopment(app, 'verwerkingenlogging-pipeline-development',
    {
      env: deploymentEnvironment,
      branchName: 'development',
      deployToEnvironment: sandboxEnvironment,
    },
  );
// } else if (process.env.BRANCH_NAME == 'acceptance') { !! voordat je deployed, in env moet staan welke branch je wil hebben, acceptance in dit geval
//   new PipelineStackAcceptance(app, 'verwerkingenlogging-pipeline-acceptance',
//     {
//       env: deploymentEnvironment,
//       branchName: 'acceptance',
//       deployToEnvironment: acceptanceEnvironment,
//     },
//   );
// } else if (process.env.BRANCH_NAME == 'production') { !! voordat je deployed, in env moet staan welke branch je wil hebben, production in dit geval
//   new PipelineStackProduction(app, 'verwerkingenlogging-pipeline-production',
//     {
//       env: deploymentEnvironment,
//       branchName: 'production',
//       deployToEnvironment: productionEnvironment,
//     },
//   );
}

app.synth();