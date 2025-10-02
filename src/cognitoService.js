const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  region: process.env.REACT_APP_REGION || 'us-east-1',
  accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.REACT_APP_AWS_SESSION_TOKEN
});

const cognito = new AWS.CognitoIdentityServiceProvider();
const dynamodb = new AWS.DynamoDB.DocumentClient();

const USER_POOL_ID = process.env.REACT_APP_USER_POOL_ID;
const CLIENT_ID = process.env.REACT_APP_CLIENT_ID;
const CLIENT_SECRET = process.env.REACT_APP_CLIENT_SECRET;
const ADMIN_TABLE_NAME = 'admin-credentials';

const calculateSecretHash = async (username, clientId, clientSecret) => {
  const message = username + clientId;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(clientSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
};

export const listUsers = async (searchTerm = null) => {
  const params = {
    UserPoolId: USER_POOL_ID,
    Limit: 60
  };
  
  if (searchTerm) {
    if (searchTerm.includes('@')) {
      params.Filter = `email = "${searchTerm}"`;
    } else {
      params.Filter = `username = "${searchTerm}"`;
    }
  }
  
  const response = await cognito.listUsers(params).promise();
  return response.Users;
};

export const setPermanentPassword = async (username, newPassword) => {
  const secretHash = await calculateSecretHash(username, CLIENT_ID, CLIENT_SECRET);
  const tempPassword = 'TempSetup123!';
  
  // Reset user to force temporary password state
  try {
    await cognito.adminResetUserPassword({
      UserPoolId: USER_POOL_ID,
      Username: username
    }).promise();
  } catch (error) {
    // User might not exist or already in correct state
  }
  
  // Set temporary password
  await cognito.adminSetUserPassword({
    UserPoolId: USER_POOL_ID,
    Username: username,
    Password: tempPassword
  }).promise();
  
  try {
    // Authenticate with temp password to trigger NEW_PASSWORD_REQUIRED
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
      // Complete the password change challenge with permanent password
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
  } catch (error) {
    console.error('Error in auth flow:', error);
    throw error;
  }
};

export const forcePasswordReset = async (username, newPassword = 'TempPass123!') => {
  await cognito.adminSetUserPassword({
    UserPoolId: USER_POOL_ID,
    Username: username,
    Password: newPassword
  }).promise();
};

export const resetTOTPMFA = async (username, tempPassword) => {
  const secretHash = await calculateSecretHash(username, CLIENT_ID, CLIENT_SECRET);
  
  // Step 1: Disable MFA completely
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
  
  // Step 2: Set permanent password
  await cognito.adminSetUserPassword({
    UserPoolId: USER_POOL_ID,
    Username: username,
    Password: tempPassword,
    Permanent: true
  }).promise();
  
  // Step 3: Authenticate to get access token
  const authResponse = await cognito.adminInitiateAuth({
    UserPoolId: USER_POOL_ID,
    ClientId: CLIENT_ID,
    AuthFlow: 'ADMIN_NO_SRP_AUTH',
    AuthParameters: {
      USERNAME: username,
      PASSWORD: tempPassword,
      SECRET_HASH: secretHash
    }
  }).promise();
  
  if (!authResponse.AuthenticationResult?.AccessToken) {
    throw new Error('Failed to get access token for MFA reset');
  }
  
  const accessToken = authResponse.AuthenticationResult.AccessToken;
  
  // Step 4: Associate new software token
  const associateResponse = await cognito.associateSoftwareToken({
    AccessToken: accessToken
  }).promise();
  
  return {
    secretCode: associateResponse.SecretCode,
    accessToken,
    tempPassword
  };
};

export const completeTOTPReset = async (accessToken, totpCode, username) => {
  // Step 1: Verify the TOTP code
  const verifyResponse = await cognito.verifySoftwareToken({
    AccessToken: accessToken,
    UserCode: totpCode
  }).promise();
  
  if (verifyResponse.Status !== 'SUCCESS') {
    throw new Error('TOTP verification failed');
  }
  
  // Step 2: Enable TOTP MFA for the user
  await cognito.adminSetUserMFAPreference({
    UserPoolId: USER_POOL_ID,
    Username: username,
    SoftwareTokenMfaSettings: {
      Enabled: true,
      PreferredMfa: true
    }
  }).promise();
  
  // Step 3: Force password reset (this is the key step for MFA enforcement)
  await cognito.adminResetUserPassword({
    UserPoolId: USER_POOL_ID,
    Username: username
  }).promise();
  
  return verifyResponse;
};



export const enableTOTPMFA = async (username) => {
  const params = {
    UserPoolId: USER_POOL_ID,
    Username: username,
    SoftwareTokenMfaSettings: {
      Enabled: true,
      PreferredMfa: true
    }
  };
  
  await cognito.adminSetUserMFAPreference(params).promise();
};

export const disableTOTPMFA = async (username) => {
  const params = {
    UserPoolId: USER_POOL_ID,
    Username: username,
    SoftwareTokenMfaSettings: {
      Enabled: false
    },
    SMSMfaSettings: {
      Enabled: false
    }
  };
  
  await cognito.adminSetUserMFAPreference(params).promise();
};

export const getUserPoolMFAConfig = async () => {
  const params = {
    UserPoolId: USER_POOL_ID
  };
  
  const response = await cognito.describeUserPool(params).promise();
  
  return {
    mfaConfiguration: response.UserPool.MfaConfiguration,
    enabledMfaMethods: response.UserPool.EnabledMfas || []
  };
};

export const updateUserPoolMFAConfig = async (mfaConfiguration) => {
  const params = {
    UserPoolId: USER_POOL_ID,
    MfaConfiguration: mfaConfiguration,
    SoftwareTokenMfaConfiguration: {
      Enabled: true
    }
  };
  
  await cognito.setUserPoolMfaConfig(params).promise();
};





export const deleteUser = async (username) => {
  const params = {
    UserPoolId: USER_POOL_ID,
    Username: username
  };
  
  await cognito.adminDeleteUser(params).promise();
};

export const getUserMFAStatus = async (username, userPoolMFAConfig = null) => {
  try {
    // If user pool is REQUIRED, all users show as MFA Active
    if (userPoolMFAConfig && userPoolMFAConfig.mfaConfiguration === 'ON') {
      return {
        mfaActive: true,
        totpEnabled: true,
        smsEnabled: false
      };
    }
    
    // Check actual Cognito MFA settings
    const params = {
      UserPoolId: USER_POOL_ID,
      Username: username
    };
    
    const response = await cognito.adminGetUser(params).promise();
    
    const mfaSettings = response.UserMFASettingList || [];
    const totpEnabled = mfaSettings.includes('SOFTWARE_TOKEN_MFA');
    const smsEnabled = mfaSettings.includes('SMS_MFA');
    
    const mfaOptions = response.MFAOptions || [];
    const hasTOTPOption = mfaOptions.some(option => option.DeliveryMedium === 'SOFTWARE_TOKEN_MFA');
    const hasSMSOption = mfaOptions.some(option => option.DeliveryMedium === 'SMS');
    
    const mfaActive = totpEnabled || smsEnabled || mfaOptions.length > 0;
    
    return {
      mfaActive,
      totpEnabled: totpEnabled || hasTOTPOption,
      smsEnabled: smsEnabled || hasSMSOption
    };
  } catch (error) {
    console.error('Error getting MFA status:', error);
    return {
      mfaActive: false,
      totpEnabled: false,
      smsEnabled: false
    };
  }
};

export const checkUserMFAHistory = async (username) => {
  try {
    // Check admin preference first
    const adminPreference = await getAdminMFAPreference(username);
    if (adminPreference === 'admin_enabled') {
      return true;
    }
    
    // Check if user is in saved MFA users list
    const savedMFAUsers = JSON.parse(localStorage.getItem('mfaEnabledUsers') || '[]');
    if (savedMFAUsers.includes(username)) {
      return true;
    }
    
    // Check actual Cognito MFA settings
    const params = {
      UserPoolId: USER_POOL_ID,
      Username: username
    };
    
    const response = await cognito.adminGetUser(params).promise();
    
    const mfaOptions = response.MFAOptions || [];
    const mfaSettings = response.UserMFASettingList || [];
    
    return mfaOptions.length > 0 || mfaSettings.length > 0;
  } catch (error) {
    console.error('Error checking MFA history:', error);
    return false;
  }
};

export const setAdminMFAPreference = async (username, preference) => {
  try {
    const preferences = JSON.parse(localStorage.getItem('adminMFAPreferences') || '{}');
    preferences[username] = preference;
    localStorage.setItem('adminMFAPreferences', JSON.stringify(preferences));
  } catch (error) {
    console.error('Error saving admin MFA preference:', error);
  }
};

export const getAdminMFAPreference = async (username) => {
  try {
    const preferences = JSON.parse(localStorage.getItem('adminMFAPreferences') || '{}');
    return preferences[username] || 'not_set';
  } catch (error) {
    console.error('Error getting admin MFA preference:', error);
    return 'not_set';
  }
};

export const createUser = async (email, tempPassword) => {
  const params = {
    UserPoolId: USER_POOL_ID,
    Username: email,
    UserAttributes: [
      {
        Name: 'email',
        Value: email
      },
      {
        Name: 'email_verified',
        Value: 'true'
      }
    ],
    TemporaryPassword: tempPassword,
    MessageAction: 'SUPPRESS'
  };
  
  const response = await cognito.adminCreateUser(params).promise();
  
  return {
    username: response.User.Username,
    userSub: response.User.Attributes.find(attr => attr.Name === 'sub')?.Value
  };
};

export const setUserAttributes = async (username, attributes) => {
  const userAttributes = Object.entries(attributes).map(([name, value]) => ({
    Name: name,
    Value: value
  }));
  
  const params = {
    UserPoolId: USER_POOL_ID,
    Username: username,
    UserAttributes: userAttributes
  };
  
  await cognito.adminUpdateUserAttributes(params).promise();
};

export const setupMFAForNewUser = async (username, tempPassword) => {
  const secretHash = await calculateSecretHash(username, CLIENT_ID, CLIENT_SECRET);
  
  try {
    // Step 1: Authenticate to get access token
    const authResponse = await cognito.adminInitiateAuth({
      UserPoolId: USER_POOL_ID,
      ClientId: CLIENT_ID,
      AuthFlow: 'ADMIN_NO_SRP_AUTH',
      AuthParameters: {
        USERNAME: username,
        PASSWORD: tempPassword,
        SECRET_HASH: secretHash
      }
    }).promise();
    
    console.log('Auth response:', JSON.stringify(authResponse, null, 2));
    
    let accessToken;
    
    if (authResponse.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      // Complete the password challenge with same password to make it permanent
      const challengeResponse = await cognito.adminRespondToAuthChallenge({
        UserPoolId: USER_POOL_ID,
        ClientId: CLIENT_ID,
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        ChallengeResponses: {
          USERNAME: username,
          NEW_PASSWORD: tempPassword,
          SECRET_HASH: secretHash
        },
        Session: authResponse.Session
      }).promise();
      
      console.log('Challenge response:', JSON.stringify(challengeResponse, null, 2));
      
      if (challengeResponse.ChallengeName === 'MFA_SETUP') {
        // Handle MFA_SETUP challenge - associate software token using session
        const associateResponse = await cognito.associateSoftwareToken({
          Session: challengeResponse.Session
        }).promise();
        
        return {
          secretCode: associateResponse.SecretCode,
          session: challengeResponse.Session,
          username
        };
      } else if (challengeResponse.AuthenticationResult?.AccessToken) {
        accessToken = challengeResponse.AuthenticationResult.AccessToken;
      }
    } else if (authResponse.AuthenticationResult?.AccessToken) {
      accessToken = authResponse.AuthenticationResult.AccessToken;
    }
    
    console.log('Access token:', accessToken ? 'FOUND' : 'NOT FOUND');
    
    if (!accessToken) {
      console.error('Auth response structure:', {
        challengeName: authResponse.ChallengeName,
        hasAuthResult: !!authResponse.AuthenticationResult,
        authResultKeys: authResponse.AuthenticationResult ? Object.keys(authResponse.AuthenticationResult) : 'N/A'
      });
      throw new Error('Failed to get access token for MFA setup');
    }
    
    // Step 2: Associate software token
    const associateResponse = await cognito.associateSoftwareToken({
      AccessToken: accessToken
    }).promise();
    
    return {
      secretCode: associateResponse.SecretCode,
      accessToken,
      username
    };
  } catch (error) {
    console.error('Error in setupMFAForNewUser:', error);
    throw error;
  }
};

export const completeMFASetupForNewUser = async (accessToken, totpCode, username) => {
  try {
    console.log('Starting MFA completion with accessToken:', accessToken ? 'PRESENT' : 'MISSING');
    
    // Step 1: Verify the software token using access token
    const verifyResponse = await cognito.verifySoftwareToken({
      AccessToken: accessToken,
      UserCode: totpCode
    }).promise();
    
    console.log('Verify response:', verifyResponse);
    
    if (verifyResponse.Status !== 'SUCCESS') {
      throw new Error('TOTP verification failed');
    }
    
    // Step 2: Enable TOTP MFA for the user
    await cognito.adminSetUserMFAPreference({
      UserPoolId: USER_POOL_ID,
      Username: username,
      SoftwareTokenMfaSettings: {
        Enabled: true,
        PreferredMfa: true
      }
    }).promise();
    
    return verifyResponse;
  } catch (error) {
    console.error('Error in completeMFASetupForNewUser:', error);
    throw error;
  }
};

export const enableUser = async (username) => {
  const params = {
    UserPoolId: USER_POOL_ID,
    Username: username
  };
  
  await cognito.adminEnableUser(params).promise();
};

export const disableUser = async (username) => {
  const params = {
    UserPoolId: USER_POOL_ID,
    Username: username
  };
  
  await cognito.adminDisableUser(params).promise();
};

export const validateAdminCredentials = async (email, password) => {
  try {
    const params = {
      TableName: ADMIN_TABLE_NAME,
      Key: { email: email }
    };

    const response = await dynamodb.get(params).promise();

    if (!response.Item) {
      return { success: false, message: 'Admin not found' };
    }

    if (response.Item.password === password) {
      return { 
        success: true, 
        admin: {
          email: response.Item.email,
          name: response.Item.name || 'Admin'
        }
      };
    } else {
      return { success: false, message: 'Invalid password' };
    }

  } catch (error) {
    console.error('DynamoDB authentication error:', error);
    return { success: false, message: 'Authentication service error' };
  }
};

export const recreateUser = async (username, tempPassword) => {
  // Get current user attributes before deletion
  const currentUser = await cognito.adminGetUser({
    UserPoolId: USER_POOL_ID,
    Username: username
  }).promise();
  
  const email = currentUser.UserAttributes.find(attr => attr.Name === 'email')?.Value || username;
  const name = currentUser.UserAttributes.find(attr => attr.Name === 'name')?.Value || '';
  const company = currentUser.UserAttributes.find(attr => attr.Name === 'profile')?.Value || '';
  
  // Delete the existing user
  await cognito.adminDeleteUser({
    UserPoolId: USER_POOL_ID,
    Username: username
  }).promise();
  
  // Set MFA configuration to REQUIRED
  await updateUserPoolMFAConfig('ON');
  
  // Recreate user with same attributes
  const userAttributes = [
    { Name: 'email', Value: email },
    { Name: 'email_verified', Value: 'true' }
  ];
  
  if (name) userAttributes.push({ Name: 'name', Value: name });
  if (company) userAttributes.push({ Name: 'profile', Value: company });
  
  const createResponse = await cognito.adminCreateUser({
    UserPoolId: USER_POOL_ID,
    Username: email,
    UserAttributes: userAttributes,
    TemporaryPassword: tempPassword,
    MessageAction: 'SUPPRESS'
  }).promise();
  
  return createResponse.User;
};

export const createUserSimple = async (email, name, company, tempPassword) => {
  // Create user with all attributes
  const userAttributes = [
    { Name: 'email', Value: email },
    { Name: 'email_verified', Value: 'true' }
  ];
  
  if (name) userAttributes.push({ Name: 'name', Value: name });
  if (company) userAttributes.push({ Name: 'profile', Value: company });
  
  const createResponse = await cognito.adminCreateUser({
    UserPoolId: USER_POOL_ID,
    Username: email,
    UserAttributes: userAttributes,
    TemporaryPassword: tempPassword,
    MessageAction: 'SUPPRESS'
  }).promise();
  
  // Switch to REQUIRED configuration
  await updateUserPoolMFAConfig('ON');
  
  return {
    user: createResponse.User,
    tempPassword
  };
};



export const switchToRequiredMFA = async () => {
  // Switch to REQUIRED to enforce MFA for all users with MFA active
  await updateUserPoolMFAConfig('ON');
  return { success: true };
};

export const fixMFAEnforcement = async () => {
  console.log('=== MFA ENFORCEMENT FIX ===');
  console.log('Issue: In OPTIONAL mode, MFA enforcement depends on client application behavior');
  console.log('Solution: Switch to REQUIRED mode for consistent MFA enforcement');
  console.log('This will ensure ALL users with MFA devices are prompted for MFA during login');
  
  return {
    issue: 'OPTIONAL MFA mode allows client apps to skip MFA challenges',
    solution: 'Switch to REQUIRED MFA mode',
    recommendation: 'Use the "Switch to MFA REQUIRED Configuration" button'
  };
};

export const getMFADeviceDetails = async (username) => {
  try {
    // Get user details which includes MFA information
    const userResponse = await cognito.adminGetUser({
      UserPoolId: USER_POOL_ID,
      Username: username
    }).promise();
    
    // Try to get software token details if user has TOTP MFA
    let softwareTokenDetails = null;
    if (userResponse.UserMFASettingList && userResponse.UserMFASettingList.includes('SOFTWARE_TOKEN_MFA')) {
      try {
        // This will only work if we have the user's access token, which we don't in admin context
        // So we'll return the basic info we have
        softwareTokenDetails = {
          deviceName: 'Software Token',
          deviceKey: 'N/A (Admin View)',
          enabled: true
        };
      } catch (error) {
        console.log('Cannot get software token details in admin context');
      }
    }
    
    return {
      mfaOptions: userResponse.MFAOptions || [],
      userMFASettingList: userResponse.UserMFASettingList || [],
      preferredMfaSetting: userResponse.PreferredMfaSetting,
      softwareTokenDetails
    };
  } catch (error) {
    console.error('Error getting MFA device details:', error);
    return {
      mfaOptions: [],
      userMFASettingList: [],
      preferredMfaSetting: null,
      softwareTokenDetails: null
    };
  }
};

export const compareMFASettings = async (workingUsername, nonWorkingUsername) => {
  try {
    const workingUser = await cognito.adminGetUser({
      UserPoolId: USER_POOL_ID,
      Username: workingUsername
    }).promise();
    
    const nonWorkingUser = await cognito.adminGetUser({
      UserPoolId: USER_POOL_ID,
      Username: nonWorkingUsername
    }).promise();
    
    const workingDevices = await getMFADeviceDetails(workingUsername);
    const nonWorkingDevices = await getMFADeviceDetails(nonWorkingUsername);
    
    console.log('=== DETAILED MFA COMPARISON ===');
    console.log('User 1 (chnoman1213+3@gmail.com - asks for MFA):', {
      username: workingUsername,
      MFAOptions: workingUser.MFAOptions,
      UserMFASettingList: workingUser.UserMFASettingList,
      PreferredMfaSetting: workingUser.PreferredMfaSetting,
      UserStatus: workingUser.UserStatus,
      Enabled: workingUser.Enabled,
      UserCreateDate: workingUser.UserCreateDate,
      UserLastModifiedDate: workingUser.UserLastModifiedDate,
      AllAttributes: workingUser.UserAttributes,
      MFADevices: workingDevices
    });
    
    console.log('User 2 (adil@yahoo.com - does NOT ask for MFA):', {
      username: nonWorkingUsername,
      MFAOptions: nonWorkingUser.MFAOptions,
      UserMFASettingList: nonWorkingUser.UserMFASettingList,
      PreferredMfaSetting: nonWorkingUser.PreferredMfaSetting,
      UserStatus: nonWorkingUser.UserStatus,
      Enabled: nonWorkingUser.Enabled,
      UserCreateDate: nonWorkingUser.UserCreateDate,
      UserLastModifiedDate: nonWorkingUser.UserLastModifiedDate,
      AllAttributes: nonWorkingUser.UserAttributes,
      MFADevices: nonWorkingDevices
    });
    
    // Check if there are any differences in the key MFA fields
    const differences = [];
    if (JSON.stringify(workingUser.MFAOptions) !== JSON.stringify(nonWorkingUser.MFAOptions)) {
      differences.push('MFAOptions differ');
    }
    if (JSON.stringify(workingUser.UserMFASettingList) !== JSON.stringify(nonWorkingUser.UserMFASettingList)) {
      differences.push('UserMFASettingList differ');
    }
    if (workingUser.PreferredMfaSetting !== nonWorkingUser.PreferredMfaSetting) {
      differences.push('PreferredMfaSetting differ');
    }
    if (JSON.stringify(workingDevices) !== JSON.stringify(nonWorkingDevices)) {
      differences.push('MFA Devices differ');
    }
    
    console.log('Differences found:', differences.length > 0 ? differences : 'No differences in MFA settings');
    
    // Additional analysis
    console.log('=== ADDITIONAL ANALYSIS ===');
    console.log('Creation date difference:', Math.abs(workingUser.UserCreateDate - nonWorkingUser.UserCreateDate) / (1000 * 60 * 60 * 24), 'days');
    
    // Check if users were created through different methods
    const workingUserSub = workingUser.UserAttributes.find(attr => attr.Name === 'sub')?.Value;
    const nonWorkingUserSub = nonWorkingUser.UserAttributes.find(attr => attr.Name === 'sub')?.Value;
    
    console.log('User SUB comparison:', {
      workingUserSub: workingUserSub?.substring(0, 8) + '...',
      nonWorkingUserSub: nonWorkingUserSub?.substring(0, 8) + '...'
    });
    
    // Try to determine if MFA was set up differently
    const workingLastModified = new Date(workingUser.UserLastModifiedDate);
    const workingCreated = new Date(workingUser.UserCreateDate);
    const nonWorkingLastModified = new Date(nonWorkingUser.UserLastModifiedDate);
    const nonWorkingCreated = new Date(nonWorkingUser.UserCreateDate);
    
    console.log('MFA setup timing analysis:', {
      workingUser: {
        timeBetweenCreateAndModify: (workingLastModified - workingCreated) / 1000 + ' seconds',
        likelyMFASetupTime: workingLastModified > workingCreated ? 'After creation' : 'During creation'
      },
      nonWorkingUser: {
        timeBetweenCreateAndModify: (nonWorkingLastModified - nonWorkingCreated) / 1000 + ' seconds',
        likelyMFASetupTime: nonWorkingLastModified > nonWorkingCreated ? 'After creation' : 'During creation'
      }
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error comparing MFA settings:', error);
    throw error;
  }
};

export const ensureMFAPreferenceForActiveUsers = async () => {
  try {
    const users = await listUsers();
    let updatedCount = 0;
    
    for (const user of users) {
      try {
        const mfaStatus = await getUserMFAStatus(user.Username);
        console.log(`User ${user.Username} MFA status:`, mfaStatus);
        
        if (mfaStatus.mfaActive) {
          // Get current MFA preference
          const currentUser = await cognito.adminGetUser({
            UserPoolId: USER_POOL_ID,
            Username: user.Username
          }).promise();
          
          console.log(`Current MFA settings for ${user.Username}:`, {
            MFAOptions: currentUser.MFAOptions,
            UserMFASettingList: currentUser.UserMFASettingList,
            PreferredMfaSetting: currentUser.PreferredMfaSetting
          });
          
          // User has MFA active, ensure preference is set to preferred
          await cognito.adminSetUserMFAPreference({
            UserPoolId: USER_POOL_ID,
            Username: user.Username,
            SoftwareTokenMfaSettings: {
              Enabled: true,
              PreferredMfa: true
            }
          }).promise();
          
          // Verify the setting was applied
          const updatedUser = await cognito.adminGetUser({
            UserPoolId: USER_POOL_ID,
            Username: user.Username
          }).promise();
          
          console.log(`Updated MFA settings for ${user.Username}:`, {
            MFAOptions: updatedUser.MFAOptions,
            UserMFASettingList: updatedUser.UserMFASettingList,
            PreferredMfaSetting: updatedUser.PreferredMfaSetting
          });
          
          updatedCount++;
        }
      } catch (error) {
        console.log(`Could not set MFA preference for ${user.Username}:`, error.message);
      }
    }
    
    return { success: true, updatedCount };
  } catch (error) {
    console.error('Error ensuring MFA preferences:', error);
    throw error;
  }
};