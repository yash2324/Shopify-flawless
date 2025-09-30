import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class DataCleanupService {
  private readonly logger = new Logger(DataCleanupService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Daily cleanup of old data and metrics
   * Runs at midnight UTC every day
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'daily-data-cleanup',
    timeZone: 'UTC',
  })
  async performDailyCleanup(): Promise<void> {
    this.logger.log('Starting daily data cleanup');

    try {
      const cleanupResults = {
        syncMetricsRemoved: 0,
        oldAlertsRemoved: 0,
        expiredCacheCleared: 0,
        performanceMetricsRemoved: 0,
      };

      // Clean up old sync metrics (older than 7 days)
      cleanupResults.syncMetricsRemoved = await this.cleanupOldSyncMetrics();

      // Clean up old alerts (older than 24 hours)
      cleanupResults.oldAlertsRemoved = await this.cleanupOldAlerts();

      // Clean up old performance metrics (older than 7 days)
      cleanupResults.performanceMetricsRemoved = await this.cleanupOldPerformanceMetrics();

      // Log cleanup results
      this.logger.log('Daily cleanup completed:', cleanupResults);

      // Store cleanup results for monitoring
      await this.redisService.set(
        'system:last_cleanup',
        {
          timestamp: new Date().toISOString(),
          results: cleanupResults,
        },
        { ttl: 86400 } // 24 hours TTL
      );

    } catch (error) {
      this.logger.error('Daily cleanup failed:', error);
    }
  }

  /**
   * Weekly cleanup of historical data
   * Runs every Sunday at 2 AM UTC
   */
  @Cron('0 2 * * 0', {
    name: 'weekly-data-cleanup',
    timeZone: 'UTC',
  })
  async performWeeklyCleanup(): Promise<void> {
    this.logger.log('Starting weekly data cleanup');

    try {
      const cleanupResults = {
        oldAnalyticsRemoved: 0,
        historicalDataArchived: 0,
        cacheOptimized: 0,
      };

      // Archive old analytics data (older than 30 days)
      cleanupResults.oldAnalyticsRemoved = await this.archiveOldAnalytics();

      // Optimize cache performance
      cleanupResults.cacheOptimized = await this.optimizeCache();

      this.logger.log('Weekly cleanup completed:', cleanupResults);

      // Store weekly cleanup results
      await this.redisService.set(
        'system:last_weekly_cleanup',
        {
          timestamp: new Date().toISOString(),
          results: cleanupResults,
        },
        { ttl: 604800 } // 7 days TTL
      );

    } catch (error) {
      this.logger.error('Weekly cleanup failed:', error);
    }
  }

  /**
   * Hourly cleanup of temporary data
   * Runs every hour
   */
  @Cron(CronExpression.EVERY_HOUR, {
    name: 'hourly-temp-cleanup',
    timeZone: 'UTC',
  })
  async performHourlyCleanup(): Promise<void> {
    this.logger.debug('Starting hourly temporary data cleanup');

    try {
      // Clean up temporary processing data
      const tempKeysRemoved = await this.cleanupTemporaryKeys();

      // Clean up expired session data
      const expiredSessionsRemoved = await this.cleanupExpiredSessions();

      if (tempKeysRemoved > 0 || expiredSessionsRemoved > 0) {
        this.logger.debug(`Hourly cleanup: ${tempKeysRemoved} temp keys, ${expiredSessionsRemoved} expired sessions removed`);
      }

    } catch (error) {
      this.logger.error('Hourly cleanup failed:', error);
    }
  }

  /**
   * Emergency cleanup when memory usage is high
   */
  async performEmergencyCleanup(): Promise<void> {
    this.logger.warn('Performing emergency cleanup due to high memory usage');

    try {
      // Aggressively clean caches
      await this.redisService.clearAll();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        this.logger.warn('Forced garbage collection');
      }

      this.logger.warn('Emergency cleanup completed');

    } catch (error) {
      this.logger.error('Emergency cleanup failed:', error);
    }
  }

  /**
   * Clean up old sync metrics
   */
  private async cleanupOldSyncMetrics(): Promise<number> {
    try {
      // This would typically use Redis SCAN to find and delete old keys
      // For now, we'll simulate the cleanup
      
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const removedCount = 0;

      // In a real implementation, you would scan for keys matching pattern
      // and check their timestamps, then delete old ones
      
      this.logger.debug(`Cleaned up ${removedCount} old sync metrics`);
      return removedCount;

    } catch (error) {
      this.logger.error('Failed to cleanup old sync metrics:', error);
      return 0;
    }
  }

  /**
   * Clean up old alerts
   */
  private async cleanupOldAlerts(): Promise<number> {
    try {
      const alertKeys = ['alerts:inventory', 'alerts:performance', 'alerts:system'];
      let removedCount = 0;

      for (const key of alertKeys) {
        const alerts = await this.redisService.get(key);
        
        if (alerts && Array.isArray(alerts)) {
          const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
          const freshAlerts = alerts.filter(alert => {
            const alertTime = new Date(alert.timestamp).getTime();
            return alertTime > oneDayAgo;
          });

          if (freshAlerts.length !== alerts.length) {
            await this.redisService.set(key, freshAlerts, { ttl: 86400 });
            removedCount += alerts.length - freshAlerts.length;
          }
        }
      }

      this.logger.debug(`Cleaned up ${removedCount} old alerts`);
      return removedCount;

    } catch (error) {
      this.logger.error('Failed to cleanup old alerts:', error);
      return 0;
    }
  }

  /**
   * Clean up old performance metrics
   */
  private async cleanupOldPerformanceMetrics(): Promise<number> {
    try {
      // Clean up performance metrics older than 7 days
      const removedCount = 0;

      // This would scan for performance metric keys and remove old ones
      // Implementation would depend on your key naming strategy

      this.logger.debug(`Cleaned up ${removedCount} old performance metrics`);
      return removedCount;

    } catch (error) {
      this.logger.error('Failed to cleanup old performance metrics:', error);
      return 0;
    }
  }

  /**
   * Archive old analytics data
   */
  private async archiveOldAnalytics(): Promise<number> {
    try {
      // Move old analytics data to long-term storage
      // This could involve moving data to a database or file storage
      
      const archivedCount = 0;

      // Implementation would move old cached analytics to persistent storage
      // and remove them from Redis cache

      this.logger.debug(`Archived ${archivedCount} old analytics records`);
      return archivedCount;

    } catch (error) {
      this.logger.error('Failed to archive old analytics:', error);
      return 0;
    }
  }

  /**
   * Optimize cache performance
   */
  private async optimizeCache(): Promise<number> {
    try {
      let optimizationCount = 0;

      // Refresh frequently accessed cache entries to extend their TTL
      const frequentlyAccessedKeys = [
        'dashboard:summary',
        'dashboard:sales',
        'dashboard:customers',
        'dashboard:inventory',
      ];

      for (const key of frequentlyAccessedKeys) {
        const cacheKeys = this.redisService.getCacheKeys();
        const fullKey = cacheKeys.dashboard[key.split(':')[1] as keyof typeof cacheKeys.dashboard];
        
        if (typeof fullKey === 'string') {
          const exists = await this.redisService.exists(fullKey);
          if (exists) {
            // Reset TTL for frequently accessed keys
            const data = await this.redisService.get(fullKey);
            if (data) {
              await this.redisService.set(fullKey, data, { ttl: 3600 });
              optimizationCount++;
            }
          }
        }
      }

      this.logger.debug(`Optimized ${optimizationCount} cache entries`);
      return optimizationCount;

    } catch (error) {
      this.logger.error('Failed to optimize cache:', error);
      return 0;
    }
  }

  /**
   * Clean up temporary processing keys
   */
  private async cleanupTemporaryKeys(): Promise<number> {
    try {
      // Clean up keys that start with 'temp:' or 'processing:'
      const removedCount = 0;

      // In a real implementation, you would use Redis SCAN to find
      // temporary keys and remove expired ones

      return removedCount;

    } catch (error) {
      this.logger.error('Failed to cleanup temporary keys:', error);
      return 0;
    }
  }

  /**
   * Clean up expired sessions
   */
  private async cleanupExpiredSessions(): Promise<number> {
    try {
      // Clean up expired user sessions or API keys
      const removedCount = 0;

      // Implementation would clean up expired authentication tokens,
      // API rate limiting counters, etc.

      return removedCount;

    } catch (error) {
      this.logger.error('Failed to cleanup expired sessions:', error);
      return 0;
    }
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats(): Promise<any> {
    try {
      const [lastCleanup, lastWeeklyCleanup] = await Promise.all([
        this.redisService.get('system:last_cleanup'),
        this.redisService.get('system:last_weekly_cleanup'),
      ]);

      return {
        lastDailyCleanup: lastCleanup,
        lastWeeklyCleanup: lastWeeklyCleanup,
        nextDailyCleanup: this.getNextDailyCleanupTime(),
        nextWeeklyCleanup: this.getNextWeeklyCleanupTime(),
      };

    } catch (error) {
      this.logger.error('Failed to get cleanup stats:', error);
      return null;
    }
  }

  /**
   * Manual trigger for immediate cleanup
   */
  async triggerManualCleanup(): Promise<void> {
    this.logger.log('Manual cleanup triggered');
    await this.performDailyCleanup();
  }

  /**
   * Check if emergency cleanup is needed
   */
  async checkIfEmergencyCleanupNeeded(): Promise<boolean> {
    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
      const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;

      // Trigger emergency cleanup if heap usage > 90%
      if (heapUsagePercent > 90) {
        this.logger.warn(`High memory usage detected: ${heapUsagePercent.toFixed(2)}%`);
        return true;
      }

      return false;

    } catch (error) {
      this.logger.error('Failed to check memory usage:', error);
      return false;
    }
  }

  /**
   * Calculate next daily cleanup time
   */
  private getNextDailyCleanupTime(): string {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(0, 0, 0, 0);
    next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString();
  }

  /**
   * Calculate next weekly cleanup time
   */
  private getNextWeeklyCleanupTime(): string {
    const now = new Date();
    const next = new Date(now);
    const daysUntilSunday = (7 - now.getUTCDay()) % 7;
    next.setUTCDate(next.getUTCDate() + daysUntilSunday);
    next.setUTCHours(2, 0, 0, 0);
    
    // If it's already past Sunday 2 AM, schedule for next week
    if (next <= now) {
      next.setUTCDate(next.getUTCDate() + 7);
    }
    
    return next.toISOString();
  }
}
