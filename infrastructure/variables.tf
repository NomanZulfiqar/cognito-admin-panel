variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "3vue"
}

variable "vpc_id" {
  description = "VPC ID where Lambda will be deployed"
  type        = string
}

variable "admin_panel_bucket_name" {
  description = "S3 bucket name for admin panel hosting"
  type        = string
  default     = "cognito-admin-panel-vpc-private"
}

variable "route_table_ids" {
  description = "Route table IDs for VPC endpoint"
  type        = list(string)
}



variable "subnet_ids" {
  description = "List of subnet IDs for Lambda and VPC endpoints"
  type        = list(string)
}

variable "user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
}

variable "client_id" {
  description = "Cognito User Pool Client ID"
  type        = string
}

variable "client_secret" {
  description = "Cognito User Pool Client Secret"
  type        = string
}