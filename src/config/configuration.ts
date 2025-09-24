import { registerAs } from '@nestjs/config';

export default registerAs('config', () => ({
  app: {
    port: parseInt(process.env.PORT, 10) || 3000,
    apiPrefix: process.env.API_PREFIX || 'api/v1',
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  shopify: {
    shopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
    apiVersion: process.env.SHOPIFY_API_VERSION || '2025-04',
    graphqlEndpoint: process.env.SHOPIFY_GRAPHQL_ENDPOINT,
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
    ttl: parseInt(process.env.REDIS_TTL, 10) || 300,
  },
  cache: {
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS, 10) || 300,
    dashboardDataTtl: parseInt(process.env.DASHBOARD_DATA_TTL, 10) || 60,
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL, 10) || 60,
    limit: parseInt(process.env.THROTTLE_LIMIT, 10) || 100,
  },
  cron: {
    shopifySync: process.env.SHOPIFY_SYNC_CRON || '0 * * * * *',
    dataCleanup: process.env.DATA_CLEANUP_CRON || '0 0 * * *',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs/app.log',
  },
  performance: {
    maxConcurrentShopifyRequests: parseInt(process.env.MAX_CONCURRENT_SHOPIFY_REQUESTS, 10) || 5,
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT, 10) || 30000,
  },
}));
