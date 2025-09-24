import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { HealthCheckService, HealthStatus } from '../../scheduler/health-check.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly healthCheckService: HealthCheckService) {}

  /**
   * Basic health check endpoint
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Basic health check',
    description: 'Returns basic application health status',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
        timestamp: { type: 'string' },
        uptime: { type: 'number' },
        version: { type: 'string' },
      },
    },
  })
  async getHealth(): Promise<any> {
    try {
      const healthStatus = await this.healthCheckService.getQuickHealthStatus();
      
      // Set appropriate HTTP status based on health
      const httpStatus = healthStatus.status === 'healthy' ? 200 : 
                        healthStatus.status === 'degraded' ? 200 : 503;

      return {
        status: healthStatus.status,
        timestamp: healthStatus.timestamp,
        uptime: healthStatus.uptime,
        version: healthStatus.version,
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  /**
   * Detailed health check endpoint
   */
  @Get('detailed')
  @ApiOperation({
    summary: 'Detailed health check',
    description: 'Returns comprehensive health status with all subsystem checks',
  })
  @ApiResponse({
    status: 200,
    description: 'Detailed health status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
        timestamp: { type: 'string' },
        checks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              status: { type: 'string', enum: ['pass', 'warn', 'fail'] },
              responseTime: { type: 'number' },
              message: { type: 'string' },
              details: { type: 'object' },
            },
          },
        },
        uptime: { type: 'number' },
        version: { type: 'string' },
      },
    },
  })
  async getDetailedHealth(): Promise<HealthStatus> {
    try {
      const healthStatus = await this.healthCheckService.getHealthStatus();
      
      this.logger.debug(`Detailed health check: ${healthStatus.status}`);
      
      return healthStatus;
    } catch (error) {
      this.logger.error('Detailed health check failed:', error);
      
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: [{
          name: 'health_check_execution',
          status: 'fail',
          message: `Health check failed: ${error.message}`,
        }],
        uptime: 0,
        version: '1.0.0',
      };
    }
  }

  /**
   * Readiness probe for Kubernetes
   */
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Kubernetes readiness probe endpoint',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is ready to serve traffic',
  })
  @ApiResponse({
    status: 503,
    description: 'Application is not ready',
  })
  async getReadiness(): Promise<any> {
    try {
      const healthStatus = await this.healthCheckService.getQuickHealthStatus();
      
      // Application is ready if it's healthy or degraded, but not unhealthy
      const isReady = healthStatus.status !== 'unhealthy';
      
      if (isReady) {
        return {
          status: 'ready',
          timestamp: new Date().toISOString(),
        };
      } else {
        // Return 503 Service Unavailable for unhealthy state
        throw new Error('Application is not ready');
      }
    } catch (error) {
      this.logger.error('Readiness check failed:', error);
      throw error;
    }
  }

  /**
   * Liveness probe for Kubernetes
   */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Kubernetes liveness probe endpoint',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is alive',
  })
  async getLiveness(): Promise<any> {
    try {
      // Simple liveness check - just verify the application is responding
      return {
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    } catch (error) {
      this.logger.error('Liveness check failed:', error);
      throw error;
    }
  }

  /**
   * Health history for monitoring
   */
  @Get('history')
  @ApiOperation({
    summary: 'Get health history',
    description: 'Returns health check history for monitoring and trending',
  })
  @ApiResponse({
    status: 200,
    description: 'Health history data',
  })
  @ApiQuery({
    name: 'hours',
    required: false,
    type: 'number',
    description: 'Number of hours of history to return (default: 24, max: 168)',
  })
  async getHealthHistory(@Query('hours') hours?: number): Promise<any> {
    try {
      const requestedHours = Math.min(hours || 24, 168); // Max 7 days
      
      this.logger.debug(`Health history requested for ${requestedHours} hours`);
      
      const history = await this.healthCheckService.getHealthHistory(requestedHours);
      
      return {
        status: 'success',
        data: {
          period: `${requestedHours} hours`,
          history,
          summary: {
            totalChecks: history.length,
            healthyChecks: history.filter(h => h.status === 'healthy').length,
            degradedChecks: history.filter(h => h.status === 'degraded').length,
            unhealthyChecks: history.filter(h => h.status === 'unhealthy').length,
            averageResponseTime: history.length > 0 ? 
              history.reduce((sum, h) => sum + (h.responseTime || 0), 0) / history.length : 0,
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get health history:', error);
      throw error;
    }
  }

  /**
   * System metrics for monitoring
   */
  @Get('metrics')
  @ApiOperation({
    summary: 'Get system metrics',
    description: 'Returns system performance metrics',
  })
  @ApiResponse({
    status: 200,
    description: 'System metrics data',
  })
  async getSystemMetrics(): Promise<any> {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      const metrics = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          heapUsed: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100, // MB
          heapTotal: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100, // MB
          rss: Math.round((memUsage.rss / 1024 / 1024) * 100) / 100, // MB
          external: Math.round((memUsage.external / 1024 / 1024) * 100) / 100, // MB
          usagePercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 10000) / 100,
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        process: {
          pid: process.pid,
          version: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        node: {
          versions: process.versions,
        },
      };

      return {
        status: 'success',
        data: metrics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get system metrics:', error);
      throw error;
    }
  }

  /**
   * Component status check
   */
  @Get('components')
  @ApiOperation({
    summary: 'Get component status',
    description: 'Returns status of individual system components',
  })
  @ApiResponse({
    status: 200,
    description: 'Component status data',
  })
  async getComponentStatus(): Promise<any> {
    try {
      const healthStatus = await this.healthCheckService.getHealthStatus();
      
      // Transform checks into component status
      const components = healthStatus.checks.map(check => ({
        name: check.name,
        status: check.status,
        responseTime: check.responseTime,
        message: check.message,
        lastCheck: healthStatus.timestamp,
        healthy: check.status === 'pass',
      }));

      const summary = {
        total: components.length,
        healthy: components.filter(c => c.healthy).length,
        unhealthy: components.filter(c => !c.healthy).length,
        overallStatus: healthStatus.status,
      };

      return {
        status: 'success',
        data: {
          summary,
          components,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get component status:', error);
      throw error;
    }
  }

  /**
   * Dependencies health check
   */
  @Get('dependencies')
  @ApiOperation({
    summary: 'Get dependencies health',
    description: 'Returns health status of external dependencies',
  })
  @ApiResponse({
    status: 200,
    description: 'Dependencies health data',
  })
  async getDependenciesHealth(): Promise<any> {
    try {
      const healthStatus = await this.healthCheckService.getHealthStatus();
      
      // Filter for dependency-related checks
      const dependencyChecks = healthStatus.checks.filter(check => 
        ['redis', 'shopify_api', 'dependencies'].includes(check.name)
      );

      const dependencies = dependencyChecks.map(check => ({
        name: check.name,
        status: check.status,
        responseTime: check.responseTime,
        message: check.message,
        details: check.details,
        available: check.status === 'pass',
      }));

      return {
        status: 'success',
        data: {
          summary: {
            total: dependencies.length,
            available: dependencies.filter(d => d.available).length,
            unavailable: dependencies.filter(d => !d.available).length,
          },
          dependencies,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get dependencies health:', error);
      throw error;
    }
  }
}
