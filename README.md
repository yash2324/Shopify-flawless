# Shopify Analytics API

A high-performance NestJS backend service for real-time Shopify analytics dashboard with Redis caching and comprehensive business intelligence features.

## 🚀 Features

### Core Functionality
- **Real-time Data Synchronization**: Polls Shopify API every minute for up-to-date analytics
- **Comprehensive Analytics**: Sales, customer, inventory, and performance metrics
- **High-Performance Caching**: Redis-based caching for sub-millisecond response times
- **Professional Architecture**: Modular NestJS structure with separation of concerns
- **Scalable Design**: Built for production with Docker and orchestration support

### Analytics Modules
- **Sales Analytics**: Revenue trends, targets vs actuals, rep performance
- **Customer Analytics**: Segmentation, profitability, purchase history, churn analysis
- **Inventory Analytics**: Stock levels, turnover rates, demand forecasting
- **Performance Analytics**: Order fulfillment, processing times, KPI tracking

### System Features
- **Health Monitoring**: Comprehensive health checks and system monitoring
- **Automated Cleanup**: Scheduled data cleanup and cache optimization
- **Rate Limiting**: API rate limiting and request throttling
- **Error Handling**: Robust error handling with exponential backoff
- **Security**: Helmet.js security headers and input validation

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Shopify API   │◄───┤  NestJS Backend  │◄───┤   Redis Cache   │
│   (GraphQL)     │    │   (EC2/Docker)   │    │ (ElastiCache)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │ Next.js Frontend │
                       │   (Vercel)       │
                       └──────────────────┘
```

### Data Flow
1. **Shopify API** → Source of truth for orders, products, customers
2. **NestJS Cron Worker** → Polls Shopify every minute, processes data
3. **Redis Cache** → Stores aggregated data with TTL management
4. **REST API** → Serves pre-processed data to frontend
5. **Dashboard** → Real-time analytics visualization

## 🛠️ Tech Stack

- **Framework**: NestJS (Node.js)
- **Cache**: Redis with ioredis
- **API**: Shopify GraphQL Admin API
- **Monitoring**: Winston logging, health checks
- **Deployment**: Docker, Docker Compose
- **Documentation**: Swagger/OpenAPI

## 📋 Prerequisites

- Node.js 18+ 
- Redis 6+
- Docker & Docker Compose (for containerized deployment)
- Shopify Admin API access token

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd shopify-analytics-backend
npm install
```

### 2. Environment Configuration

Copy the example environment file and configure your settings:

```bash
cp env.example .env
```

Required environment variables:

```env
# Shopify Configuration
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_your_access_token
SHOPIFY_API_VERSION=2025-04

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# Application Configuration
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1
```

### 3. Development Setup

#### Option A: Local Development
```bash
# Start Redis (if not using Docker)
redis-server

# Start the application
npm run start:dev
```

#### Option B: Docker Development
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f app-dev
```

### 4. Production Deployment

```bash
# Build and start production containers
docker-compose up -d

# Scale the application
docker-compose up -d --scale app=3
```

## 📚 API Documentation

Once running, access the interactive API documentation:

- **Development**: http://localhost:3000/api/v1/docs
- **Production**: https://your-domain.com/api/v1/docs

### Key Endpoints

#### Dashboard
- `GET /api/v1/dashboard/summary` - Complete dashboard overview
- `GET /api/v1/dashboard/realtime` - Real-time metrics
- `GET /api/v1/dashboard/sales` - Sales analytics
- `GET /api/v1/dashboard/customers` - Customer analytics
- `GET /api/v1/dashboard/inventory` - Inventory analytics

#### Analytics
- `GET /api/v1/analytics/sales/representatives` - Sales rep performance
- `GET /api/v1/analytics/customers/profitability` - Customer profitability
- `GET /api/v1/analytics/inventory/stock-levels` - Real-time stock levels
- `GET /api/v1/analytics/orders/outstanding` - Unfulfilled orders

#### System
- `GET /api/v1/health` - Health check
- `GET /api/v1/system/status` - System status
- `POST /api/v1/system/sync/trigger` - Manual data sync

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SHOPIFY_SHOP_DOMAIN` | Your Shopify shop domain | Required |
| `SHOPIFY_ACCESS_TOKEN` | Shopify Admin API token | Required |
| `SHOPIFY_API_VERSION` | Shopify API version | `2025-04` |
| `REDIS_HOST` | Redis server host | `localhost` |
| `REDIS_PORT` | Redis server port | `6379` |
| `REDIS_TTL` | Default cache TTL (seconds) | `300` |
| `DASHBOARD_DATA_TTL` | Dashboard cache TTL (seconds) | `60` |
| `SHOPIFY_SYNC_CRON` | Sync schedule (cron format) | `0 * * * * *` |
| `MAX_CONCURRENT_SHOPIFY_REQUESTS` | API concurrency limit | `5` |
| `LOG_LEVEL` | Logging level | `info` |

### Cron Schedules

- **Data Sync**: Every minute (`0 * * * * *`)
- **Intensive Refresh**: Every 5 minutes
- **Real-time Updates**: Every 30 seconds
- **Historical Sync**: Every hour
- **Cleanup**: Daily at midnight

## 🔍 Monitoring & Health Checks

### Health Endpoints
- `/api/v1/health` - Basic health check
- `/api/v1/health/detailed` - Comprehensive health status
- `/api/v1/health/ready` - Kubernetes readiness probe
- `/api/v1/health/live` - Kubernetes liveness probe

### System Monitoring
- Memory usage tracking
- Redis connectivity monitoring
- Shopify API health checks
- Cache performance metrics
- Request rate monitoring

## 🐳 Docker Deployment

### Development
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### Production
```bash
docker-compose up -d
```

