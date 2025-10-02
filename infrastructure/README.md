# Infrastructure Setup

## Prerequisites
- Terraform installed
- AWS CLI configured with appropriate credentials

## Deployment Steps

1. **Initialize Terraform**
```bash
cd infrastructure
terraform init
```

2. **Plan Infrastructure**
```bash
terraform plan
```

3. **Deploy Infrastructure**
```bash
terraform apply
```

## Resources Created

### DynamoDB Table
- **Name**: `admin-credentials`
- **Primary Key**: `email`
- **Billing**: Pay-per-request
- **Default Admin**: `admin@yourcompany.com` / `AdminPass123!`

## Outputs
After deployment, Terraform will output:
- DynamoDB table name
- Admin credentials (sensitive)

## Cleanup
```bash
terraform destroy
```