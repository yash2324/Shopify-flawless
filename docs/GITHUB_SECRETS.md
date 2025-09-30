# GitHub Actions Secrets Setup Guide

## Required Secrets

To enable automated deployment, add these secrets to your GitHub repository:

**Path**: Repository → Settings → Secrets and variables → Actions → New repository secret

### Infrastructure Secrets

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `EC2_HOST` | Your EC2 instance IP address | AWS Console → EC2 → Your Instance → Public IPv4 address |
| `EC2_SSH_KEY` | SSH private key for EC2 access | The private key file (.pem) you use to SSH |

### Docker Registry Secrets

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `DOCKER_USERNAME` | Docker Hub username | Your Docker Hub account username |
| `DOCKER_PASSWORD` | Docker Hub access token | Docker Hub → Account Settings → Security → New Access Token |

### Application Secrets

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `SHOPIFY_SHOP_DOMAIN` | Your Shopify store domain | Format: `yourstore.myshopify.com` |
| `SHOPIFY_ACCESS_TOKEN` | Shopify Admin API access token | Shopify Admin → Apps → Develop apps → Create private app |
| `REDIS_PASSWORD` | Strong Redis password | Generate: `openssl rand -base64 32` |
| `DOMAIN_NAME` | Your production domain | Example: `mystore-analytics.com` |

## Step-by-Step Secret Setup

### 1. EC2_SSH_KEY Setup

```bash
# On your local machine, copy your private key content
cat ~/.ssh/your-ec2-key.pem

# Copy the entire output including headers:
# -----BEGIN RSA PRIVATE KEY-----
# ... key content ...
# -----END RSA PRIVATE KEY-----
```

### 2. Docker Hub Token Setup

1. Go to [Docker Hub](https://hub.docker.com)
2. Click your avatar → Account Settings
3. Go to Security tab
4. Click "New Access Token"
5. Name: "GitHub Actions Deploy"
6. Copy the generated token

### 3. Shopify API Token Setup

1. Go to your Shopify Admin
2. Navigate to Apps → App and sales channel settings
3. Click "Develop apps"
4. Click "Create an app"
5. Configure Admin API access scopes:
   - `read_orders`
   - `read_products`
   - `read_customers`
   - `read_analytics`
   - `read_inventory`
6. Install the app and copy the Admin API access token

### 4. Redis Password Generation

```bash
# Generate a strong password
openssl rand -base64 32

# Or use this online: https://passwordsgenerator.net/
# Requirements: At least 24 characters, mixed case, numbers, symbols
```

## Validation Script

Create this script to test your secrets:

```bash
#!/bin/bash
# test-secrets.sh

echo "🔍 Testing GitHub Secrets Configuration..."

# Test Docker Hub access
echo "Testing Docker Hub access..."
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin

# Test EC2 connectivity
echo "Testing EC2 connectivity..."
echo "$EC2_SSH_KEY" > /tmp/ec2_key
chmod 600 /tmp/ec2_key
ssh -i /tmp/ec2_key -o ConnectTimeout=10 ubuntu@$EC2_HOST "echo 'EC2 connection successful'"
rm /tmp/ec2_key

# Test Shopify API
echo "Testing Shopify API..."
curl -H "X-Shopify-Access-Token: $SHOPIFY_ACCESS_TOKEN" \
     "https://$SHOPIFY_SHOP_DOMAIN/admin/api/2025-04/shop.json"

echo "✅ All secrets validated!"
```

## Security Best Practices

### 1. Rotate Secrets Regularly
- Shopify tokens: Every 6 months
- Docker Hub tokens: Every year
- SSH keys: Every year
- Redis passwords: Every 6 months

### 2. Use Least Privilege
- Shopify API: Only enable required scopes
- Docker Hub: Use access tokens, not passwords
- EC2: Use dedicated deployment key

### 3. Monitor Secret Usage
- Check GitHub Actions logs for failed authentications
- Monitor Docker Hub for unauthorized access
- Review EC2 SSH logs regularly

## Troubleshooting

### Common Issues

#### "Permission denied (publickey)" Error
```yaml
# Solution: Check EC2_SSH_KEY format
# Ensure it includes header/footer:
-----BEGIN RSA PRIVATE KEY-----
[key content]
-----END RSA PRIVATE KEY-----
```

#### Docker Login Failed
```yaml
# Solution: Regenerate Docker Hub token
# 1. Delete old token in Docker Hub
# 2. Create new token
# 3. Update DOCKER_PASSWORD secret
```

#### Shopify API 401 Error
```yaml
# Solution: Verify token and domain
# 1. Check SHOPIFY_SHOP_DOMAIN format (include .myshopify.com)
# 2. Ensure API token has required permissions
# 3. Check if app is installed and active
```

## Environment-Specific Secrets

### Production Secrets
Use these for main branch deployments:
```
EC2_HOST=your-production-ip
DOMAIN_NAME=your-production-domain.com
```

### Staging Secrets (Optional)
For staging environment:
```
EC2_HOST_STAGING=your-staging-ip
DOMAIN_NAME_STAGING=staging.your-domain.com
```

## Secret Management Tools

For enterprise setups, consider:
- **AWS Secrets Manager**: For AWS-native secret management
- **HashiCorp Vault**: For advanced secret management
- **Azure Key Vault**: If using Azure services

## Backup Your Secrets

Keep a secure backup of your secrets in:
- Password manager (recommended)
- Encrypted local file
- Secure company documentation system

**Never store secrets in:**
- Git repositories
- Plain text files
- Unsecured cloud storage
- Email or chat messages