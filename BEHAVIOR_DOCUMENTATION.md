# Cognito Admin Panel - Behavior Documentation

## Application Overview
- **Purpose**: AWS Cognito User Pool management with MFA capabilities
- **User Pool ID**: us-east-1_adCNyuj1g
- **Region**: us-east-1
- **Authentication**: Admin-only access with hardcoded credentials

## Documented Behaviors

### Behavior 1: User Pool MFA Requirement Change Override

**Scenario Description:**
When changing User Pool MFA configuration from "Required" to "Optional", individual user MFA settings are automatically overridden.

**Step-by-Step Process:**
1. User Pool MFA setting: "Optional"
2. Admin manually disables MFA for specific users
3. Admin changes User Pool MFA setting: "Optional" → "Required"
4. Admin changes User Pool MFA setting: "Required" → "Optional"

**Observed Result:**
- Users with previously disabled MFA are automatically re-enabled (only affects users who have MFA registered)
- Individual user MFA preferences are not preserved for users with existing MFA registration
- Only users who have previously registered MFA get re-enabled, not all users in the pool
- Users without any MFA registration history remain unaffected

**Technical Implementation:**
```javascript
// Function: updateUserPoolMFAConfig
if (mfaConfiguration === 'OPTIONAL') {
  setTimeout(async () => {
    await enableMFAForAllUsers(); // Overrides individual settings
  }, 1000);
}
```

**Impact:**
- Loss of granular MFA control
- Admin decisions are overridden by pool-level changes
- Users who should have MFA disabled get it re-enabled

---

### Behavior 2: Incomplete MFA Reset Process

**Scenario Description:**
The "Reset MFA" button only disables MFA without completing a full security reset process.

**Step-by-Step Process:**
1. User has active MFA configuration
2. Admin clicks "Reset MFA" button
3. Admin does not complete MFA re-registration process

**Observed Result:**
- User MFA status changes to "Disabled"
- User password becomes invalid/corrupted during the reset process
- Previous login credentials no longer work (returns "wrong password" error)
- Admin must manually set a new password using the "Set Password" button
- User cannot login until admin provides new credentials

**Technical Implementation:**
```javascript
// Function: handleResetCustomMFA
const result = await customMFAService.adminResetMFA(username);
// Only disables MFA - no password reset included
```

**Final User State:**
- **MFA Status**: Disabled
- **Password**: Corrupted/Invalid (original password no longer works)
- **Access**: Login blocked until admin sets new password
- **Security Level**: Temporarily locked (MFA removed, password invalidated, requires admin intervention)

---

## System Architecture

### Authentication Layers:
1. **Admin Panel Access**: `admin@yourcompany.com` / `AdminPass123!`
2. **User Management**: AWS Cognito SDK operations
3. **MFA System**: Custom implementation using otplib

### MFA Implementation:
- **Technology**: otplib for TOTP generation
- **Storage**: localStorage for status tracking
- **Display**: Modal QR code generation
- **Validation**: 6-digit codes, 30-second windows

### User Attributes:
- **Standard**: email, name, email_verified
- **Company Info**: Stored in `profile` attribute
- **Custom Attributes**: None (avoided schema issues)

---

## Current Limitations

### Pool-Level vs Individual Control:
- Pool-level changes override individual user settings
- No preservation of admin-configured user preferences
- Automatic bulk operations affect all users

### MFA Reset Scope:
- Partial reset (MFA disable with password corruption)
- Password becomes invalid but no proper reset procedure
- Incomplete security procedure requiring manual admin intervention
- User loses access until admin manually sets new password

---

*Documentation Date: Current as of latest application state*
*User Pool: us-east-1_adCNyuj1g*
*Application: Cognito Admin Panel*