const AWS = require('aws-sdk');
const crypto = require('crypto');

const cognito = new AWS.CognitoIdentityServiceProvider();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const USER_POOL_ID = process.env.USER_POOL_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

const calculateSecretHash = (username, clientId, clientSecret) => {
  const message = username + clientId;
  return crypto.createHmac('sha256', clientSecret).update(message).digest('base64');
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const path = event.path;
    const method = event.httpMethod;
    const body = event.body ? JSON.parse(event.body) : {};

    let response;

    // Auth
    if (path === '/auth' && method === 'POST') {
      response = await validateAdmin(body);
    }
    // Users
    else if (path === '/users' && method === 'GET') {
      response = await listUsers(event.queryStringParameters);
    }
    else if (path === '/users/create' && method === 'POST') {
      response = await createUser(body);
    }
    else if (path === '/users/delete' && method === 'POST') {
      response = await deleteUser(body);
    }
    else if (path === '/users/recreate' && method === 'POST') {
      response = await recreateUser(body);
    }
    else if (path === '/users/reset-password' && method === 'POST') {
      response = await resetPassword(body);
    }
    else if (path === '/users/set-password' && method === 'POST') {
      response = await setPermanentPassword(body);
    }
    else if (path === '/users/enable' && method === 'POST') {
      response = await enableUser(body);
    }
    else if (path === '/users/disable' && method === 'POST') {
      response = await disableUser(body);
    }
    // MFA
    else if (path === '/users/mfa/enable' && method === 'POST') {
      response = await enableMFA(body);
    }
    else if (path === '/users/mfa/disable' && method === 'POST') {
      response = await disableMFA(body);
    }
    else if (path === '/users/mfa/status' && method === 'POST') {
      response = await getMFAStatus(body);
    }
    // Pool
    else if (path === '/pool/mfa' && method === 'GET') {
      response = await getPoolMFAConfig();
    }
    else if (path === '/pool/mfa' && method === 'POST') {
      response = await setPoolMFAConfig(body);
    }
    else {
      response = { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
    }

    return {
      ...response,
      headers: { ...corsHeaders, ...response.headers }
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};

async function validateAdmin({ email, password }) {
  const params = {
    TableName: DYNAMODB_TABLE,
    Key: { email }
  };

  const result = await dynamodb.get(params).promise();
  
  if (!result.Item || result.Item.password !== password) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid credentials' }) };
  }

  return { 
    statusCode: 200, 
    body: JSON.stringify({ 
      success: true,
      admin: {
        name: result.Item.name || 'Admin User',
        email: result.Item.email
      }
    }) 
  };
}

async function listUsers(queryParams) {
  const params = { UserPoolId: USER_POOL_ID, Limit: 60 };
  
  if (queryParams?.searchTerm) {
    if (queryParams.searchTerm.includes('@')) {
      params.Filter = `email = "${queryParams.searchTerm}"`;
    } else {
      params.Filter = `username = "${queryParams.searchTerm}"`;
    }
  }

  const result = await cognito.listUsers(params).promise();
  return { statusCode: 200, body: JSON.stringify(result.Users) };
}

async function createUser({ email, name, company, tempPassword }) {
  const userAttributes = [
    { Name: 'email', Value: email },
    { Name: 'email_verified', Value: 'true' }
  ];
  
  if (name) userAttributes.push({ Name: 'name', Value: name });
  if (company) userAttributes.push({ Name: 'profile', Value: company });
  
  const result = await cognito.adminCreateUser({
    UserPoolId: USER_POOL_ID,
    Username: email,
    UserAttributes: userAttributes,
    TemporaryPassword: tempPassword,
    MessageAction: 'SUPPRESS'
  }).promise();
  
  return { statusCode: 200, body: JSON.stringify({ user: result.User, tempPassword }) };
}

async function recreateUser({ username, tempPassword }) {
  // Get current user attributes
  const currentUser = await cognito.adminGetUser({
    UserPoolId: USER_POOL_ID,
    Username: username
  }).promise();
  
  const email = currentUser.UserAttributes.find(attr => attr.Name === 'email')?.Value || username;
  const name = currentUser.UserAttributes.find(attr => attr.Name === 'name')?.Value || '';
  const company = currentUser.UserAttributes.find(attr => attr.Name === 'profile')?.Value || '';
  
  // Delete existing user
  await cognito.adminDeleteUser({
    UserPoolId: USER_POOL_ID,
    Username: username
  }).promise();
  
  // Recreate user
  const userAttributes = [
    { Name: 'email', Value: email },
    { Name: 'email_verified', Value: 'true' }
  ];
  
  if (name) userAttributes.push({ Name: 'name', Value: name });
  if (company) userAttributes.push({ Name: 'profile', Value: company });
  
  const result = await cognito.adminCreateUser({
    UserPoolId: USER_POOL_ID,
    Username: email,
    UserAttributes: userAttributes,
    TemporaryPassword: tempPassword,
    MessageAction: 'SUPPRESS'
  }).promise();
  
  return { statusCode: 200, body: JSON.stringify({ user: result.User }) };
}

async function deleteUser({ username }) {
  await cognito.adminDeleteUser({
    UserPoolId: USER_POOL_ID,
    Username: username
  }).promise();

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
}

async function resetPassword({ username, newPassword }) {
  await cognito.adminSetUserPassword({
    UserPoolId: USER_POOL_ID,
    Username: username,
    Password: newPassword || 'TempPass123!'
  }).promise();

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
}

async function setPermanentPassword({ username, newPassword }) {
  const secretHash = calculateSecretHash(username, CLIENT_ID, CLIENT_SECRET);
  const tempPassword = 'TempSetup123!';
  
  // Reset to temp password first
  await cognito.adminResetUserPassword({
    UserPoolId: USER_POOL_ID,
    Username: username
  }).promise();
  
  await cognito.adminSetUserPassword({
    UserPoolId: USER_POOL_ID,
    Username: username,
    Password: tempPassword
  }).promise();
  
  // Authenticate and set permanent password
  const authResponse = await cognito.adminInitiateAuth({
    UserPoolId: USER_POOL_ID,
    ClientId: CLIENT_ID,
    AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
    AuthParameters: {
      USERNAME: username,
      PASSWORD: tempPassword,
      SECRET_HASH: secretHash
    }
  }).promise();
  
  if (authResponse.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
    await cognito.adminRespondToAuthChallenge({
      UserPoolId: USER_POOL_ID,
      ClientId: CLIENT_ID,
      ChallengeName: 'NEW_PASSWORD_REQUIRED',
      ChallengeResponses: {
        USERNAME: username,
        NEW_PASSWORD: newPassword,
        SECRET_HASH: secretHash
      },
      Session: authResponse.Session
    }).promise();
  }
  
  return { statusCode: 200, body: JSON.stringify({ success: true }) };
}

async function enableUser({ username }) {
  await cognito.adminEnableUser({
    UserPoolId: USER_POOL_ID,
    Username: username
  }).promise();
  
  return { statusCode: 200, body: JSON.stringify({ success: true }) };
}

async function disableUser({ username }) {
  await cognito.adminDisableUser({
    UserPoolId: USER_POOL_ID,
    Username: username
  }).promise();
  
  return { statusCode: 200, body: JSON.stringify({ success: true }) };
}

async function enableMFA({ username }) {
  await cognito.adminSetUserMFAPreference({
    UserPoolId: USER_POOL_ID,
    Username: username,
    SoftwareTokenMfaSettings: {
      Enabled: true,
      PreferredMfa: true
    }
  }).promise();

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
}

async function disableMFA({ username }) {
  await cognito.adminSetUserMFAPreference({
    UserPoolId: USER_POOL_ID,
    Username: username,
    SoftwareTokenMfaSettings: {
      Enabled: false
    },
    SMSMfaSettings: {
      Enabled: false
    }
  }).promise();

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
}

async function getMFAStatus({ username, userPoolMFAConfig }) {
  try {
    if (userPoolMFAConfig && userPoolMFAConfig.mfaConfiguration === 'ON') {
      return { statusCode: 200, body: JSON.stringify({ mfaActive: true, totpEnabled: true, smsEnabled: false }) };
    }
    
    const response = await cognito.adminGetUser({
      UserPoolId: USER_POOL_ID,
      Username: username
    }).promise();
    
    const mfaSettings = response.UserMFASettingList || [];
    const totpEnabled = mfaSettings.includes('SOFTWARE_TOKEN_MFA');
    const smsEnabled = mfaSettings.includes('SMS_MFA');
    
    const mfaOptions = response.MFAOptions || [];
    const mfaActive = totpEnabled || smsEnabled || mfaOptions.length > 0;
    
    return { statusCode: 200, body: JSON.stringify({ mfaActive, totpEnabled, smsEnabled }) };
  } catch (error) {
    return { statusCode: 200, body: JSON.stringify({ mfaActive: false, totpEnabled: false, smsEnabled: false }) };
  }
}

async function getPoolMFAConfig() {
  const result = await cognito.describeUserPool({
    UserPoolId: USER_POOL_ID
  }).promise();

  return { 
    statusCode: 200, 
    body: JSON.stringify({ 
      mfaConfiguration: result.UserPool.MfaConfiguration,
      enabledMfaMethods: result.UserPool.EnabledMfas || []
    }) 
  };
}

async function setPoolMFAConfig({ mfaConfiguration }) {
  await cognito.setUserPoolMfaConfig({
    UserPoolId: USER_POOL_ID,
    MfaConfiguration: mfaConfiguration,
    SoftwareTokenMfaConfiguration: {
      Enabled: true
    }
  }).promise();

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
}