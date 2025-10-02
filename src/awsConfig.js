import { Amplify } from 'aws-amplify';

const awsConfig = {
  Auth: {
    region: process.env.REACT_APP_REGION,
    userPoolId: process.env.REACT_APP_USER_POOL_ID,
    userPoolWebClientId: process.env.REACT_APP_CLIENT_ID,
    identityPoolId: process.env.REACT_APP_IDENTITY_POOL_ID, // Will be added after deployment
  }
};

Amplify.configure(awsConfig);

export default awsConfig;