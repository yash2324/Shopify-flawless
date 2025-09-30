# EC2 Deployment Guide - Shopify Analytics Backend

This guide will walk you through deploying your Shopify Analytics backend to AWS EC2 with GitHub Actions CI/CD pipeline.

## Prerequisites

- AWS EC2 instance running Ubuntu 20.04/22.04 OR Amazon Linux 2/2023
- Domain name (optional but recommended)
- Docker Hub account (free signup at hub.docker.com)
- GitHub repository

## Phase 1: EC2 Server Initial Setup

### Step 1: Connect to Your EC2 Instance

**For Ubuntu:**
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

**For Amazon Linux:**
```bash
ssh -i your-key.pem ec2-user@your-ec2-ip
```

### Step 2: Get Your Docker Hub Username

1. Go to [hub.docker.com](https://hub.docker.com) and create a free account
2. Choose a username (e.g., `yash2324`)
3. Create a repository named `shopify-analytics`
4. Your Docker image URL will be: `yourusername/shopify-analytics`

### Step 3: Run the Server Setup Script

**For Ubuntu:**
```bash
curl -sSL https://raw.githubusercontent.com/yash2324/Shopify-flawless/refs/heads/main/scripts/server-setup.sh | bash
```

**For Amazon Linux:**
```bash
curl -sSL https://raw.githubusercontent.com/yash2324/Shopify-flawless/refs/heads/main/scripts/server-setup-amazon-linux.sh | bash
```

### Step 3: Reboot the Server

```bash
sudo reboot
```

Wait for the server to restart, then reconnect:

**For Ubuntu:**
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

**For Amazon Linux:**
```bash
ssh -i your-key.pem ec2-user@your-ec2-ip
```

### Step 4: Verify Docker Installation

```bash
docker --version
docker-compose --version
docker run hello-world
```

## Phase 2: Application Setup

### Step 1: Clone Your Repository

```bash
cd ~/shopify-analytics
git clone https://github.com/yourusername/shopifydashboard-main.git app
cd app
```

### Step 2: Create Environment Files

Create the production environment file:

```bash
cp env.example .env.production
nano .env.production
```

Configure the following variables:

```bash
# Application
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Shopify Configuration
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=your-access-token
SHOPIFY_API_VERSION=2023-10

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-super-secure-redis-password

# Docker Configuration (Replace 'yourdockerhub' with your actual Docker Hub username)
DOCKER_IMAGE=yash232004/shopify-analytics
# Example: DOCKER_IMAGE=yash2324/shopify-analytics:latest

# Domain (if you have one)
DOMAIN_NAME=your-domain.com

# Security
JWT_SECRET=your-jwt-secret-key
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=/app/logs/app.log

# Health Check
HEALTH_CHECK_TIMEOUT=5000
```

### Step 3: Create Docker Network

```bash
docker network create shopify-network
```

## Phase 3: Nginx Configuration

### Step 1: Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/shopify-analytics
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;  # Replace with your domain or IP
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # API routes
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000/api/v1/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Default location for static files or redirect
    location / {
        return 200 '{"status":"ok","service":"shopify-analytics-api","timestamp":"$time_iso8601"}';
        add_header Content-Type application/json;
    }

    # Logs
    access_log /var/log/nginx/shopify-analytics.access.log;
    error_log /var/log/nginx/shopify-analytics.error.log;
}
```

### Step 2: Enable the Site

```bash
sudo ln -s /etc/nginx/sites-available/shopify-analytics /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Phase 4: SSL Certificate (Optional but Recommended)

If you have a domain name:

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## Phase 5: GitHub Secrets Configuration

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add the following secrets:

### Required Secrets:

```
# Docker Hub
DOCKER_USERNAME=yourdockerhubusername
DOCKER_PASSWORD=yourdockerhubpassword

# EC2 Connection
EC2_HOST=your-ec2-public-ip
EC2_SSH_KEY=your-private-key-content

# Shopify API
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=your-shopify-access-token

# Redis
REDIS_PASSWORD=your-super-secure-redis-password

# Domain (optional)
DOMAIN_NAME=your-domain.com
```

### How to Add EC2_SSH_KEY:

1. On your local machine, copy your private key content:
```bash
cat ~/.ssh/your-key.pem
```

