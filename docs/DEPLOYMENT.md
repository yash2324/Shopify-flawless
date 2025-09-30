# Complete Deployment Guide

## 🚀 Deployment Overview

This guide will help you deploy your Shopify Analytics Dashboard to AWS EC2 with a complete CI/CD pipeline.

## 📋 Prerequisites

Before starting, ensure you have:

- [ ] AWS Account with EC2 access
- [ ] Domain name pointed to your EC2 instance
- [ ] GitHub repository with your code
- [ ] Docker Hub account
- [ ] Shopify store with API access

## 🏗️ Step-by-Step Deployment

### 1. Launch EC2 Instance

1. **Create EC2 Instance**
   - Instance Type: `t3.medium` or `t3.large`
   - AMI: Ubuntu Server 22.04 LTS
   - Storage: 20GB SSD minimum
   - Key Pair: Create or use existing

2. **Configure Security Group**
   ```
   SSH (22)     - Your IP
   HTTP (80)    - 0.0.0.0/0
   HTTPS (443)  - 0.0.0.0/0
   ```

3. **Allocate Elastic IP**
   - Allocate and associate with your instance
   - Update your domain's DNS A record

### 2. Initial Server Setup

SSH into your server and run the setup script:

```bash
# Upload and run the server setup script
scp scripts/server-setup.sh ubuntu@your-server-ip:~
ssh ubuntu@your-server-ip
chmod +x server-setup.sh
./server-setup.sh
sudo reboot
```

### 3. Clone Repository

```bash
# SSH back into the server after reboot
ssh ubuntu@your-server-ip

# Clone your repository
cd ~/shopify-analytics
git clone https://github.com/your-username/your-repo.git app
cd app
```

### 4. Configure Environment

```bash
# Copy and configure environment file
cp .env.production.example .env.production
nano .env.production
```

**Required Environment Variables:**
```bash
DOCKER_IMAGE=your-dockerhub-username/shopify-analytics:latest
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=your_shopify_access_token
REDIS_PASSWORD=your_strong_redis_password
DOMAIN_NAME=your-domain.com
```

### 5. Setup Nginx and SSL

```bash
# Copy Nginx configuration
sudo cp nginx/shopify-analytics.conf /etc/nginx/sites-available/shopify-analytics

# Run SSL setup script
chmod +x scripts/ssl-setup.sh
./scripts/ssl-setup.sh your-domain.com your-email@example.com
```

### 6. GitHub Repository Setup

#### GitHub Secrets Configuration

Go to your GitHub repository → Settings → Secrets and add:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `DOCKER_USERNAME` | Docker Hub username | `john-doe` |
| `DOCKER_PASSWORD` | Docker Hub password/token | `your-docker-token` |
| `EC2_HOST` | Your EC2 Elastic IP | `54.123.45.67` |
| `EC2_SSH_KEY` | Private SSH key content | `-----BEGIN RSA PRIVATE KEY-----...` |
| `SHOPIFY_SHOP_DOMAIN` | Your shop domain | `myshop.myshopify.com` |
| `SHOPIFY_ACCESS_TOKEN` | Shopify API token | `shpat_xxxxx` |
| `REDIS_PASSWORD` | Redis password | `strong-redis-password` |
| `DOMAIN_NAME` | Your domain | `myshop-analytics.com` |

#### Repository Structure

Ensure your repository has these files:
```
├── .github/workflows/deploy.yml
├── docker-compose.production.yml
├── .env.production.example
├── scripts/
│   ├── server-setup.sh
│   ├── deploy.sh
│   └── ssl-setup.sh
├── nginx/
│   └── shopify-analytics.conf
└── docs/
    ├── AWS_SETUP.md
    └── DEPLOYMENT.md
```

### 7. Initial Deployment

#### Option A: Manual Deployment
```bash
# On your server
cd ~/shopify-analytics/app
docker-compose -f docker-compose.production.yml pull
docker-compose -f docker-compose.production.yml up -d
```

#### Option B: Automated via GitHub Actions
```bash
# Push to main branch to trigger deployment
git add .
git commit -m "Initial production deployment"
git push origin main
```

### 8. Verify Deployment

Check that everything is working:

```bash
# On server - check container status
docker ps

# Check application health
curl http://localhost:3000/api/v1/health

# Check external access
curl https://your-domain.com/api/v1/health
```

### 9. Monitoring and Maintenance

#### Monitor Services
```bash
# Run monitoring script
~/shopify-analytics/monitor.sh

# Check logs
docker-compose -f docker-compose.production.yml logs -f

# System logs
sudo journalctl -u shopify-analytics.service -f
```

#### Backup Setup
```bash
# Manual backup
~/shopify-analytics/backup.sh

# Backups run automatically via cron
crontab -l
```

## 🔧 Common Issues & Solutions

### Issue: Container won't start
```bash
# Check logs
docker-compose -f docker-compose.production.yml logs app

# Common fixes:
# 1. Check environment variables
# 2. Verify Docker image exists
# 3. Check disk space: df -h
```

### Issue: SSL certificate problems
```bash
# Renew certificate manually
sudo certbot renew

# Check certificate status
sudo certbot certificates

# Reload Nginx
sudo systemctl reload nginx
```

### Issue: Application not accessible
```bash
# Check Nginx status
sudo systemctl status nginx

# Test Nginx configuration
sudo nginx -t

# Check security groups in AWS Console
```

## 🚀 CI/CD Pipeline Features

The GitHub Actions pipeline automatically:

1. **Tests** - Runs linting and unit tests
2. **Builds** - Creates Docker image and pushes to Docker Hub
3. **Deploys** - Updates production server with zero downtime
4. **Monitors** - Performs health checks after deployment

### Pipeline Triggers
- Push to `main` branch → Deploy to production
- Pull requests → Run tests only

## 📊 Monitoring & Alerts

### Built-in Monitoring
- Container health checks
- Application health endpoint
- Nginx access/error logs
- Automated backups

### External Monitoring (Recommended)
- **Uptime monitoring**: UptimeRobot, Pingdom
- **Error tracking**: Sentry
- **Performance**: New Relic, DataDog

## 🔒 Security Features

- **SSL/TLS encryption** with Let's Encrypt
- **Rate limiting** on API endpoints
- **Security headers** (HSTS, CSP, etc.)
- **Firewall** configuration (UFW)
- **Container isolation**
- **Non-root containers**

## 📝 Maintenance Tasks

### Weekly
- [ ] Check application logs
- [ ] Verify backups
- [ ] Monitor disk usage

### Monthly
- [ ] Update dependencies
- [ ] Review security updates
- [ ] Check SSL certificate expiry

### Quarterly
- [ ] Review performance metrics
- [ ] Update documentation
- [ ] Security audit

## 🆘 Support

For issues:
1. Check application logs
2. Review this documentation
3. Check GitHub Issues
4. Contact system administrator

## 🎉 Success!

Your Shopify Analytics Dashboard is now:
- ✅ Deployed on AWS EC2
- ✅ Secured with SSL
- ✅ Monitored and backed up
- ✅ Auto-deploying via CI/CD

**Access your application:**
- 🌐 **Website**: https://your-domain.com
- 📖 **API Docs**: https://your-domain.com/api/v1/docs
- 🏥 **Health Check**: https://your-domain.com/api/v1/health