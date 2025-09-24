import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AnalyticsService } from '../analytics/analytics.service';
import { ShopifyService } from '../shopify/shopify.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class ShopifySchedulerService {
  private readonly logger = new Logger(ShopifySchedulerService.name);
  private isRunning = false;
  private lastSyncTime: Date | null = null;
  private syncCount = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly analyticsService: AnalyticsService,
    private readonly shopifyService: ShopifyService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Main Shopify data sync job - runs every 5 minutes (reduced for performance)
   * This is the core polling mechanism that fetches data from Shopify
   */
  @Cron('*/5 * * * *', {
    name: 'shopify-data-sync',
    timeZone: 'UTC',
  })
  async syncShopifyData(): Promise<void> {
    // Prevent overlapping executions
    if (this.isRunning) {
      this.logger.warn('Shopify sync already running, skipping this execution');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.log(`Starting Shopify data sync #${++this.syncCount}`);

      // Check if Shopify API is healthy before proceeding
      const isHealthy = await this.shopifyService.healthCheck();
      if (!isHealthy) {
        this.logger.error('Shopify API health check failed, skipping sync');
        return;
      }

      // Perform the main sync operation
      await this.analyticsService.syncShopifyData();

      // Update sync metadata
      this.lastSyncTime = new Date();
      const duration = Date.now() - startTime;

      // Store sync metrics in Redis
      await this.storeSyncMetrics(duration, true);

      this.logger.log(`Shopify data sync completed successfully in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Shopify data sync failed after ${duration}ms:`, error);

      // Store failed sync metrics
      await this.storeSyncMetrics(duration, false, error.message);

      // Implement exponential backoff for failed syncs
      await this.handleSyncFailure(error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Intensive data refresh job - DISABLED for performance
   * Performs more comprehensive data updates including historical analysis
   */
  // @Cron('*/5 * * * *', {
  //   name: 'intensive-data-refresh',
  //   timeZone: 'UTC',
  // })
  async intensiveDataRefresh(): Promise<void> {
    try {
      this.logger.log('Starting intensive data refresh');

      // Force refresh all analytics with fresh data
      await Promise.all([
        this.analyticsService.getSalesAnalytics(true),
        this.analyticsService.getCustomerAnalytics(true),
        this.analyticsService.getInventoryAnalytics(true),
        this.analyticsService.getPerformanceAnalytics(true),
      ]);

      this.logger.log('Intensive data refresh completed successfully');
    } catch (error) {
      this.logger.error('Intensive data refresh failed:', error);
    }
  }

  /**
   * Real-time metrics update - runs every 30 seconds
   * Updates critical real-time metrics for dashboard
   */
  @Cron('*/30 * * * * *', {
    name: 'realtime-metrics-update',
    timeZone: 'UTC',
  })
  async updateRealtimeMetrics(): Promise<void> {
    try {
      // Get real-time metrics (no cache)
      const realtimeMetrics = await this.analyticsService.getRealTimeMetrics();
      
      // Cache the real-time metrics with short TTL
      const cacheKeys = this.redisService.getCacheKeys();
      await this.redisService.set(
        `${cacheKeys.dashboard.summary}:realtime`, 
        realtimeMetrics, 
        { ttl: 60 }
      );

      this.logger.debug('Real-time metrics updated successfully');
    } catch (error) {
      this.logger.error('Real-time metrics update failed:', error);
    }
  }

  /**
   * Historical data sync - runs every hour
   * Syncs older historical data for trend analysis
   */
  @Cron(CronExpression.EVERY_HOUR, {
    name: 'historical-data-sync',
    timeZone: 'UTC',
  })
  async syncHistoricalData(): Promise<void> {
    try {
      this.logger.log('Starting historical data sync');

      // Fetch data for the last 7 days for trend analysis
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get historical analytics
      const historicalAnalytics = await this.analyticsService.getDateRangeAnalytics(
        startDate, 
        endDate
      );

      this.logger.log(`Historical data sync completed for ${startDate.toISOString()} to ${endDate.toISOString()}`);
    } catch (error) {
      this.logger.error('Historical data sync failed:', error);
    }
  }

  /**
   * Performance monitoring - runs every 10 minutes
   * Monitors system performance and API usage
   */
  @Cron('*/10 * * * *', {
    name: 'performance-monitoring',
    timeZone: 'UTC',
  })
  async monitorPerformance(): Promise<void> {
    try {
      this.logger.debug('Running performance monitoring');

      // Get system metrics
      const performanceMetrics = {
        timestamp: new Date().toISOString(),
        syncCount: this.syncCount,
        lastSyncTime: this.lastSyncTime?.toISOString(),
        isRunning: this.isRunning,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
      };

      // Store performance metrics
      const cacheKeys = this.redisService.getCacheKeys();
      await this.redisService.set(
        cacheKeys.performance.responseTime('system'),
        performanceMetrics,
        { ttl: 600 }
      );

      // Check cache health
      const cacheStats = await this.analyticsService.getCacheStats();
      
      if (cacheStats) {
        await this.redisService.set(
          'system:cache_health',
          cacheStats,
          { ttl: 600 }
        );
      }

      this.logger.debug('Performance monitoring completed');
    } catch (error) {
      this.logger.error('Performance monitoring failed:', error);
    }
  }

  /**
   * Inventory alert check - runs every 15 minutes
   * Checks for low stock and out-of-stock products
   */
  @Cron('*/15 * * * *', {
    name: 'inventory-alerts',
    timeZone: 'UTC',
  })
  async checkInventoryAlerts(): Promise<void> {
    try {
      this.logger.debug('Checking inventory alerts');

      // Get current stock levels
      const stockLevels = await this.shopifyService.getStockLevels();
      
      // Process alerts
      const alerts = [];
      const criticalStockThreshold = 5;
      const lowStockThreshold = 10;

      stockLevels.forEach(product => {
        product.variants?.edges?.forEach(edge => {
          const variant = edge.node;
          const stock = variant.inventoryQuantity || 0;
          
          if (variant.inventoryItem?.tracked) {
            if (stock === 0) {
              alerts.push({
                type: 'OUT_OF_STOCK',
                severity: 'CRITICAL',
                productTitle: product.title,
                variantTitle: variant.title,
                sku: variant.sku,
                currentStock: stock,
                timestamp: new Date().toISOString(),
              });
            } else if (stock <= criticalStockThreshold) {
              alerts.push({
                type: 'CRITICAL_LOW_STOCK',
                severity: 'HIGH',
                productTitle: product.title,
                variantTitle: variant.title,
                sku: variant.sku,
                currentStock: stock,
                timestamp: new Date().toISOString(),
              });
            } else if (stock <= lowStockThreshold) {
              alerts.push({
                type: 'LOW_STOCK',
                severity: 'MEDIUM',
                productTitle: product.title,
                variantTitle: variant.title,
                sku: variant.sku,
                currentStock: stock,
                timestamp: new Date().toISOString(),
              });
            }
          }
        });
      });

      // Store alerts in Redis
      if (alerts.length > 0) {
        await this.redisService.set(
          'alerts:inventory',
          alerts,
          { ttl: 900 } // 15 minutes TTL
        );

        this.logger.warn(`Found ${alerts.length} inventory alerts`);
      } else {
        this.logger.debug('No inventory alerts found');
      }

    } catch (error) {
      this.logger.error('Inventory alerts check failed:', error);
    }
  }

  /**
   * Data validation job - runs every 30 minutes
   * Validates data integrity and consistency
   */
  @Cron('*/30 * * * *', {
    name: 'data-validation',
    timeZone: 'UTC',
  })
  async validateData(): Promise<void> {
    try {
      this.logger.debug('Running data validation');

      const validationResults = [];

      // Validate dashboard summary exists and is recent
      const cacheKeys = this.redisService.getCacheKeys();
      const dashboardSummary = await this.redisService.get(cacheKeys.dashboard.summary);
      
      if (!dashboardSummary) {
        validationResults.push({
          check: 'dashboard_summary_exists',
          status: 'FAIL',
          message: 'Dashboard summary not found in cache',
        });
      } else if (typeof dashboardSummary === 'object' && dashboardSummary && 'lastUpdated' in dashboardSummary) {
        const lastUpdated = new Date((dashboardSummary as any).lastUpdated);
        const ageMinutes = (Date.now() - lastUpdated.getTime()) / (1000 * 60);
        
        if (ageMinutes > 10) {
          validationResults.push({
            check: 'dashboard_summary_freshness',
            status: 'WARN',
            message: `Dashboard summary is ${Math.round(ageMinutes)} minutes old`,
          });
        } else {
          validationResults.push({
            check: 'dashboard_summary_freshness',
            status: 'PASS',
            message: 'Dashboard summary is fresh',
          });
        }
      }

      // Validate Shopify API connectivity
      const isShopifyHealthy = await this.shopifyService.healthCheck();
      validationResults.push({
        check: 'shopify_api_connectivity',
        status: isShopifyHealthy ? 'PASS' : 'FAIL',
        message: isShopifyHealthy ? 'Shopify API is accessible' : 'Shopify API is not accessible',
      });

      // Store validation results
      await this.redisService.set(
        'system:validation_results',
        {
          timestamp: new Date().toISOString(),
          results: validationResults,
          overallStatus: validationResults.some(r => r.status === 'FAIL') ? 'FAIL' : 
                        validationResults.some(r => r.status === 'WARN') ? 'WARN' : 'PASS',
        },
        { ttl: 1800 } // 30 minutes TTL
      );

      const failCount = validationResults.filter(r => r.status === 'FAIL').length;
      const warnCount = validationResults.filter(r => r.status === 'WARN').length;

      if (failCount > 0) {
        this.logger.error(`Data validation completed with ${failCount} failures and ${warnCount} warnings`);
      } else if (warnCount > 0) {
        this.logger.warn(`Data validation completed with ${warnCount} warnings`);
      } else {
        this.logger.debug('Data validation completed successfully');
      }

    } catch (error) {
      this.logger.error('Data validation failed:', error);
    }
  }

  /**
   * Store sync metrics for monitoring and debugging
   */
  private async storeSyncMetrics(duration: number, success: boolean, errorMessage?: string): Promise<void> {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        duration,
        success,
        syncCount: this.syncCount,
        errorMessage: errorMessage || null,
      };

      // Store individual sync metric
      await this.redisService.set(
        `sync:metrics:${this.syncCount}`,
        metrics,
        { ttl: 3600 } // 1 hour TTL
      );

      // Update aggregated metrics
      const aggregatedKey = 'sync:metrics:aggregated';
      const existing = (await this.redisService.get(aggregatedKey) as any) || {
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        averageDuration: 0,
        totalDuration: 0,
      };

      existing.totalSyncs++;
      existing.totalDuration += duration;
      existing.averageDuration = existing.totalDuration / existing.totalSyncs;

      if (success) {
        existing.successfulSyncs++;
      } else {
        existing.failedSyncs++;
      }

      await this.redisService.set(aggregatedKey, existing, { ttl: 86400 }); // 24 hours TTL

    } catch (error) {
      this.logger.error('Failed to store sync metrics:', error);
    }
  }

  /**
   * Handle sync failures with exponential backoff
   */
  private async handleSyncFailure(error: any): Promise<void> {
    try {
      // Get current failure count
      const failureCountKey = 'sync:failure_count';
      const currentFailures = await this.redisService.get<number>(failureCountKey) || 0;
      const newFailureCount = currentFailures + 1;

      // Store updated failure count
      await this.redisService.set(failureCountKey, newFailureCount, { ttl: 3600 });

      // Log escalating failure pattern
      if (newFailureCount >= 5) {
        this.logger.error(`Shopify sync has failed ${newFailureCount} times consecutively`);
      }

      // Store last error for debugging
      await this.redisService.set(
        'sync:last_error',
        {
          timestamp: new Date().toISOString(),
          error: error.message,
          stack: error.stack,
          failureCount: newFailureCount,
        },
        { ttl: 86400 }
      );

    } catch (metricError) {
      this.logger.error('Failed to handle sync failure metrics:', metricError);
    }
  }

  /**
   * Get sync status and metrics
   */
  async getSyncStatus(): Promise<any> {
    try {
      const metrics = await this.redisService.get('sync:metrics:aggregated');
      const lastError = await this.redisService.get('sync:last_error');
      const failureCount = await this.redisService.get('sync:failure_count') || 0;

      return {
        isRunning: this.isRunning,
        lastSyncTime: this.lastSyncTime?.toISOString(),
        syncCount: this.syncCount,
        metrics: metrics || null,
        lastError: lastError || null,
        consecutiveFailures: failureCount,
        status: (failureCount as number) > 3 ? 'ERROR' : 
                (failureCount as number) > 0 ? 'WARNING' : 'HEALTHY',
      };
    } catch (error) {
      this.logger.error('Failed to get sync status:', error);
      return null;
    }
  }

  /**
   * Manual trigger for immediate sync
   */
  async triggerManualSync(): Promise<void> {
    this.logger.log('Manual sync triggered');
    await this.syncShopifyData();
  }

  /**
   * Reset failure count (for recovery)
   */
  async resetFailureCount(): Promise<void> {
    await this.redisService.del('sync:failure_count');
    this.logger.log('Sync failure count reset');
  }
}
