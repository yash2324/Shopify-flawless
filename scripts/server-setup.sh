#!/bin/bash

# Server setup script for AWS EC2
# Run this script on your EC2 instance after initial login

set -e

echo "🚀 Setting up Shopify Analytics server..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Docker
echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
rm get-docker.sh

# Install Docker Compose
echo "🐙 Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Nginx
echo "🌐 Installing Nginx..."
sudo apt install nginx -y

# Install Certbot for SSL
echo "🔒 Installing Certbot..."
sudo apt install certbot python3-certbot-nginx -y

# Install Git
echo "📋 Installing Git..."
sudo apt install git curl wget htop unzip -y

# Create application directories
echo "📁 Creating application directories..."
mkdir -p ~/shopify-analytics/{app,nginx,ssl,logs,data/redis,backups}

# Create systemd service for easier management
echo "⚙️ Creating systemd service..."
sudo tee /etc/systemd/system/shopify-analytics.service > /dev/null <<EOF
[Unit]
Description=Shopify Analytics Dashboard
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ubuntu/shopify-analytics/app
ExecStart=/usr/local/bin/docker-compose -f docker-compose.production.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.production.yml down
TimeoutStartSec=0
User=ubuntu

[Install]
WantedBy=multi-user.target
EOF

# Enable the service
sudo systemctl enable shopify-analytics.service

# Setup log rotation
echo "📝 Setting up log rotation..."
sudo tee /etc/logrotate.d/shopify-analytics > /dev/null <<EOF
/home/ubuntu/shopify-analytics/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 ubuntu ubuntu
    copytruncate
}
EOF

# Setup firewall (UFW)
echo "🔥 Configuring firewall..."
sudo ufw --force enable
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw --force reload

# Setup basic monitoring script
echo "📊 Creating monitoring script..."
tee ~/shopify-analytics/monitor.sh > /dev/null <<'EOF'
#!/bin/bash
# Basic monitoring script

echo "=== Shopify Analytics Status ==="
echo "Date: $(date)"
echo ""

echo "🐳 Docker Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

echo "💾 Disk Usage:"
df -h / | tail -1
echo ""

echo "🧠 Memory Usage:"
free -h
echo ""

echo "🔄 Redis Status:"
docker exec shopify-redis-prod redis-cli -a "$REDIS_PASSWORD" ping 2>/dev/null || echo "Redis not responding"
echo ""

echo "🌐 API Health:"
curl -s http://localhost:3000/api/v1/health | head -100 || echo "API not responding"
echo ""

echo "📊 Nginx Status:"
sudo systemctl is-active nginx
echo ""

echo "🔒 SSL Certificate Status:"
sudo certbot certificates 2>/dev/null | grep -A2 "Certificate Name\|Expiry Date" || echo "No certificates found"
EOF

chmod +x ~/shopify-analytics/monitor.sh

# Create backup script
echo "💾 Creating backup script..."
tee ~/shopify-analytics/backup.sh > /dev/null <<'EOF'
#!/bin/bash
# Backup script for Redis data and logs

BACKUP_DIR="/home/ubuntu/shopify-analytics/backups"
DATE=$(date +%Y%m%d_%H%M%S)

echo "📦 Creating backup: $DATE"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup Redis data
echo "💾 Backing up Redis data..."
docker exec shopify-redis-prod redis-cli -a "$REDIS_PASSWORD" BGSAVE
sleep 5
docker cp shopify-redis-prod:/data/dump.rdb "$BACKUP_DIR/redis_$DATE.rdb"

# Backup logs
echo "📝 Backing up logs..."
tar -czf "$BACKUP_DIR/logs_$DATE.tar.gz" -C /home/ubuntu/shopify-analytics logs/

# Clean old backups (keep last 7 days)
echo "🧹 Cleaning old backups..."
find "$BACKUP_DIR" -name "*.rdb" -mtime +7 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete

echo "✅ Backup completed: $DATE"
EOF

chmod +x ~/shopify-analytics/backup.sh

# Setup cron jobs
echo "⏰ Setting up cron jobs..."
(crontab -l 2>/dev/null; echo "0 2 * * * /home/ubuntu/shopify-analytics/backup.sh >> /home/ubuntu/shopify-analytics/logs/backup.log 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "*/15 * * * * /home/ubuntu/shopify-analytics/monitor.sh >> /home/ubuntu/shopify-analytics/logs/monitor.log 2>&1") | crontab -

echo ""
echo "✅ Server setup completed!"
echo ""
echo "Next steps:"
echo "1. Clone your repository to ~/shopify-analytics/app"
echo "2. Configure environment variables"
echo "3. Setup SSL certificates"
echo "4. Deploy your application"
echo ""
echo "⚠️  Please reboot the server to complete Docker setup:"
echo "   sudo reboot"