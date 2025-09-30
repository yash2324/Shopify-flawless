# AWS EC2 Deployment Setup Guide

## Prerequisites
- AWS Account with appropriate permissions
- Domain name (e.g., your-domain.com)
- GitHub repository

## 1. EC2 Instance Setup

### Launch EC2 Instance
1. **Instance Type**: t3.medium or t3.large (recommended for production)
2. **AMI**: Ubuntu Server 22.04 LTS
3. **Storage**: 20GB SSD (minimum)
4. **Key Pair**: Create/use existing key pair for SSH access

### Security Group Configuration
Create a security group with these inbound rules:

| Type | Protocol | Port Range | Source | Description |
|------|----------|------------|--------|-------------|
| SSH | TCP | 22 | Your IP | SSH access |
| HTTP | TCP | 80 | 0.0.0.0/0 | HTTP traffic |
| HTTPS | TCP | 443 | 0.0.0.0/0 | HTTPS traffic |
| Custom TCP | TCP | 3000 | 0.0.0.0/0 | API access (optional) |

### Elastic IP
1. Allocate an Elastic IP address
2. Associate it with your EC2 instance
3. Update your domain's DNS A record to point to this IP

## 2. Domain & DNS Setup

### DNS Configuration
Point your domain to the EC2 instance:
```
Type: A
Name: @ (or your subdomain)
Value: [Your Elastic IP]
TTL: 300
```

For API subdomain (optional):
```
Type: A
Name: api
Value: [Your Elastic IP]
TTL: 300
```

## 3. Server Initial Setup

SSH into your server and run:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Nginx (for SSL termination)
sudo apt install nginx certbot python3-certbot-nginx -y

# Install Git
sudo apt install git -y

# Reboot to apply Docker group changes
sudo reboot
```

## 4. Application Directory Structure

Create this structure on your server:
```
/home/ubuntu/
├── shopify-analytics/
│   ├── app/                    # Application code
│   ├── nginx/                  # Nginx configs
│   ├── ssl/                    # SSL certificates
│   ├── logs/                   # Application logs
│   └── backups/                # Database backups
```

## 5. Environment Variables

You'll need these environment variables on the server:
- `SHOPIFY_SHOP_DOMAIN`
- `SHOPIFY_ACCESS_TOKEN`
- `REDIS_PASSWORD` (generate a strong password)
- `DOMAIN_NAME` (your domain)

## Next Steps
1. Setup CI/CD pipeline (GitHub Actions)
2. Configure production environment files
3. Setup SSL certificates
4. Deploy and test