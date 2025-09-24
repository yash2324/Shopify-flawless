import {
  Controller,
  Get,
  Post,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  Logger,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AnalyticsService } from '../../analytics/analytics.service';
import { RedisService } from '../../redis/redis.service';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(ThrottlerGuard)
@UseInterceptors(CacheInterceptor)
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Get quick dashboard summary (optimized for speed)
   */
  @Get('quick')
  @ApiOperation({
    summary: 'Get quick dashboard overview',
    description: 'Returns essential dashboard metrics with minimal data fetching for fast response',
  })
  @ApiResponse({
    status: 200,
    description: 'Quick dashboard data',
  })
  async getQuickDashboard(): Promise<any> {
    try {
      this.logger.log('Quick dashboard requested');
      
      // Fetch only last 24 hours for speed
      const summary = await this.analyticsService.getQuickSummary();
      
      return {
        status: 'success',
        data: summary,
        timestamp: new Date().toISOString(),
        meta: {
          type: 'quick',
          cacheable: true,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get quick dashboard:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive dashboard summary
   */
  @Get('summary')
  @ApiOperation({
    summary: 'Get dashboard summary',
    description: 'Returns comprehensive dashboard data including sales, customers, and inventory metrics',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard summary data',
    schema: {
      type: 'object',
      properties: {
        totalSales: { type: 'number' },
        totalOrders: { type: 'number' },
        totalCustomers: { type: 'number' },
        averageOrderValue: { type: 'number' },
        conversionRate: { type: 'number' },
        topSellingProducts: { type: 'array' },
        recentOrders: { type: 'array' },
        lowStockProducts: { type: 'array' },
        salesTrend: { type: 'array' },
        customerMetrics: { type: 'object' },
        inventoryMetrics: { type: 'object' },
        lastUpdated: { type: 'string' },
      },
    },
  })
  @ApiQuery({
    name: 'refresh',
    required: false,
    type: 'boolean',
    description: 'Force refresh data from source',
  })
  async getDashboardSummary(@Query('refresh') refresh?: boolean): Promise<any> {
    try {
      this.logger.log(`Dashboard summary requested (refresh: ${refresh})`);
      
      const summary = await this.analyticsService.getDashboardSummary(refresh === true);
      
      return {
        status: 'success',
        data: summary,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get dashboard summary:', error);
      throw error;
    }
  }

  /**
   * Get real-time metrics
   */
  @Get('realtime')
  @ApiOperation({
    summary: 'Get real-time metrics',
    description: 'Returns real-time metrics for the dashboard without caching',
  })
  @ApiResponse({
    status: 200,
    description: 'Real-time metrics data',
  })
  async getRealtimeMetrics(): Promise<any> {
    try {
      this.logger.log('Real-time metrics requested');
      
      const metrics = await this.analyticsService.getRealTimeMetrics();
      
      return {
        status: 'success',
        data: metrics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get real-time metrics:', error);
      throw error;
    }
  }

  /**
   * Get sales analytics
   */
  @Get('sales')
  @ApiOperation({
    summary: 'Get sales analytics',
    description: 'Returns detailed sales analytics including trends, targets, and performance',
  })
  @ApiResponse({
    status: 200,
    description: 'Sales analytics data',
  })
  @ApiQuery({
    name: 'refresh',
    required: false,
    type: 'boolean',
    description: 'Force refresh data from source',
  })
  async getSalesAnalytics(@Query('refresh') refresh?: boolean): Promise<any> {
    try {
      this.logger.log(`Sales analytics requested (refresh: ${refresh})`);
      
      const analytics = await this.analyticsService.getSalesAnalytics(refresh === true);
      
      return {
        status: 'success',
        data: analytics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get sales analytics:', error);
      throw error;
    }
  }

  /**
   * Get customer analytics
   */
  @Get('customers')
  @ApiOperation({
    summary: 'Get customer analytics',
    description: 'Returns customer segmentation, profitability, and behavior analytics',
  })
  @ApiResponse({
    status: 200,
    description: 'Customer analytics data',
  })
  @ApiQuery({
    name: 'refresh',
    required: false,
    type: 'boolean',
    description: 'Force refresh data from source',
  })
  async getCustomerAnalytics(@Query('refresh') refresh?: boolean): Promise<any> {
    try {
      this.logger.log(`Customer analytics requested (refresh: ${refresh})`);
      
      const analytics = await this.analyticsService.getCustomerAnalytics(refresh === true);
      
      return {
        status: 'success',
        data: analytics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get customer analytics:', error);
      throw error;
    }
  }

  /**
   * Get inventory analytics
   */
  @Get('inventory')
  @ApiOperation({
    summary: 'Get inventory analytics',
    description: 'Returns inventory levels, turnover analysis, and stock alerts',
  })
  @ApiResponse({
    status: 200,
    description: 'Inventory analytics data',
  })
  @ApiQuery({
    name: 'refresh',
    required: false,
    type: 'boolean',
    description: 'Force refresh data from source',
  })
  async getInventoryAnalytics(@Query('refresh') refresh?: boolean): Promise<any> {
    try {
      this.logger.log(`Inventory analytics requested (refresh: ${refresh})`);
      
      const analytics = await this.analyticsService.getInventoryAnalytics(refresh === true);
      
      return {
        status: 'success',
        data: analytics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get inventory analytics:', error);
      throw error;
    }
  }

  /**
   * Get performance analytics
   */
  @Get('performance')
  @ApiOperation({
    summary: 'Get performance analytics',
    description: 'Returns order fulfillment, processing times, and operational metrics',
  })
  @ApiResponse({
    status: 200,
    description: 'Performance analytics data',
  })
  @ApiQuery({
    name: 'refresh',
    required: false,
    type: 'boolean',
    description: 'Force refresh data from source',
  })
  async getPerformanceAnalytics(@Query('refresh') refresh?: boolean): Promise<any> {
    try {
      this.logger.log(`Performance analytics requested (refresh: ${refresh})`);
      
      const analytics = await this.analyticsService.getPerformanceAnalytics(refresh === true);
      
      return {
        status: 'success',
        data: analytics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get performance analytics:', error);
      throw error;
    }
  }

  /**
   * Get date range analytics
   */
  @Get('date-range')
  @ApiOperation({
    summary: 'Get analytics for specific date range',
    description: 'Returns analytics data for a specified date range',
  })
  @ApiResponse({
    status: 200,
    description: 'Date range analytics data',
  })
  @ApiQuery({
    name: 'startDate',
    required: true,
    type: 'string',
    description: 'Start date in YYYY-MM-DD format',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    type: 'string',
    description: 'End date in YYYY-MM-DD format',
  })
  async getDateRangeAnalytics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<any> {
    try {
      // Validate date format
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);

      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        throw new BadRequestException('Invalid date format. Use YYYY-MM-DD format.');
      }

      if (startDateObj > endDateObj) {
        throw new BadRequestException('Start date must be before end date.');
      }

      // Limit range to 1 year
      const daysDifference = (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDifference > 365) {
        throw new BadRequestException('Date range cannot exceed 365 days.');
      }

      this.logger.log(`Date range analytics requested: ${startDate} to ${endDate}`);
      
      const analytics = await this.analyticsService.getDateRangeAnalytics(startDateObj, endDateObj);
      
      return {
        status: 'success',
        data: analytics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get date range analytics:', error);
      throw error;
    }
  }

  /**
   * Get alerts and notifications
   */
  @Get('alerts')
  @ApiOperation({
    summary: 'Get current alerts',
    description: 'Returns current system alerts including inventory, performance, and business alerts',
  })
  @ApiResponse({
    status: 200,
    description: 'Current alerts data',
  })
  async getAlerts(): Promise<any> {
    try {
      this.logger.log('Alerts requested');
      
      const [inventoryAlerts, performanceAlerts, systemAlerts] = await Promise.all([
        this.redisService.get('alerts:inventory'),
        this.redisService.get('alerts:performance'),
        this.redisService.get('alerts:system'),
      ]);

      const inventoryAlertsArray = (inventoryAlerts as any[]) || [];
      const performanceAlertsArray = (performanceAlerts as any[]) || [];
      const systemAlertsArray = (systemAlerts as any[]) || [];

      const allAlerts = [
        ...inventoryAlertsArray,
        ...performanceAlertsArray,
        ...systemAlertsArray,
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return {
        status: 'success',
        data: {
          total: allAlerts.length,
          alerts: allAlerts,
          byType: {
            inventory: inventoryAlertsArray.length,
            performance: performanceAlertsArray.length,
            system: systemAlertsArray.length,
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get alerts:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  @Get('cache-stats')
  @ApiOperation({
    summary: 'Get cache statistics',
    description: 'Returns cache hit rates, data freshness, and cache health metrics',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache statistics data',
  })
  async getCacheStats(): Promise<any> {
    try {
      this.logger.log('Cache stats requested');
      
      const cacheStats = await this.analyticsService.getCacheStats();
      
      return {
        status: 'success',
        data: cacheStats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats:', error);
      throw error;
    }
  }

  /**
   * Refresh all dashboard data
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh all dashboard data',
    description: 'Triggers a manual refresh of all dashboard data from Shopify',
  })
  @ApiResponse({
    status: 200,
    description: 'Data refresh initiated successfully',
  })
  async refreshDashboardData(): Promise<any> {
    try {
      this.logger.log('Manual dashboard refresh requested');
      
      // Clear existing cache
      await this.analyticsService.clearCache();
      
      // Trigger fresh data fetch
      const [summary, sales, customers, inventory, performance] = await Promise.all([
        this.analyticsService.getDashboardSummary(true),
        this.analyticsService.getSalesAnalytics(true),
        this.analyticsService.getCustomerAnalytics(true),
        this.analyticsService.getInventoryAnalytics(true),
        this.analyticsService.getPerformanceAnalytics(true),
      ]);

      return {
        status: 'success',
        message: 'Dashboard data refreshed successfully',
        data: {
          summary: !!summary,
          sales: !!sales,
          customers: !!customers,
          inventory: !!inventory,
          performance: !!performance,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to refresh dashboard data:', error);
      throw error;
    }
  }

  /**
   * Clear dashboard cache
   */
  @Post('clear-cache')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clear dashboard cache',
    description: 'Clears all cached dashboard data, forcing fresh data on next request',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache cleared successfully',
  })
  async clearCache(): Promise<any> {
    try {
      this.logger.log('Cache clear requested');
      
      await this.analyticsService.clearCache();
      
      return {
        status: 'success',
        message: 'Dashboard cache cleared successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to clear cache:', error);
      throw error;
    }
  }
}
