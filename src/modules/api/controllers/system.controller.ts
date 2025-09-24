import {
  Controller,
  Get,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ShopifySchedulerService } from '../../scheduler/shopify-scheduler.service';
import { DataCleanupService } from '../../scheduler/data-cleanup.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import { RedisService } from '../../redis/redis.service';

@ApiTags('System')
@Controller('system')
@UseGuards(ThrottlerGuard)
export class SystemController {
  private readonly logger = new Logger(SystemController.name);

  constructor(
    private readonly shopifySchedulerService: ShopifySchedulerService,
    private readonly dataCleanupService: DataCleanupService,
    private readonly analyticsService: AnalyticsService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Get system status
   */
  @Get('status')
  @ApiOperation({
    summary: 'Get system status',
    description: 'Returns overall system status including sync health and performance metrics',
  })
  @ApiResponse({
    status: 200,
    description: 'System status data',
  })
  async getSystemStatus(): Promise<any> {
    try {
      this.logger.debug('System status requested');
      
      const [syncStatus, cacheStats, validationResults, lastCleanup] = await Promise.all([
        this.shopifySchedulerService.getSyncStatus(),
        this.analyticsService.getCacheStats(),
        this.redisService.get('system:validation_results'),
        this.dataCleanupService.getCleanupStats(),
      ]);

      const systemHealth = this.calculateSystemHealth(syncStatus, cacheStats, validationResults);

      return {
        status: 'success',
        data: {
          overall: {
            health: systemHealth,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
          },
          sync: syncStatus,
          cache: cacheStats,
          validation: validationResults,
          cleanup: lastCleanup,
          memory: {
            heapUsed: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
            heapTotal: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
            usagePercent: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 10000) / 100,
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get system status:', error);
      throw error;
    }
  }

  /**
   * Get sync statistics
   */
  @Get('sync/stats')
  @ApiOperation({
    summary: 'Get sync statistics',
    description: 'Returns detailed synchronization statistics and metrics',
  })
  @ApiResponse({
    status: 200,
    description: 'Sync statistics data',
  })
  async getSyncStats(): Promise<any> {
    try {
      this.logger.debug('Sync stats requested');
      
      const syncStatus = await this.shopifySchedulerService.getSyncStatus();
      const aggregatedMetrics = await this.redisService.get('sync:metrics:aggregated');
      const lastError = await this.redisService.get('sync:last_error');

      return {
        status: 'success',
        data: {
          current: syncStatus,
          aggregated: aggregatedMetrics,
          lastError,
          performance: {
            averageDuration: (aggregatedMetrics as any)?.averageDuration || 0,
            successRate: (aggregatedMetrics as any)?.totalSyncs > 0 ? 
              (((aggregatedMetrics as any).successfulSyncs / (aggregatedMetrics as any).totalSyncs) * 100) : 0,
            totalSyncs: (aggregatedMetrics as any)?.totalSyncs || 0,
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get sync stats:', error);
      throw error;
    }
  }

  /**
   * Trigger manual sync
   */
  @Post('sync/trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Trigger manual sync',
    description: 'Manually triggers a Shopify data synchronization',
  })
  @ApiResponse({
    status: 202,
    description: 'Sync triggered successfully',
  })
  async triggerSync(): Promise<any> {
    try {
      this.logger.log('Manual sync trigger requested');
      
      // Trigger the sync asynchronously
      this.shopifySchedulerService.triggerManualSync().catch(error => {
        this.logger.error('Manual sync failed:', error);
      });

      return {
        status: 'success',
        message: 'Sync triggered successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to trigger sync:', error);
      throw error;
    }
  }

  /**
   * Reset sync failure count
   */
  @Post('sync/reset-failures')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset sync failure count',
    description: 'Resets the consecutive sync failure count',
  })
  @ApiResponse({
    status: 200,
    description: 'Failure count reset successfully',
  })
  async resetSyncFailures(): Promise<any> {
    try {
      this.logger.log('Sync failure reset requested');
      
      await this.shopifySchedulerService.resetFailureCount();

      return {
        status: 'success',
        message: 'Sync failure count reset successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to reset sync failures:', error);
      throw error;
    }
  }

  /**
   * Get cleanup statistics
   */
  @Get('cleanup/stats')
  @ApiOperation({
    summary: 'Get cleanup statistics',
    description: 'Returns data cleanup statistics and schedule information',
  })
  @ApiResponse({
    status: 200,
    description: 'Cleanup statistics data',
  })
  async getCleanupStats(): Promise<any> {
    try {
      this.logger.debug('Cleanup stats requested');
      
      const cleanupStats = await this.dataCleanupService.getCleanupStats();

      return {
        status: 'success',
        data: cleanupStats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get cleanup stats:', error);
      throw error;
    }
  }

  /**
   * Trigger manual cleanup
   */
  @Post('cleanup/trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Trigger manual cleanup',
    description: 'Manually triggers data cleanup process',
  })
  @ApiResponse({
    status: 202,
    description: 'Cleanup triggered successfully',
  })
  async triggerCleanup(): Promise<any> {
    try {
      this.logger.log('Manual cleanup trigger requested');
      
      // Trigger cleanup asynchronously
      this.dataCleanupService.triggerManualCleanup().catch(error => {
        this.logger.error('Manual cleanup failed:', error);
      });

      return {
        status: 'success',
        message: 'Cleanup triggered successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to trigger cleanup:', error);
      throw error;
    }
  }

  /**
   * Check if emergency cleanup is needed
   */
  @Get('cleanup/emergency-check')
  @ApiOperation({
    summary: 'Check emergency cleanup need',
    description: 'Checks if emergency cleanup is needed based on system resources',
  })
  @ApiResponse({
    status: 200,
    description: 'Emergency cleanup check result',
  })
  async checkEmergencyCleanup(): Promise<any> {
    try {
      this.logger.debug('Emergency cleanup check requested');
      
      const isNeeded = await this.dataCleanupService.checkIfEmergencyCleanupNeeded();
      const memUsage = process.memoryUsage();

      return {
        status: 'success',
        data: {
          emergencyCleanupNeeded: isNeeded,
          currentMemoryUsage: {
            heapUsed: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100,
            heapTotal: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100,
            usagePercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 10000) / 100,
          },
          recommendation: isNeeded ? 'Emergency cleanup recommended' : 'System resources are adequate',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to check emergency cleanup:', error);
      throw error;
    }
  }

  /**
   * Get cache information
   */
  @Get('cache/info')
  @ApiOperation({
    summary: 'Get cache information',
    description: 'Returns detailed cache usage and performance information',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache information data',
  })
  async getCacheInfo(): Promise<any> {
    try {
      this.logger.debug('Cache info requested');
      
      const cacheStats = await this.analyticsService.getCacheStats();
      const cacheKeys = this.redisService.getCacheKeys();

      return {
        status: 'success',
        data: {
          stats: cacheStats,
          keyStructure: {
            dashboard: Object.keys(cacheKeys.dashboard),
            shopify: ['orders', 'products', 'customers', 'lastSync'],
            analytics: ['dailySales', 'monthlySales', 'yearToDate', 'topProducts', 'customerAnalytics'],
            performance: ['requestCount', 'responseTime'],
          },
          recommendations: this.generateCacheRecommendations(cacheStats),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get cache info:', error);
      throw error;
    }
  }

  /**
   * Clear specific cache keys
   */
  @Post('cache/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clear cache',
    description: 'Clears specific cache keys or all cache data',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache cleared successfully',
  })
  @ApiQuery({
    name: 'pattern',
    required: false,
    type: 'string',
    description: 'Cache key pattern to clear (default: all)',
  })
  async clearCache(@Query('pattern') pattern?: string): Promise<any> {
    try {
      this.logger.log(`Cache clear requested (pattern: ${pattern || 'all'})`);
      
      if (pattern) {
        // Clear specific pattern - would need implementation
        // For now, just clear analytics cache
        await this.analyticsService.clearCache();
      } else {
        // Clear all cache
        await this.redisService.clearAll();
      }

      return {
        status: 'success',
        message: `Cache cleared successfully${pattern ? ` (pattern: ${pattern})` : ' (all)'}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to clear cache:', error);
      throw error;
    }
  }

  /**
   * Get system alerts
   */
  @Get('alerts')
  @ApiOperation({
    summary: 'Get system alerts',
    description: 'Returns current system alerts and warnings',
  })
  @ApiResponse({
    status: 200,
    description: 'System alerts data',
  })
  async getSystemAlerts(): Promise<any> {
    try {
      this.logger.debug('System alerts requested');
      
      const [inventoryAlerts, systemAlerts, performanceAlerts, validationResults] = await Promise.all([
        this.redisService.get('alerts:inventory'),
        this.redisService.get('alerts:system'),
        this.redisService.get('alerts:performance'),
        this.redisService.get('system:validation_results'),
      ]);

      const inventoryAlertsArray = (inventoryAlerts as any[]) || [];
      const systemAlertsArray = (systemAlerts as any[]) || [];
      const performanceAlertsArray = (performanceAlerts as any[]) || [];

      // Add validation failures as alerts
      const validationAlerts = [];
      if ((validationResults as any)?.results) {
        ((validationResults as any).results as any[])
          .filter(result => result.status === 'FAIL')
          .forEach(result => {
            validationAlerts.push({
              type: 'VALIDATION_FAILURE',
              severity: 'HIGH',
              message: result.message,
              check: result.check,
              timestamp: (validationResults as any).timestamp,
            });
          });
      }

      const allAlerts = [
        ...inventoryAlertsArray,
        ...systemAlertsArray,
        ...performanceAlertsArray,
        ...validationAlerts,
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const alertSummary = {
        total: allAlerts.length,
        critical: allAlerts.filter(a => a.severity === 'CRITICAL').length,
        high: allAlerts.filter(a => a.severity === 'HIGH').length,
        medium: allAlerts.filter(a => a.severity === 'MEDIUM').length,
        low: allAlerts.filter(a => a.severity === 'LOW').length,
        byType: {
          inventory: inventoryAlertsArray.length,
          system: systemAlertsArray.length,
          performance: performanceAlertsArray.length,
          validation: validationAlerts.length,
        },
      };

      return {
        status: 'success',
        data: {
          summary: alertSummary,
          alerts: allAlerts.slice(0, 50), // Most recent 50 alerts
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get system alerts:', error);
      throw error;
    }
  }

  /**
   * Get system configuration
   */
  @Get('config')
  @ApiOperation({
    summary: 'Get system configuration',
    description: 'Returns current system configuration (non-sensitive values only)',
  })
  @ApiResponse({
    status: 200,
    description: 'System configuration data',
  })
  async getSystemConfig(): Promise<any> {
    try {
      this.logger.debug('System config requested');
      
      // Return only non-sensitive configuration
      const config = {
        app: {
          nodeEnv: process.env.NODE_ENV || 'development',
          version: process.env.npm_package_version || '1.0.0',
        },
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          ttl: process.env.REDIS_TTL || 300,
        },
        cache: {
          ttlSeconds: process.env.CACHE_TTL_SECONDS || 300,
          dashboardDataTtl: process.env.DASHBOARD_DATA_TTL || 60,
        },
        throttle: {
          ttl: process.env.THROTTLE_TTL || 60,
          limit: process.env.THROTTLE_LIMIT || 100,
        },
        shopify: {
          apiVersion: process.env.SHOPIFY_API_VERSION || '2025-04',
          shopDomain: process.env.SHOPIFY_SHOP_DOMAIN ? '***configured***' : 'not configured',
          accessToken: process.env.SHOPIFY_ACCESS_TOKEN ? '***configured***' : 'not configured',
        },
        performance: {
          maxConcurrentRequests: process.env.MAX_CONCURRENT_SHOPIFY_REQUESTS || 5,
          requestTimeout: process.env.REQUEST_TIMEOUT || 30000,
        },
      };

      return {
        status: 'success',
        data: config,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get system config:', error);
      throw error;
    }
  }

  /**
   * Calculate overall system health
   */
  private calculateSystemHealth(syncStatus: any, cacheStats: any, validationResults: any): string {
    let healthScore = 100;

    // Sync health (40% weight)
    if (syncStatus?.status === 'ERROR') {
      healthScore -= 40;
    } else if (syncStatus?.status === 'WARNING') {
      healthScore -= 20;
    }

    // Cache health (30% weight)
    if (!cacheStats || Object.keys(cacheStats).length === 0) {
      healthScore -= 30;
    } else {
      const cacheHealthy = Object.values(cacheStats).filter(Boolean).length;
      const cacheTotal = Object.values(cacheStats).length;
      const cacheHealthPercent = (cacheHealthy / cacheTotal) * 100;
      healthScore -= (100 - cacheHealthPercent) * 0.3;
    }

    // Validation health (30% weight)
    if (validationResults?.overallStatus === 'FAIL') {
      healthScore -= 30;
    } else if (validationResults?.overallStatus === 'WARN') {
      healthScore -= 15;
    }

    if (healthScore >= 80) return 'HEALTHY';
    if (healthScore >= 60) return 'DEGRADED';
    return 'UNHEALTHY';
  }

  /**
   * Generate cache recommendations
   */
  private generateCacheRecommendations(cacheStats: any): string[] {
    const recommendations = [];

    if (!cacheStats) {
      recommendations.push('Cache statistics are not available - check Redis connection');
      return recommendations;
    }

    if (!cacheStats.summary) {
      recommendations.push('Dashboard summary cache is missing - trigger a data refresh');
    }

    if (!cacheStats.lastSync) {
      recommendations.push('Last sync timestamp is missing - check scheduler health');
    }

    const cacheHealthy = Object.values(cacheStats).filter(Boolean).length;
    const cacheTotal = Object.values(cacheStats).length;
    const cacheHealthPercent = (cacheHealthy / cacheTotal) * 100;

    if (cacheHealthPercent < 50) {
      recommendations.push('Low cache hit rate detected - consider increasing TTL values');
    }

    if (recommendations.length === 0) {
      recommendations.push('Cache performance is optimal');
    }

    return recommendations;
  }
}
