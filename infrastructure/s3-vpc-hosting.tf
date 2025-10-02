# S3 bucket for admin panel hosting (VPC-only)
resource "aws_s3_bucket" "admin_panel" {
  bucket = var.admin_panel_bucket_name
}

# S3 bucket website configuration
resource "aws_s3_bucket_website_configuration" "admin_panel" {
  bucket = aws_s3_bucket.admin_panel.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

# S3 bucket public access block
resource "aws_s3_bucket_public_access_block" "admin_panel" {
  bucket = aws_s3_bucket.admin_panel.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# S3 bucket policy - VPC-only access
resource "aws_s3_bucket_policy" "admin_panel" {
  bucket = aws_s3_bucket.admin_panel.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "VPCEndpointAccess"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.admin_panel.arn}/*"
        Condition = {
          StringEquals = {
            "aws:sourceVpce" = aws_vpc_endpoint.s3.id
          }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.admin_panel]
}

# VPC Endpoint for S3 (Gateway type)
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = var.vpc_id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = var.route_table_ids
}