2. Copy the entire content (including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`)

3. Paste it as the `EC2_SSH_KEY` secret value in GitHub

## Phase 6: Docker Hub Setup

### Step 1: Create Docker Hub Repository

1. Go to Docker Hub (hub.docker.com)
2. Create a new repository named `shopify-analytics`
3. Make it public or private as needed

### Step 2: Build and Push Initial Image

On your local machine or EC2:

```bash
cd /path/to/your/shopifydashboard-main

# Build the image
docker build -t yourdockerhub/shopify-analytics:latest .

# Push to Docker Hub
docker login
docker push yourdockerhub/shopify-analytics:latest
```

## Phase 7: Manual First Deployment

### Step 1: Test Local Deployment

On your EC2 server:

```bash
cd ~/shopify-analytics/app

# Build and start services
docker-compose -f docker-compose.production.yml up -d

# Check logs
docker-compose -f docker-compose.production.yml logs -f

# Test the API
curl http://localhost:3000/api/v1/health
```

### Step 2: Test External Access

From your local machine:

```bash
curl http://your-ec2-ip/api/v1/health
# or
curl https://your-domain.com/api/v1/health
```

## Phase 8: GitHub Actions Deployment

### Step 1: Push to Main Branch

```bash
git add .
git commit -m "Setup production deployment"
git push origin main
```

### Step 2: Monitor Deployment

1. Go to GitHub → Actions tab
2. Watch the deployment workflow
3. Check each step for any errors

### Step 3: Verify Deployment

After successful deployment:

```bash
# Check running containers
docker ps

# Check logs
docker-compose -f docker-compose.production.yml logs app

# Test API endpoints
curl https://your-domain.com/api/v1/health
curl https://your-domain.com/api/dashboard/quick
```

## Phase 9: Monitoring and Maintenance

### Step 1: Use Built-in Monitoring

```bash
# Check system status
~/shopify-analytics/monitor.sh

# View logs
tail -f ~/shopify-analytics/logs/app.log
tail -f ~/shopify-analytics/logs/monitor.log

# Check Docker stats
docker stats
```

### Step 2: Setup Log Monitoring

```bash
# Install log monitoring tools
sudo apt install logwatch -y

# View Docker logs
docker-compose -f docker-compose.production.yml logs --tail=100 -f
```

### Step 3: Backup Management

```bash
# Manual backup
~/shopify-analytics/backup.sh

# View backups
ls -la ~/shopify-analytics/backups/
```

## Troubleshooting

### Common Issues:

1. **Docker permission denied**:
```bash
sudo usermod -aG docker ubuntu
# Then logout and login again
```

2. **Port already in use**:
```bash
sudo lsof -i :3000
sudo kill -9 <process-id>
```

3. **Nginx configuration errors**:
```bash
sudo nginx -t
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

4. **SSL certificate issues**:
```bash
sudo certbot renew --dry-run
sudo systemctl status certbot.timer
```

5. **Application logs**:
```bash
docker-compose -f docker-compose.production.yml logs app
docker exec -it shopify-app-prod /bin/bash
```

## Security Considerations

1. **Firewall Configuration**:
```bash
sudo ufw status
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

2. **SSH Hardening**:
```bash
sudo nano /etc/ssh/sshd_config
# Disable password authentication
# Change default port
sudo systemctl reload sshd
```

3. **Regular Updates**:
```bash
sudo apt update && sudo apt upgrade -y
docker system prune -f
```

## Performance Optimization

1. **Redis Memory Optimization**:
```bash
docker exec shopify-redis-prod redis-cli -a "$REDIS_PASSWORD" CONFIG SET maxmemory 256mb
docker exec shopify-redis-prod redis-cli -a "$REDIS_PASSWORD" CONFIG SET maxmemory-policy allkeys-lru
```

2. **Nginx Caching**:
Add to your Nginx config:
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

3. **Docker Resource Limits**:
Update docker-compose.production.yml with resource limits:
```yaml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
```

## Next Steps

1. **Set up monitoring** with tools like Prometheus/Grafana
2. **Implement log aggregation** with ELK stack
3. **Set up automated backups** to S3
4. **Configure auto-scaling** with AWS Auto Scaling Groups
5. **Implement blue-green deployments** for zero downtime

---

🎉 **Congratulations!** Your Shopify Analytics backend is now deployed with automated CI/CD pipeline!

For any issues, check the logs and troubleshooting section above.