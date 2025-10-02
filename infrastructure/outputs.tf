output "dynamodb_table_name" {
  description = "Name of the DynamoDB table"
  value       = aws_dynamodb_table.admin_credentials.name
}

output "api_gateway_url" {
  description = "API Gateway URL (VPC access only)"
  value       = "https://${aws_api_gateway_rest_api.admin_panel_api.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/prod"
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.admin_panel_api.function_name
}

output "admin_panel_bucket_name" {
  description = "S3 bucket name for admin panel"
  value       = aws_s3_bucket.admin_panel.bucket
}

output "admin_panel_website_url" {
  description = "Admin panel website URL (VPC access only)"
  value       = "http://${aws_s3_bucket_website_configuration.admin_panel.website_endpoint}"
}

output "s3_vpc_endpoint_id" {
  description = "VPC Endpoint ID for S3"
  value       = aws_vpc_endpoint.s3.id
}

output "api_vpc_endpoint_id" {
  description = "VPC Endpoint ID for API Gateway"
  value       = aws_vpc_endpoint.api_gateway.id
}





output "admin_credentials" {
  description = "Default admin credentials"
  value = {
    email    = "admin@yourcompany.com"
    password = "AdminPass123!"
  }
  sensitive = true
}