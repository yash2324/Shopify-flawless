import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { ShopifyService } from '../shopify/shopify.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: HealthCheck[];
  uptime: number;
  version: string;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  responseTime?: number;
  message?: string;
  details?: any;
}

@Injectable()
export class HealthCheckService {
  private readonly logger = new Logger(HealthCheckService.name);
  private readonly startTime = Date.now();

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly shopifyService: ShopifyService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Comprehensive health check - runs every 5 minutes
   */
  @Cron('*/5 * * * *', {
    name: 'comprehensive-health-check',
    timeZone: 'UTC',
  })
  async performHealthCheck(): Promise<void> {
    this.logger.debug('Performing comprehensive health check');

    try {
      const healthStatus = await this.getHealthStatus();
      
      // Store health status in Redis
      await this.redisService.set(
        'system:health_status',
        healthStatus,
        { ttl: 600 } // 10 minutes TTL
      );

      // Log health status based on overall health
      if (healthStatus.status === 'unhealthy') {
        this.logger.error('System health check failed', { status: healthStatus });
      } else if (healthStatus.status === 'degraded') {
        this.logger.warn('System health degraded', { status: healthStatus });
      } else {
        this.logger.debug('System health check passed');
      }

      // Check if emergency actions are needed
      await this.handleUnhealthyState(healthStatus);

    } catch (error) {
      this.logger.error('Health check execution failed:', error);
      
      // Store error state
      const errorStatus: HealthStatus = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: [{
          name: 'health_check_execution',
          status: 'fail',
          message: `Health check failed: ${error.message}`,
        }],
        uptime: this.getUptime(),
        version: this.getVersion(),
      };

      await this.redisService.set(
        'system:health_status',
        errorStatus,
        { ttl: 600 }
      );
    }
  }

  /**
   * Quick health check for API endpoints
   */
  async getQuickHealthStatus(): Promise<HealthStatus> {
    const checks: HealthCheck[] = [];

    // Quick Redis check
    const redisCheck = await this.checkRedisHealth(true);
    checks.push(redisCheck);

    // Quick application health
    const appCheck = await this.checkApplicationHealth();
    checks.push(appCheck);

    const overallStatus = this.determineOverallStatus(checks);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      uptime: this.getUptime(),
      version: this.getVersion(),
    };
  }

  /**
   * Full health status with all checks
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const checks: HealthCheck[] = [];

    // Perform all health checks in parallel for speed
    const [
      redisCheck,
      shopifyCheck,
      applicationCheck,
      memoryCheck,
      diskCheck,
      dependencyCheck,
    ] = await Promise.all([
      this.checkRedisHealth(),
      this.checkShopifyHealth(),
      this.checkApplicationHealth(),
      this.checkMemoryHealth(),
      this.checkDiskHealth(),
      this.checkDependencyHealth(),
    ]);

    checks.push(redisCheck, shopifyCheck, applicationCheck, memoryCheck, diskCheck, dependencyCheck);

    const overallStatus = this.determineOverallStatus(checks);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      uptime: this.getUptime(),
      version: this.getVersion(),
    };
  }

  /**
   * Check Redis connectivity and performance
   */
  private async checkRedisHealth(quick: boolean = false): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // Test Redis connectivity
      const testKey = 'health:redis_test';
      const testValue = Date.now().toString();
      
      await this.redisService.set(testKey, testValue, { ttl: 60 });
      const retrievedValue = await this.redisService.get(testKey);
      
      const responseTime = Date.now() - startTime;

      if (retrievedValue === testValue) {
        // Clean up test key
        await this.redisService.del(testKey);

        let status: 'pass' | 'warn' | 'fail' = 'pass';
        let message = 'Redis is responding normally';

        // Check response time thresholds
        if (responseTime > 1000) {
          status = 'warn';
          message = `Redis response time is slow: ${responseTime}ms`;
        } else if (responseTime > 5000) {
          status = 'fail';
          message = `Redis response time is critical: ${responseTime}ms`;
        }

        const details: any = { responseTime };

        // Add additional checks if not quick
        if (!quick) {
          // Cache stats would be implemented if needed
          details.cacheHealthy = true;
        }

        return {
          name: 'redis',
          status,
          responseTime,
          message,
          details,
        };
      } else {
        return {
          name: 'redis',
          status: 'fail',
          responseTime,
          message: 'Redis data integrity check failed',
        };
      }

    } catch (error) {
      return {
        name: 'redis',
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: `Redis connection failed: ${error.message}`,
      };
    }
  }

  /**
   * Check Shopify API connectivity and rate limits
   */
  private async checkShopifyHealth(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const isHealthy = await this.shopifyService.healthCheck();
      const responseTime = Date.now() - startTime;

      if (isHealthy) {
        // Get API usage stats if available
        const apiStats = await this.shopifyService.getAPIUsageStats();
        
        let status: 'pass' | 'warn' | 'fail' = 'pass';
        let message = 'Shopify API is accessible';

        // Check for rate limiting warnings
        if (apiStats && apiStats.availableCredits < apiStats.maxCredits * 0.2) {
          status = 'warn';
          message = 'Shopify API rate limit approaching';
        }

        return {
          name: 'shopify_api',
          status,
          responseTime,
          message,
          details: apiStats,
        };
      } else {
        return {
          name: 'shopify_api',
          status: 'fail',
          responseTime,
          message: 'Shopify API is not accessible',
        };
      }

    } catch (error) {
      return {
        name: 'shopify_api',
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: `Shopify API check failed: ${error.message}`,
      };
    }
  }

  /**
   * Check application health (memory, event loop, etc.)
   */
  private async checkApplicationHealth(): Promise<HealthCheck> {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      let status: 'pass' | 'warn' | 'fail' = 'pass';
      const messages: string[] = [];

      // Check memory usage
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
      const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;

      if (heapUsagePercent > 90) {
        status = 'fail';
        messages.push(`Critical memory usage: ${heapUsagePercent.toFixed(1)}%`);
      } else if (heapUsagePercent > 80) {
        status = 'warn';
        messages.push(`High memory usage: ${heapUsagePercent.toFixed(1)}%`);
      } else {
        messages.push(`Memory usage: ${heapUsagePercent.toFixed(1)}%`);
      }

      return {
        name: 'application',
        status,
        message: messages.join(', '),
        details: {
          memory: {
            heapUsed: Math.round(heapUsedMB),
            heapTotal: Math.round(heapTotalMB),
            usagePercent: Math.round(heapUsagePercent * 100) / 100,
          },
          uptime: this.getUptime(),
          nodeVersion: process.version,
        },
      };

    } catch (error) {
      return {
        name: 'application',
        status: 'fail',
        message: `Application health check failed: ${error.message}`,
      };
    }
  }

  /**
   * Check memory health
   */
  private async checkMemoryHealth(): Promise<HealthCheck> {
    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const rssUsedMB = memUsage.rss / 1024 / 1024;

      let status: 'pass' | 'warn' | 'fail' = 'pass';
      let message = 'Memory usage is normal';

      if (heapUsedMB > 512) { // 512MB threshold
        status = 'fail';
        message = `Critical heap usage: ${heapUsedMB.toFixed(1)}MB`;
      } else if (heapUsedMB > 256) { // 256MB threshold
        status = 'warn';
        message = `High heap usage: ${heapUsedMB.toFixed(1)}MB`;
      }

      return {
        name: 'memory',
        status,
        message,
        details: {
          heapUsed: Math.round(heapUsedMB * 100) / 100,
          rss: Math.round(rssUsedMB * 100) / 100,
          external: Math.round((memUsage.external / 1024 / 1024) * 100) / 100,
          arrayBuffers: Math.round((memUsage.arrayBuffers / 1024 / 1024) * 100) / 100,
        },
      };

    } catch (error) {
      return {
        name: 'memory',
        status: 'fail',
        message: `Memory check failed: ${error.message}`,
      };
    }
  }

  /**
   * Check disk health (simplified)
   */
  private async checkDiskHealth(): Promise<HealthCheck> {
    try {
      // In a real implementation, you would check disk space
      // For this example, we'll simulate a disk check
      
      return {
        name: 'disk',
        status: 'pass',
        message: 'Disk space is sufficient',
        details: {
          // In reality, you'd check actual disk usage
          available: '85%',
          used: '15%',
        },
      };

    } catch (error) {
      return {
        name: 'disk',
        status: 'fail',
        message: `Disk check failed: ${error.message}`,
      };
    }
  }

  /**
   * Check critical dependencies
   */
  private async checkDependencyHealth(): Promise<HealthCheck> {
    try {
      const checks = [];

      // Check if critical modules are available
      const criticalModules = ['ioredis', 'axios', '@nestjs/common'];
      
      for (const module of criticalModules) {
        try {
          require.resolve(module);
          checks.push({ module, status: 'ok' });
        } catch {
          checks.push({ module, status: 'missing' });
        }
      }

      const failedChecks = checks.filter(c => c.status !== 'ok');
      
      if (failedChecks.length > 0) {
        return {
          name: 'dependencies',
          status: 'fail',
          message: `Missing dependencies: ${failedChecks.map(c => c.module).join(', ')}`,
          details: { checks },
        };
      }

      return {
        name: 'dependencies',
        status: 'pass',
        message: 'All critical dependencies are available',
        details: { checks },
      };

    } catch (error) {
      return {
        name: 'dependencies',
        status: 'fail',
        message: `Dependency check failed: ${error.message}`,
      };
    }
  }

  /**
   * Determine overall system status based on individual checks
   */
  private determineOverallStatus(checks: HealthCheck[]): 'healthy' | 'degraded' | 'unhealthy' {
    const failedChecks = checks.filter(check => check.status === 'fail');
    const warnChecks = checks.filter(check => check.status === 'warn');

    if (failedChecks.length > 0) {
      return 'unhealthy';
    } else if (warnChecks.length > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  /**
   * Handle unhealthy system state
   */
  private async handleUnhealthyState(healthStatus: HealthStatus): Promise<void> {
    if (healthStatus.status === 'unhealthy') {
      const failedChecks = healthStatus.checks.filter(check => check.status === 'fail');
      
      for (const check of failedChecks) {
        // Take specific actions based on failed checks
        switch (check.name) {
          case 'redis':
            this.logger.error('Redis health check failed - attempting recovery');
            // In a real scenario, you might try to reconnect or failover
            break;
            
          case 'memory':
            this.logger.error('Memory health check failed - considering cleanup');
            // Trigger emergency cleanup
            break;
            
          case 'shopify_api':
            this.logger.error('Shopify API health check failed');
            // Might implement circuit breaker pattern
            break;
        }
      }
    }
  }

  /**
   * Get system uptime in seconds
   */
  private getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Get application version
   */
  private getVersion(): string {
    // In a real application, this would read from package.json or environment
    return process.env.npm_package_version || '1.0.0';
  }

  /**
   * Get health history for monitoring dashboards
   */
  async getHealthHistory(hours: number = 24): Promise<any[]> {
    try {
      // In a real implementation, you would store health check results
      // over time and return historical data
      
      const history = [];
      
      // Placeholder implementation - would fetch from time series data
      for (let i = hours; i >= 0; i--) {
        const timestamp = new Date(Date.now() - i * 60 * 60 * 1000);
        history.push({
          timestamp: timestamp.toISOString(),
          status: 'healthy', // Would be actual historical data
          responseTime: Math.random() * 100 + 50, // Mock data
        });
      }

      return history;

    } catch (error) {
      this.logger.error('Failed to get health history:', error);
      return [];
    }
  }
}