### Environment-specific Overrides
```bash
# Staging
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d

# Production with scaling
docker-compose up -d --scale app=3
```

## 🔧 Performance Optimization

### Redis Configuration
- Memory limit: 512MB with LRU eviction
- Persistence: AOF + RDB snapshots
- Connection pooling for high concurrency

### API Optimization
- Response compression with gzip
- Request throttling and rate limiting
- Connection keep-alive optimization
- Efficient GraphQL query batching

### Caching Strategy
- Multi-layer caching (Redis + in-memory)
- Smart cache invalidation
- TTL optimization based on data freshness needs
- Cache warming for critical endpoints

## 🔐 Security Features

- **Helmet.js**: Security headers (CSP, HSTS, etc.)
- **Rate Limiting**: Multiple rate limit zones
- **Input Validation**: Class-validator with whitelist
- **CORS**: Configurable cross-origin policies
- **Redis Security**: Command restrictions and authentication

## 📊 Analytics Deep Dive

### Sales Analytics
- Daily/Weekly/Monthly trends
- Target vs actual performance
- Sales representative metrics
- Seasonal pattern analysis
- Revenue forecasting

### Customer Analytics
- RFM segmentation (Recency, Frequency, Monetary)
- Customer lifetime value (CLV)
- Churn prediction and analysis
- Purchase behavior patterns
- Cohort analysis

### Inventory Analytics
- Real-time stock levels
- Turnover rate analysis
- Demand forecasting
- Low stock alerting
- ABC analysis for inventory prioritization

### Performance Analytics
- Order fulfillment metrics
- Processing time analysis
- KPI tracking and scoring
- Operational efficiency metrics
- Trend analysis and projections

## 🚨 Alerting System

### Alert Types
- **Inventory Alerts**: Low stock, out of stock
- **Performance Alerts**: High response times, sync failures
- **System Alerts**: Memory usage, Redis connectivity
- **Business Alerts**: Target misses, anomaly detection

### Alert Severity Levels
- **Critical**: Immediate action required
- **High**: Attention needed within hours
- **Medium**: Monitor and plan action
- **Low**: Informational

## 🧪 Testing

```bash
# Unit tests
npm run test

# Integration tests
npm run test:e2e

# Test coverage
npm run test:cov

# Watch mode for development
npm run test:watch
```

## 📝 Logging

### Log Levels
- **Error**: System errors, API failures
- **Warn**: Performance issues, deprecations
- **Info**: System events, sync completions
- **Debug**: Detailed execution traces

### Log Outputs
- **Console**: Colorized for development
- **Files**: Structured JSON for production
- **External**: Ready for ELK/Splunk integration

## 🔄 Data Synchronization

### Sync Strategy
1. **Real-time**: Critical dashboard metrics (30s)
2. **Frequent**: Core analytics data (1-5 minutes)
3. **Regular**: Historical analysis (hourly)
4. **Batch**: Full data refresh (daily)

### Error Handling
- Exponential backoff for API failures
- Circuit breaker pattern for reliability
- Graceful degradation during outages
- Automatic recovery mechanisms

## 🚀 Deployment Strategies

### Docker Compose (Single Server)
Perfect for small to medium deployments:
```bash
docker-compose up -d --scale app=2
```

### Kubernetes (Scalable)
For high-availability production:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shopify-analytics-api
spec:
  replicas: 3
  # ... (see k8s-deployment.yaml)
```

### AWS ECS (Managed)
Fully managed container deployment with auto-scaling.

## 🔧 Troubleshooting

### Common Issues

#### Shopify API Rate Limits
```bash
# Check API usage
curl http://localhost:3000/api/v1/system/status

# Reset failure count
curl -X POST http://localhost:3000/api/v1/system/sync/reset-failures
```

#### Redis Connection Issues
```bash
# Test Redis connectivity
redis-cli -h localhost -p 6379 ping

# Check Redis logs
docker-compose logs redis
```

#### High Memory Usage
```bash
# Check system status
curl http://localhost:3000/api/v1/health/metrics

# Trigger cleanup
curl -X POST http://localhost:3000/api/v1/system/cleanup/trigger
```

### Debug Mode
```bash
# Enable debug logging
NODE_ENV=development LOG_LEVEL=debug npm run start:dev

# Or with Docker
docker-compose -f docker-compose.dev.yml up -d
```

## 📈 Performance Metrics

### Expected Performance
- **API Response Time**: < 100ms (cached data)
- **Sync Duration**: < 5 seconds (typical)
- **Memory Usage**: < 256MB (steady state)
- **CPU Usage**: < 10% (idle), < 50% (sync)

### Monitoring Dashboards
- System health and uptime
- API response times and error rates
- Cache hit rates and performance
- Shopify API usage and limits

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

### Development Guidelines
- Follow NestJS conventions
- Add comprehensive tests
- Update documentation
- Use TypeScript strictly
- Follow the established architecture patterns

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: [API Docs](http://localhost:3000/api/v1/docs)
- **Issues**: Create a GitHub issue
- **Email**: support@yourcompany.com

## 🎯 Roadmap

### Phase 1 (Current)
- [x] Core analytics implementation
- [x] Real-time data synchronization
- [x] Docker deployment setup
- [x] Comprehensive monitoring

### Phase 2 (Planned)
- [ ] Machine learning predictions
- [ ] Advanced alerting with webhooks
- [ ] Multi-tenant support
- [ ] GraphQL API endpoints
- [ ] WebSocket real-time updates

### Phase 3 (Future)
- [ ] Mobile app support
- [ ] Advanced data visualization
- [ ] Integration with other e-commerce platforms
- [ ] AI-powered insights and recommendations

---

**Built with ❤️ using NestJS, Redis, and modern DevOps practices**
