#!/bin/bash

# Deployment script for production
# Run this on your local machine or in CI/CD

set -e

# Configuration
SERVER_USER="ubuntu"
SERVER_HOST="${SERVER_HOST:-your-server-ip}"
APP_DIR="/home/ubuntu/shopify-analytics/app"
DOCKER_IMAGE="${DOCKER_IMAGE:-your-dockerhub-username/shopify-analytics:latest}"

echo "🚀 Deploying Shopify Analytics to $SERVER_HOST..."

# Check if server is reachable
echo "🔍 Checking server connectivity..."
ssh -o ConnectTimeout=10 $SERVER_USER@$SERVER_HOST "echo 'Server is reachable'" || {
    echo "❌ Cannot connect to server $SERVER_HOST"
    exit 1
}

# Deploy to server
echo "📦 Deploying application..."
ssh $SERVER_USER@$SERVER_HOST << EOF
    set -e
    
    # Navigate to app directory
    cd $APP_DIR
    
    # Pull latest code
    echo "📥 Pulling latest code..."
    git pull origin main
    
    # Pull latest Docker image
    echo "🐳 Pulling Docker image: $DOCKER_IMAGE"
    docker pull $DOCKER_IMAGE
    
    # Update environment file with new image
    sed -i "s|DOCKER_IMAGE=.*|DOCKER_IMAGE=$DOCKER_IMAGE|" .env.production
    
    # Deploy with zero downtime
    echo "🔄 Deploying containers..."
    docker-compose -f docker-compose.production.yml up -d
    
    # Wait for services to start
    echo "⏳ Waiting for services to start..."
    sleep 30
    
    # Health check
    echo "🏥 Running health checks..."
    curl -f http://localhost:3000/api/v1/health || {
        echo "❌ Health check failed!"
        docker-compose -f docker-compose.production.yml logs app
        exit 1
    }
    
    # Clean up old images
    echo "🧹 Cleaning up old Docker images..."
    docker image prune -f
    
    echo "✅ Deployment successful!"
EOF

# Final health check from external
echo "🌐 Final external health check..."
sleep 10
curl -f "https://$SERVER_HOST/api/v1/health" || {
    echo "⚠️  External health check failed, but deployment completed"
}

echo "🎉 Deployment completed successfully!"
echo "🔗 Your application is available at: https://$SERVER_HOST"