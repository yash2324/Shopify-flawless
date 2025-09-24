import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { ShopifyService } from '../shopify/shopify.service';
import { DataAggregationService } from './data-aggregation.service';
import { SalesAnalyticsService } from './sales-analytics.service';
import { CustomerAnalyticsService } from './customer-analytics.service';
import { InventoryAnalyticsService } from './inventory-analytics.service';
import { PerformanceAnalyticsService } from './performance-analytics.service';
import {
  DashboardSummary,
  ShopifyOrder,
  ShopifyProduct,
  ShopifyCustomer,
} from '@interfaces/shopify.interface';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly cacheKeys: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly shopifyService: ShopifyService,
    private readonly dataAggregationService: DataAggregationService,
    private readonly salesAnalyticsService: SalesAnalyticsService,
    private readonly customerAnalyticsService: CustomerAnalyticsService,
    private readonly inventoryAnalyticsService: InventoryAnalyticsService,
    private readonly performanceAnalyticsService: PerformanceAnalyticsService,
  ) {
    this.cacheKeys = this.redisService.getCacheKeys();
  }

  /**
   * Main sync process - fetch data from Shopify and update cache
   */
  async syncShopifyData(): Promise<void> {
    this.logger.log('Starting Shopify data synchronization');

    try {
      // Update last sync timestamp
      await this.redisService.set(this.cacheKeys.shopify.lastSync, new Date().toISOString());

      // Fetch data from Shopify in parallel for better performance
      const [orders, products, customers] = await Promise.all([
        this.shopifyService.fetchRecentOrders(24), // Last 24 hours
        this.shopifyService.fetchAllProducts(),
        this.shopifyService.fetchAllCustomers(),
      ]);

      this.logger.log(`Fetched ${orders.length} orders, ${products.length} products, ${customers.length} customers`);

      // Process and cache the data
      await this.processAndCacheData(orders, products, customers);

      this.logger.log('Shopify data synchronization completed successfully');
    } catch (error) {
      this.logger.error('Error during Shopify data synchronization:', error);
      throw error;
    }
  }

  /**
   * Process fetched data and update all relevant caches
   */
  private async processAndCacheData(
    orders: ShopifyOrder[],
    products: ShopifyProduct[],
    customers: ShopifyCustomer[],
  ): Promise<void> {
    try {
      // Process data in parallel for better performance
      const [
        dashboardSummary,
        salesAnalytics,
        customerAnalytics,
        inventoryAnalytics,
        performanceAnalytics,
      ] = await Promise.all([
        this.dataAggregationService.aggregateDashboardData(orders, products, customers),
        this.salesAnalyticsService.processSalesData(orders),
        this.customerAnalyticsService.processCustomerData(customers, orders),
        this.inventoryAnalyticsService.processInventoryData(products, orders),
        this.performanceAnalyticsService.processPerformanceData(orders, customers),
      ]);

      // Cache all processed data
      const cachePromises = [
        this.redisService.set(this.cacheKeys.dashboard.summary, dashboardSummary, { ttl: 60 }),
        this.redisService.set(this.cacheKeys.dashboard.salesData, salesAnalytics, { ttl: 300 }),
        this.redisService.set(this.cacheKeys.dashboard.customerData, customerAnalytics, { ttl: 300 }),
        this.redisService.set(this.cacheKeys.dashboard.inventoryData, inventoryAnalytics, { ttl: 300 }),
        this.redisService.set(this.cacheKeys.dashboard.orderData, performanceAnalytics, { ttl: 300 }),
        
        // Cache raw data for further analysis
        this.redisService.set(`${this.cacheKeys.shopify.orders(1)}:latest`, orders.slice(0, 100), { ttl: 600 }),
        this.redisService.set(`${this.cacheKeys.shopify.products(1)}:latest`, products.slice(0, 100), { ttl: 1200 }),
        this.redisService.set(`${this.cacheKeys.shopify.customers(1)}:latest`, customers.slice(0, 100), { ttl: 1200 }),
      ];

      await Promise.all(cachePromises);

      this.logger.log('All data processed and cached successfully');
    } catch (error) {
      this.logger.error('Error processing and caching data:', error);
      throw error;
    }
  }

  /**
   * Get quick dashboard summary with minimal data fetching
   */
  async getQuickSummary(): Promise<any> {
    const cacheKey = this.cacheKeys.dashboard.summary + ':quick';
    
    try {
      // Check cache first (2-minute TTL for quick data)
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        this.logger.debug('Returning cached quick summary');
        return cached;
      }

      this.logger.log('Generating quick dashboard summary');

      // Fetch minimal recent data (last 24 hours, max 100 orders)
      const recentOrders = await this.shopifyService.fetchLimitedOrders(
        { createdAtMin: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
        100
      );

      const quickSummary = {
        totalOrders: recentOrders.length,
        totalSales: recentOrders.reduce((sum, order) => 
          sum + parseFloat(order.totalPriceSet?.shopMoney?.amount || '0'), 0),
        averageOrderValue: recentOrders.length > 0 
          ? recentOrders.reduce((sum, order) => 
              sum + parseFloat(order.totalPriceSet?.shopMoney?.amount || '0'), 0) / recentOrders.length 
          : 0,
        period: 'Last 24 hours',
        dataPoints: recentOrders.length,
        lastUpdated: new Date().toISOString(),
        type: 'quick'
      };

      // Cache for 2 minutes
      await this.redisService.set(cacheKey, quickSummary, { ttl: 120 });

      return quickSummary;
    } catch (error) {
      this.logger.error('Error generating quick summary:', error);
      throw error;
    }
  }

  /**
   * Get dashboard summary from cache or generate fresh
   */
  async getDashboardSummary(forceRefresh: boolean = false): Promise<DashboardSummary> {
    try {
      if (!forceRefresh) {
        const cached = await this.redisService.get<DashboardSummary>(this.cacheKeys.dashboard.summary);
        if (cached) {
          this.logger.debug('Dashboard summary served from cache');
          return cached;
        }
      }

      this.logger.log('Generating fresh dashboard summary');
      
      // Fetch fresh data and process
      const [orders, products, customers] = await Promise.all([
        this.shopifyService.fetchRecentOrders(24),
        this.shopifyService.fetchAllProducts(),
        this.shopifyService.fetchAllCustomers(),
      ]);

      const summary = await this.dataAggregationService.aggregateDashboardData(orders, products, customers);
      
      // Cache the result
      await this.redisService.set(this.cacheKeys.dashboard.summary, summary, { ttl: 60 });
      
      return summary;
    } catch (error) {
      this.logger.error('Error getting dashboard summary:', error);
      throw error;
    }
  }

  /**
   * Get sales analytics data
   */
  async getSalesAnalytics(forceRefresh: boolean = false): Promise<any> {
    try {
      if (!forceRefresh) {
        const cached = await this.redisService.get(this.cacheKeys.dashboard.salesData);
        if (cached) {
          this.logger.debug('Sales analytics served from cache');
          return cached;
        }
      }

      this.logger.log('Generating fresh sales analytics');
      
      const orders = await this.shopifyService.fetchRecentOrders(168); // Last 7 days
      const analytics = await this.salesAnalyticsService.processSalesData(orders);
      
      await this.redisService.set(this.cacheKeys.dashboard.salesData, analytics, { ttl: 300 });
      
      return analytics;
    } catch (error) {
      this.logger.error('Error getting sales analytics:', error);
      throw error;
    }
  }

  /**
   * Get customer analytics data (FAST VERSION)
   */
  async getCustomerAnalytics(forceRefresh: boolean = false): Promise<any> {
    try {
      if (!forceRefresh) {
        const cached = await this.redisService.get(this.cacheKeys.dashboard.customerData);
        if (cached) {
          this.logger.debug('Customer analytics served from cache');
          return cached;
        }
      }

      this.logger.log('Generating fresh customer analytics (FAST MODE)');
      
      // EMERGENCY: Drastically reduced data fetching for speed
      const [customers, orders] = await Promise.all([
        this.shopifyService.fetchLimitedCustomers(100), // Max 100 customers
        this.shopifyService.fetchLimitedOrders(
          { createdAtMin: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }, // Last 24 hours only
          100 // Max 100 orders
        ),
      ]);

      const analytics = await this.customerAnalyticsService.processCustomerData(customers, orders);
      
      await this.redisService.set(this.cacheKeys.dashboard.customerData, analytics, { ttl: 300 });
      
      return analytics;
    } catch (error) {
      this.logger.error('Error getting customer analytics:', error);
      throw error;
    }
  }

  /**
   * Get inventory analytics data (FAST VERSION)
   */
  async getInventoryAnalytics(forceRefresh: boolean = false): Promise<any> {
    try {
      if (!forceRefresh) {
        const cached = await this.redisService.get(this.cacheKeys.dashboard.inventoryData);
        if (cached) {
          this.logger.debug('Inventory analytics served from cache');
          return cached;
        }
      }

      this.logger.log('Generating fresh inventory analytics (FAST MODE)');
      
      // EMERGENCY: Drastically reduced data fetching for speed
      const [products, orders] = await Promise.all([
        this.shopifyService.fetchLimitedProducts(200), // Max 200 products
        this.shopifyService.fetchLimitedOrders(
          { createdAtMin: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }, // Last 7 days only
          150 // Max 150 orders
        ),
      ]);

      const analytics = await this.inventoryAnalyticsService.processInventoryDataFast(products, orders);
      
      await this.redisService.set(this.cacheKeys.dashboard.inventoryData, analytics, { ttl: 300 });
      
      return analytics;
    } catch (error) {
      this.logger.error('Error getting inventory analytics:', error);
      throw error;
    }
  }

  /**
   * Get performance analytics data
   */
  async getPerformanceAnalytics(forceRefresh: boolean = false): Promise<any> {
    try {
      if (!forceRefresh) {
        const cached = await this.redisService.get(this.cacheKeys.dashboard.orderData);
        if (cached) {
          this.logger.debug('Performance analytics served from cache');
          return cached;
        }
      }

      this.logger.log('Generating fresh performance analytics');
      
      const [orders, customers] = await Promise.all([
        this.shopifyService.fetchRecentOrders(720), // Last 30 days
        this.shopifyService.fetchAllCustomers(),
      ]);

      const analytics = await this.performanceAnalyticsService.processPerformanceData(orders, customers);
      
      await this.redisService.set(this.cacheKeys.dashboard.orderData, analytics, { ttl: 300 });
      
      return analytics;
    } catch (error) {
      this.logger.error('Error getting performance analytics:', error);
      throw error;
    }
  }

  /**
   * Get specific date range analytics
   */
  async getDateRangeAnalytics(startDate: Date, endDate: Date): Promise<any> {
    try {
      const cacheKey = `analytics:date_range:${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`;
      
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        this.logger.debug('Date range analytics served from cache');
        return cached;
      }

      this.logger.log(`Generating analytics for date range (FAST MODE): ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      // EMERGENCY: Limit data fetching for date ranges to prevent timeouts
      const daysDifference = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      let maxOrders = 500; // Default limit
      
      // Adjust limits based on date range size
      if (daysDifference <= 7) maxOrders = 200;        // 1 week
      else if (daysDifference <= 30) maxOrders = 500;  // 1 month  
      else if (daysDifference <= 90) maxOrders = 800;  // 3 months
      else maxOrders = 1000; // Longer periods
      
      this.logger.log(`Fetching max ${maxOrders} orders for ${daysDifference} day range`);
      
      const orders = await this.shopifyService.fetchLimitedOrdersByDateRange(startDate, endDate, maxOrders);
      
      // Calculate simplified analytics for the period
      const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.totalPriceSet?.shopMoney?.amount || '0'), 0);
      const totalOrders = orders.length;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const uniqueCustomers = new Set(orders.map(order => order.customer?.id).filter(id => id)).size;
      
      // Group by month for trends
      const monthlyData = new Map<string, { revenue: number, orders: number, customers: Set<string> }>();
      orders.forEach(order => {
        const month = new Date(order.createdAt).toISOString().substring(0, 7); // YYYY-MM
        if (!monthlyData.has(month)) {
          monthlyData.set(month, { revenue: 0, orders: 0, customers: new Set() });
        }
        const data = monthlyData.get(month)!;
        data.revenue += parseFloat(order.totalPriceSet?.shopMoney?.amount || '0');
        data.orders += 1;
        if (order.customer?.id) data.customers.add(order.customer.id);
      });
      
      const monthlyBreakdown = Array.from(monthlyData.entries()).map(([month, data]) => ({
        month,
        revenue: Math.round(data.revenue * 100) / 100,
        orders: data.orders,
        customers: data.customers.size,
        averageOrderValue: data.orders > 0 ? Math.round((data.revenue / data.orders) * 100) / 100 : 0,
      }));
      
      const analytics = {
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          daysCovered: daysDifference,
        },
        summary: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalOrders,
          uniqueCustomers,
          averageOrderValue: Math.round(averageOrderValue * 100) / 100,
          ordersAnalyzed: orders.length,
        },
        monthlyBreakdown,
        meta: {
          mode: 'fast',
          dataLimited: orders.length === maxOrders,
          maxOrdersRequested: maxOrders,
        },
      };
      
      // Cache for longer since historical data doesn't change
      await this.redisService.set(cacheKey, analytics, { ttl: 3600 });
      
      return analytics;
    } catch (error) {
      this.logger.error('Error getting date range analytics:', error);
      throw error;
    }
  }

  /**
   * Get real-time metrics (no cache)
   */
  async getRealTimeMetrics(): Promise<any> {
    try {
      this.logger.log('Generating real-time metrics');
      
      const [
        todayOrders,
        yesterdayOrders,
        stockLevels,
        outstandingOrders,
      ] = await Promise.all([
        this.shopifyService.getDailySalesData(),
        this.shopifyService.getDailySalesData(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
        this.shopifyService.getStockLevels(),
        this.shopifyService.getOutstandingOrders(),
      ]);

      const todaySales = todayOrders.reduce((sum, order) => 
        sum + parseFloat(order.totalPriceSet?.shopMoney?.amount || '0'), 0);
      
      const yesterdaySales = yesterdayOrders.reduce((sum, order) => 
        sum + parseFloat(order.totalPriceSet?.shopMoney?.amount || '0'), 0);

      const salesGrowth = yesterdaySales > 0 ? 
        ((todaySales - yesterdaySales) / yesterdaySales) * 100 : 0;

      // Count low stock items
      const lowStockCount = stockLevels.reduce((count, product) => {
        const lowStockVariants = product.variants?.edges?.filter(edge => 
          (edge.node.inventoryQuantity || 0) <= 10 && edge.node.inventoryItem?.tracked
        ).length || 0;
        return count + lowStockVariants;
      }, 0);

      return {
        timestamp: new Date().toISOString(),
        todaySales,
        todayOrders: todayOrders.length,
        salesGrowth,
        lowStockAlerts: lowStockCount,
        outstandingOrders: outstandingOrders.length,
        lastSyncTime: await this.redisService.get(this.cacheKeys.shopify.lastSync),
      };
    } catch (error) {
      this.logger.error('Error getting real-time metrics:', error);
      throw error;
    }
  }

  /**
   * Clear all analytics cache
   */
  async clearCache(): Promise<void> {
    try {
      const keysToDelete = [
        this.cacheKeys.dashboard.summary,
        this.cacheKeys.dashboard.salesData,
        this.cacheKeys.dashboard.customerData,
        this.cacheKeys.dashboard.inventoryData,
        this.cacheKeys.dashboard.orderData,
      ];

      await Promise.all(keysToDelete.map(key => this.redisService.del(key)));
      
      this.logger.log('Analytics cache cleared successfully');
    } catch (error) {
      this.logger.error('Error clearing analytics cache:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<any> {
    try {
      const keys = this.cacheKeys.dashboard;
      const stats = await Promise.all([
        this.redisService.exists(keys.summary),
        this.redisService.exists(keys.salesData),
        this.redisService.exists(keys.customerData),
        this.redisService.exists(keys.inventoryData),
        this.redisService.exists(keys.orderData),
      ]);

      return {
        summary: stats[0],
        salesData: stats[1],
        customerData: stats[2],
        inventoryData: stats[3],
        orderData: stats[4],
        lastSync: await this.redisService.get(this.cacheKeys.shopify.lastSync),
      };
    } catch (error) {
      this.logger.error('Error getting cache stats:', error);
      return null;
    }
  }
}
