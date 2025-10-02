# Admin Panel VPC Deployment Guide

## Overview
This admin panel is deployed to AWS with VPC-only access for security. The architecture includes:
- **React Frontend**: Hosted on S3 with VPC endpoint access
- **Lambda API**: Handles all Cognito operations
- **API Gateway**: Regional endpoint with VPC endpoint
- **DynamoDB**: Admin credentials storage

## Prerequisites

### 1. AWS Credentials
Set up GitHub Secrets:
```
AWS_ACCESS_KEY_ID: Your AWS access key
AWS_SECRET_ACCESS_KEY: Your AWS secret key
```

### 2. Terraform State
Ensure your infrastructure is already deployed:
```bash
cd infrastructure
terraform init
terraform plan
terraform apply
```

## Deployment Process

### Automatic Deployment (Recommended)
1. Push to `main` branch or trigger workflow manually
2. GitHub Actions will:
   - Build React app with production config
   - Deploy Lambda function updates
   - Upload build files to S3
   - Output deployment URLs

### Manual Deployment
```bash
# 1. Build React app
npm run build

# 2. Deploy infrastructure
cd infrastructure
terraform apply

# 3. Upload to S3
BUCKET_NAME=$(terraform output -raw admin_panel_bucket_name)
aws s3 sync ../build/ s3://${BUCKET_NAME}/ --delete
```

## Access URLs

After deployment, get URLs from Terraform:
```bash
cd infrastructure
terraform output admin_panel_website_url  # S3 website URL
terraform output api_gateway_url          # API Gateway URL
```

## VPC Access Setup

### Option 1: EC2 Instance in VPC
1. Launch EC2 instance in the same VPC
2. Access via: `http://BUCKET_NAME.s3-website-us-east-1.amazonaws.com`

### Option 2: VPN Connection
1. Set up VPN to your VPC
2. Access admin panel through VPC endpoints

### Option 3: Direct Connect
1. Use AWS Direct Connect to VPC
2. Access through private network

## Environment Configuration

### Development (Localhost)
Uses direct AWS SDK calls:
```env
# No REACT_APP_API_URL = direct SDK mode
REACT_APP_USER_POOL_ID=us-east-1_adCNyuj1g
REACT_APP_CLIENT_ID=6jco9g2vmm2nfqkb5rcsmtq3gt
```

### Production (VPC)
Uses API Gateway:
```env
REACT_APP_API_URL=https://API_ID.execute-api.us-east-1.amazonaws.com/prod
REACT_APP_USER_POOL_ID=us-east-1_adCNyuj1g
REACT_APP_CLIENT_ID=6jco9g2vmm2nfqkb5rcsmtq3gt
```

## Troubleshooting

### Build Issues
```bash
# Clear cache and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Lambda Issues
```bash
# Check Lambda logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/admin-panel-api
```

### S3 Upload Issues
```bash
# Check bucket policy and VPC endpoint
aws s3api get-bucket-policy --bucket BUCKET_NAME
```

## Security Notes
- ✅ VPC-only access (no public internet)
- ✅ Admin credentials in DynamoDB
- ✅ Cognito integration for user management
- ✅ Lambda with minimal IAM permissions
- ⚠️ Ensure VPC security groups are properly configured