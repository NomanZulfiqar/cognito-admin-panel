# Lambda function for admin panel API
resource "aws_lambda_function" "admin_panel_api" {
  filename         = "admin-panel-api-v2.zip"
  function_name    = "admin-panel-api"
  role            = aws_iam_role.lambda_role.arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 30

  # Removed VPC config for localhost access

  environment {
    variables = {
      USER_POOL_ID = var.user_pool_id
      CLIENT_ID = var.client_id
      CLIENT_SECRET = var.client_secret
      DYNAMODB_TABLE = aws_dynamodb_table.admin_credentials.name
    }
  }

  depends_on = [data.archive_file.lambda_zip]
}

# Create Lambda deployment package
data "archive_file" "lambda_zip" {
  type        = "zip"
  output_path = "admin-panel-api-v2.zip"
  source_dir  = "../lambda"
}

# IAM role for Lambda
resource "aws_iam_role" "lambda_role" {
  name = "admin-panel-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# IAM policy for Lambda
resource "aws_iam_role_policy" "lambda_policy" {
  name = "admin-panel-lambda-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:ListUsers",
          "cognito-idp:AdminSetUserMFAPreference",
          "cognito-idp:AdminResetUserPassword",
          "cognito-idp:AdminDeleteUser",
          "cognito-idp:DescribeUserPool",
          "cognito-idp:UpdateUserPool"
        ]
        Resource = "arn:aws:cognito-idp:*:*:userpool/${var.user_pool_id}"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = aws_dynamodb_table.admin_credentials.arn
      }
    ]
  })
}

# Security group for Lambda
resource "aws_security_group" "lambda_sg" {
  name_prefix = "admin-panel-lambda-"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# API Gateway (Regional - Internet + VPC access)
resource "aws_api_gateway_rest_api" "admin_panel_api" {
  name = "admin-panel-api"
  
  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

# VPC Endpoint for API Gateway
resource "aws_vpc_endpoint" "api_gateway" {
  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.execute-api"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.subnet_ids
  security_group_ids  = [aws_security_group.api_gateway_endpoint_sg.id]
  
  private_dns_enabled = true
}

# Security group for API Gateway VPC endpoint
resource "aws_security_group" "api_gateway_endpoint_sg" {
  name_prefix = "admin-panel-api-endpoint-"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [data.aws_vpc.selected.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# API Gateway resource (proxy)
resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.admin_panel_api.id
  parent_id   = aws_api_gateway_rest_api.admin_panel_api.root_resource_id
  path_part   = "{proxy+}"
}

# API Gateway method
resource "aws_api_gateway_method" "proxy" {
  rest_api_id   = aws_api_gateway_rest_api.admin_panel_api.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "ANY"
  authorization = "NONE"
}

# API Gateway integration
resource "aws_api_gateway_integration" "lambda" {
  rest_api_id = aws_api_gateway_rest_api.admin_panel_api.id
  resource_id = aws_api_gateway_method.proxy.resource_id
  http_method = aws_api_gateway_method.proxy.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.admin_panel_api.invoke_arn
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.admin_panel_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.admin_panel_api.execution_arn}/*/*"
}

# API Gateway deployment
resource "aws_api_gateway_deployment" "admin_panel_api" {
  depends_on = [
    aws_api_gateway_method.proxy,
    aws_api_gateway_integration.lambda,
  ]

  rest_api_id = aws_api_gateway_rest_api.admin_panel_api.id
  stage_name  = "prod"
  
  # Force new deployment when API changes
  triggers = {
    redeployment = "no-policy-${timestamp()}"
  }
}

# Data sources
data "aws_region" "current" {}
data "aws_vpc" "selected" {
  id = var.vpc_id
}