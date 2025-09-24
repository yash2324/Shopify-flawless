import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { DashboardController } from './controllers/dashboard.controller';
import { AnalyticsController } from './controllers/analytics.controller';
import { HealthController } from './controllers/health.controller';
import { SystemController } from './controllers/system.controller';
import { AnalyticsModule } from '../analytics/analytics.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { RedisModule } from '../redis/redis.module';
import { ShopifyModule } from '../shopify/shopify.module';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
    AnalyticsModule,
    SchedulerModule,
    RedisModule,
    ShopifyModule,
  ],
  controllers: [
    DashboardController,
    AnalyticsController,
    HealthController,
    SystemController,
  ],
})
export class ApiModule {}
