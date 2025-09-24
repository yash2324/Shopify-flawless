import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';

// Configuration
import configuration from './config/configuration';
import { validate } from './config/validation';

// Modules
import { RedisModule } from './modules/redis/redis.module';
import { ShopifyModule } from './modules/shopify/shopify.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { ApiModule } from './modules/api/api.module';

@Module({
  imports: [
    // Configuration Module
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate Limiting Module
    ThrottlerModule.forRootAsync({
      useFactory: () => [
        {
          name: 'short',
          ttl: 1000, // 1 second
          limit: 10, // 10 requests per second
        },
        {
          name: 'medium',
          ttl: 60000, // 1 minute
          limit: 100, // 100 requests per minute
        },
        {
          name: 'long',
          ttl: 900000, // 15 minutes
          limit: 1000, // 1000 requests per 15 minutes
        },
      ],
    }),

    // Cache Module will be configured by Redis module

    // Health Check Module
    TerminusModule,

    // HTTP Module for external API calls
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),

    // Application Modules
    RedisModule,
    ShopifyModule,
    AnalyticsModule,
    SchedulerModule,
    ApiModule,
  ],
  providers: [
    // Global rate limiting
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
