# Cognito Admin Panel

Administrative interface for managing Cognito users in the test user pool `2fgq0d`.

## Features

- **Search by username** - Find specific users
- **List all users** - View all users in the pool
- **Toggle MFA** - Enable/disable MFA for individual users
- **Force password reset** - Require users to reset their passwords

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure AWS credentials:
```bash
cp .env.example .env
# Edit .env with your AWS credentials
```

3. Start the development server:
```bash
npm start
```

## AWS Permissions Required

The AWS credentials must have the following Cognito permissions:
- `cognito-idp:ListUsers`
- `cognito-idp:AdminSetUserMFAPreference`
- `cognito-idp:AdminResetUserPassword`

## Usage

1. **Search Users**: Enter a username in the search box and click "Search"
2. **List All Users**: Click "List All Users" to see all users in the pool
3. **Toggle MFA**: Click the MFA toggle button for any user
4. **Force Password Reset**: Click "Force Password Reset" to require a user to change their password

## Test User Pool

This application is configured for the test user pool: `2fgq0d`