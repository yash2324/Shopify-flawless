#!/bin/bash

# SSL setup script for production server
# Run this on your EC2 instance after setting up the domain

set -e

DOMAIN="${1:-your-domain.com}"
EMAIL="${2:-your-email@example.com}"

if [ "$DOMAIN" = "your-domain.com" ] || [ "$EMAIL" = "your-email@example.com" ]; then
    echo "❌ Please provide your domain and email:"
    echo "Usage: $0 <domain> <email>"
    echo "Example: $0 myshop-analytics.com admin@myshop-analytics.com"
    exit 1
fi

echo "🔒 Setting up SSL certificate for $DOMAIN..."

# Update Nginx configuration with actual domain
echo "📝 Updating Nginx configuration..."
sudo sed -i "s/your-domain.com/$DOMAIN/g" /etc/nginx/sites-available/shopify-analytics

# Test Nginx configuration
echo "🧪 Testing Nginx configuration..."
sudo nginx -t

# Enable the site
echo "🔗 Enabling site..."
sudo ln -sf /etc/nginx/sites-available/shopify-analytics /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Reload Nginx
echo "🔄 Reloading Nginx..."
sudo systemctl reload nginx

# Obtain SSL certificate
echo "📜 Obtaining SSL certificate from Let's Encrypt..."
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --no-eff-email --redirect

# Setup automatic renewal
echo "♻️ Setting up automatic certificate renewal..."
sudo crontab -l 2>/dev/null | { cat; echo "0 12 * * * /usr/bin/certbot renew --quiet"; } | sudo crontab -

# Test SSL configuration
echo "🧪 Testing SSL configuration..."
sleep 5
curl -I https://$DOMAIN/api/v1/health || echo "⚠️  SSL test failed, but certificate might still be working"

# Create a simple index page
echo "📄 Creating index page..."
sudo mkdir -p /var/www/html
sudo tee /var/www/html/index.html > /dev/null <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>Shopify Analytics Dashboard</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            margin: 0;
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: rgba(255,255,255,0.1);
            padding: 40px;
            border-radius: 10px;
            backdrop-filter: blur(10px);
        }
        .btn { 
            display: inline-block; 
            padding: 12px 24px; 
            background: #4CAF50; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 10px;
            transition: background 0.3s;
        }
        .btn:hover { background: #45a049; }
        .status { 
            background: rgba(76, 175, 80, 0.2); 
            padding: 10px; 
            border-radius: 5px; 
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Shopify Analytics Dashboard</h1>
        <div class="status">
            <p>✅ Server is running successfully!</p>
        </div>
        <p>High-performance analytics dashboard for Shopify stores with real-time data synchronization.</p>
        
        <div>
            <a href="/api/v1/docs" class="btn">📖 API Documentation</a>
            <a href="/api/v1/health" class="btn">🏥 Health Check</a>
        </div>
        
        <h3>Available Endpoints:</h3>
        <ul style="text-align: left; display: inline-block;">
            <li><strong>/api/v1/docs</strong> - Interactive API documentation</li>
            <li><strong>/api/v1/health</strong> - System health status</li>
            <li><strong>/api/v1/dashboard/summary</strong> - Dashboard summary data</li>
            <li><strong>/api/v1/dashboard/realtime</strong> - Real-time analytics</li>
            <li><strong>/api/v1/analytics/*</strong> - Detailed analytics endpoints</li>
        </ul>
        
        <p><small>Secured with SSL/TLS encryption</small></p>
    </div>
</body>
</html>
EOF

echo ""
echo "✅ SSL setup completed successfully!"
echo ""
echo "🔗 Your application is now available at:"
echo "   https://$DOMAIN"
echo "   https://$DOMAIN/api/v1/docs"
echo ""
echo "🔒 SSL certificate will auto-renew via cron job"
echo ""
echo "📊 Next steps:"
echo "1. Deploy your application containers"
echo "2. Test all endpoints"
echo "3. Configure monitoring and backups"