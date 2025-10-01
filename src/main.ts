import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import * as compression from 'compression';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap() {
  // Create logger instance
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ),
    defaultMeta: { service: 'shopify-analytics-api' },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
        ),
      }),
      new winston.transports.File({
        filename: process.env.LOG_FILE_PATH || './logs/error.log',
        level: 'error',
      }),
      new winston.transports.File({
        filename: process.env.LOG_FILE_PATH || './logs/combined.log',
      }),
    ],
  });

  // Create NestJS application
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      instance: logger,
    }),
  });

  // Get configuration service
  const configService = app.get(ConfigService);
  const appConfig = configService.get('config.app');
  const port = appConfig.port;
  const apiPrefix = appConfig.apiPrefix;

  // Set global prefix for all routes
  app.setGlobalPrefix(apiPrefix);

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // Enable compression
  app.use(compression());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: appConfig.nodeEnv === 'production',
    }),
  );

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('Shopify Analytics API')
    .setDescription(
      'High-performance REST API for Shopify analytics dashboard with real-time data synchronization and comprehensive business intelligence features.'
    )
    .setVersion('1.0.0')
    .addTag('Dashboard', 'Main dashboard endpoints for summary data')
    .addTag('Analytics', 'Detailed analytics endpoints for specific data types')
    .addTag('Health', 'System health and monitoring endpoints')
    .addTag('System', 'System administration and maintenance endpoints')
    .addServer(`http://localhost:${port}`, 'Local development server')
    .addServer(`https://api.yourdomain.com`, 'Production server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    customSiteTitle: 'Shopify Analytics API Documentation',
    customfavIcon: '/favicon.ico',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      docExpansion: 'none',
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
    },
  });

  logger.info(`Swagger documentation available at: http://localhost:${port}/${apiPrefix}/docs`);

  // Graceful shutdown handlers
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    await app.close();
    process.exit(0);
  });

  // Unhandled rejection handler
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  // Uncaught exception handler
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });

  // Start the server
  await app.listen(port, '0.0.0.0');

  logger.info(`🚀 Shopify Analytics API is running on: http://localhost:${port}/${apiPrefix}`);
  logger.info(`📊 Environment: ${appConfig.nodeEnv}`);
  logger.info(`📈 Analytics dashboard ready for real-time Shopify data synchronization`);

  // Log important endpoints
  logger.info(`🔍 Health check: http://localhost:${port}/${apiPrefix}/health`);
  logger.info(`📋 Dashboard: http://localhost:${port}/${apiPrefix}/dashboard/summary`);
  logger.info(`⚡ Real-time: http://localhost:${port}/${apiPrefix}/dashboard/realtime`);
  logger.info(`📖 API Docs: http://localhost:${port}/${apiPrefix}/docs`);

  // Performance monitoring
  const memUsage = process.memoryUsage();
  logger.info(`💾 Memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB heap, ${Math.round(memUsage.rss / 1024 / 1024)}MB RSS`);
  
  // Log startup time
  logger.info(`⏱️  Startup time: ${process.uptime().toFixed(2)}s`);
}

// Handle bootstrap errors
bootstrap().catch((error) => {
  console.error('❌ Application failed to start:', error);
  process.exit(1);
});
