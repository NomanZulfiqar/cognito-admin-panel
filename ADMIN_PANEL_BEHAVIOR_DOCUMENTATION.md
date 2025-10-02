# Admin Panel User State Behavior Documentation

## Current User States

### User 1: chnoman1213+1@gmail.com
- **Status**: CONFIRMED
- **Email Verified**: Yes
- **MFA Status**: MFA Active
- **Name**: test 1

### User 2: chnoman1213+2@gmail.com
- **Status**: FORCE_CHANGE_PASSWORD
- **Email Verified**: Yes
- **MFA Status**: MFA Inactive
- **Name**: test 2

### User 3: chnoman1213+3@gmail.com
- **Status**: FORCE_CHANGE_PASSWORD
- **Email Verified**: Yes
- **MFA Status**: MFA Active
- **Name**: test 3

### User 4: chnoman1213+4@gmail.com
- **Status**: CONFIRMED
- **Email Verified**: Yes
- **MFA Status**: MFA Inactive
- **Name**: test 4

## Button Actions and Expected Behaviors

### Available Buttons for Each User:
1. Set Permanent Password
2. Reset Temporary Password
3. Reset MFA
4. Enable MFA
5. Disable MFA

---

## Button Behavior Testing Results

*[This section will be filled based on your testing results for each user and button combination]*

### User 1 (CONFIRMED + MFA Active):
- **Set Permanent Password**: [Result to be documented]
- **Reset Temporary Password**: [Result to be documented]
- **Reset MFA**: [Result to be documented]
- **Enable MFA**: [Result to be documented]
- **Disable MFA**: [Result to be documented]

### User 2 (FORCE_CHANGE_PASSWORD + MFA Inactive):
- **Set Permanent Password**: [Result to be documented]
- **Reset Temporary Password**: [Result to be documented]
- **Reset MFA**: [Result to be documented]
- **Enable MFA**: [Result to be documented]
- **Disable MFA**: [Result to be documented]

### User 3 (FORCE_CHANGE_PASSWORD + MFA Active):
- **Set Permanent Password**: [Result to be documented]
- **Reset Temporary Password**: [Result to be documented]
- **Reset MFA**: [Result to be documented]
- **Enable MFA**: [Result to be documented]
- **Disable MFA**: [Result to be documented]

### User 4 (CONFIRMED + MFA Inactive):
- **Set Permanent Password**: [Result to be documented]
- **Reset Temporary Password**: [Result to be documented]
- **Reset MFA**: [Result to be documented]
- **Enable MFA**: [Result to be documented]
- **Disable MFA**: [Result to be documented]

---

## Notes
- User Pool MFA Configuration: OPTIONAL
- All users have verified emails
- Testing performed on localhost environment
- AWS SDK v2 implementation