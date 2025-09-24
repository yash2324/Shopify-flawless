import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsService } from './analytics.service';
import { DataAggregationService } from './data-aggregation.service';
import { SalesAnalyticsService } from './sales-analytics.service';
import { CustomerAnalyticsService } from './customer-analytics.service';
import { InventoryAnalyticsService } from './inventory-analytics.service';
import { PerformanceAnalyticsService } from './performance-analytics.service';
import { RedisModule } from '../redis/redis.module';
import { ShopifyModule } from '../shopify/shopify.module';

@Module({
  imports: [ConfigModule, RedisModule, ShopifyModule],
  providers: [
    AnalyticsService,
    DataAggregationService,
    SalesAnalyticsService,
    CustomerAnalyticsService,
    InventoryAnalyticsService,
    PerformanceAnalyticsService,
  ],
  exports: [
    AnalyticsService,
    DataAggregationService,
    SalesAnalyticsService,
    CustomerAnalyticsService,
    InventoryAnalyticsService,
    PerformanceAnalyticsService,
  ],
})
export class AnalyticsModule {}
