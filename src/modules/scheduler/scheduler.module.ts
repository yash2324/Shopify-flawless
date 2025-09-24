import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ShopifySchedulerService } from './shopify-scheduler.service';
import { DataCleanupService } from './data-cleanup.service';
import { HealthCheckService } from './health-check.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { RedisModule } from '../redis/redis.module';
import { ShopifyModule } from '../shopify/shopify.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    HttpModule,
    AnalyticsModule,
    RedisModule,
    ShopifyModule,
  ],
  providers: [
    ShopifySchedulerService,
    DataCleanupService,
    HealthCheckService,
  ],
  exports: [
    ShopifySchedulerService,
    DataCleanupService,
    HealthCheckService,
  ],
})
export class SchedulerModule {}
