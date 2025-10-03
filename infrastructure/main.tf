terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket         = "noman-rocket-zulfiqar-terraform-backend-us-east-1"
    key            = "cognito-admin-panel/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "noman-rocket-zulfiqar-terraform-backend-us-east-1.lock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
}

# DynamoDB table for admin credentials
resource "aws_dynamodb_table" "admin_credentials" {
  name           = "admin-credentials"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "email"

  attribute {
    name = "email"
    type = "S"
  }

  tags = {
    Name        = "Admin Credentials"
    Environment = var.environment
    Project     = "3vue-admin-panel"
  }
}

# Insert default admin user
resource "aws_dynamodb_table_item" "default_admin" {
  table_name = aws_dynamodb_table.admin_credentials.name
  hash_key   = aws_dynamodb_table.admin_credentials.hash_key

  item = jsonencode({
    email = {
      S = "admin@yourcompany.com"
    }
    password = {
      S = "AdminPass123!"
    }
    name = {
      S = "System Administrator"
    }
  })
}