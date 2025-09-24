import { Injectable, Logger } from '@nestjs/common';
import * as moment from 'moment';
import * as _ from 'lodash';
import {
  ShopifyOrder,
  ShopifyCustomer,
  OrderFulfillmentStatus,
  FulfillmentLineItem,
} from '@interfaces/shopify.interface';

@Injectable()
export class PerformanceAnalyticsService {
  private readonly logger = new Logger(PerformanceAnalyticsService.name);

  /**
   * Process performance data and generate comprehensive analytics
   */
  async processPerformanceData(orders: ShopifyOrder[], customers: ShopifyCustomer[]): Promise<any> {
    this.logger.log('Processing performance analytics data');

    try {
      const [
        orderFulfillmentMetrics,
        shippingPerformance,
        orderProcessingMetrics,
        paymentAnalytics,
        operationalEfficiency,
        kpiMetrics,
        trendAnalysis,
      ] = await Promise.all([
        this.calculateOrderFulfillmentMetrics(orders),
        this.calculateShippingPerformance(orders),
        this.calculateOrderProcessingMetrics(orders),
        this.calculatePaymentAnalytics(orders),
        this.calculateOperationalEfficiency(orders, customers),
        this.calculateKPIMetrics(orders, customers),
        this.calculateTrendAnalysis(orders),
      ]);

      return {
        orderFulfillmentMetrics,
        shippingPerformance,
        orderProcessingMetrics,
        paymentAnalytics,
        operationalEfficiency,
        kpiMetrics,
        trendAnalysis,
        summary: {
          totalOrders: orders.length,
          averageOrderValue: this.calculateAverageOrderValue(orders),
          fulfillmentRate: this.calculateFulfillmentRate(orders),
          averageProcessingTime: orderProcessingMetrics.averageProcessingTime,
        },
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error processing performance data:', error);
      throw error;
    }
  }

  /**
   * Calculate order fulfillment metrics
   */
  private async calculateOrderFulfillmentMetrics(orders: ShopifyOrder[]) {
    const fulfillmentData = {
      unfulfilled: 0,
      partiallyFulfilled: 0,
      fulfilled: 0,
      cancelled: 0,
      total: orders.length,
    };

    const fulfillmentTimes: number[] = [];
    const ordersByStatus: OrderFulfillmentStatus[] = [];

    orders.forEach(order => {
      const status = order.displayFulfillmentStatus || 'unfulfilled';
      
      // Count by status
      switch (status.toLowerCase()) {
        case 'unfulfilled':
        case 'pending':
          fulfillmentData.unfulfilled++;
          break;
        case 'partial':
        case 'partially_fulfilled':
          fulfillmentData.partiallyFulfilled++;
          break;
        case 'fulfilled':
        case 'shipped':
          fulfillmentData.fulfilled++;
          break;
        case 'cancelled':
          fulfillmentData.cancelled++;
          break;
        default:
          fulfillmentData.unfulfilled++;
      }

      // Calculate fulfillment time for fulfilled orders
      if (status.toLowerCase() === 'fulfilled' && order.fulfillments && order.fulfillments.length > 0) {
        const orderDate = moment(order.createdAt);
        const fulfillmentDate = moment(order.fulfillments[0].createdAt);
        const hoursToFulfill = fulfillmentDate.diff(orderDate, 'hours');
        fulfillmentTimes.push(hoursToFulfill);
      }

      // Create detailed order status
      const lineItems: FulfillmentLineItem[] = order.lineItems?.edges?.map(edge => ({
        lineItemId: edge.node.id,
        title: edge.node.title,
        sku: edge.node.sku || 'N/A',
        quantity: edge.node.quantity || 0,
        fulfilledQuantity: 0, // Would need fulfillment data
        remainingQuantity: edge.node.quantity || 0,
        status: status.toLowerCase() === 'fulfilled' ? 'fulfilled' : 'pending',
      })) || [];

      ordersByStatus.push({
        orderId: order.id,
        orderName: order.name,
        customerName: order.customer?.displayName || 'Guest',
        createdAt: order.createdAt,
        status: status.toLowerCase() as any,
        lineItems,
        estimatedShipDate: this.calculateEstimatedShipDate(order.createdAt),
        actualShipDate: status.toLowerCase() === 'fulfilled' ? 
          order.fulfillments?.[0]?.createdAt : undefined,
        trackingNumbers: order.fulfillments?.flatMap(f => 
          f.trackingInfo?.map(t => t.number).filter(Boolean) || []
        ) || [],
        fulfillmentLocation: 'Main Warehouse', // Would be dynamic in real scenario
      });
    });

    const averageFulfillmentTime = fulfillmentTimes.length > 0 ? 
      _.mean(fulfillmentTimes) : 0;

    return {
      statusBreakdown: {
        unfulfilled: fulfillmentData.unfulfilled,
        partiallyFulfilled: fulfillmentData.partiallyFulfilled,
        fulfilled: fulfillmentData.fulfilled,
        cancelled: fulfillmentData.cancelled,
        total: fulfillmentData.total,
      },
      fulfillmentRate: fulfillmentData.total > 0 ? 
        (fulfillmentData.fulfilled / fulfillmentData.total) * 100 : 0,
      averageFulfillmentTime: Math.round(averageFulfillmentTime * 100) / 100,
      fulfillmentTimeDistribution: this.calculateTimeDistribution(fulfillmentTimes),
      ordersByStatus: ordersByStatus.slice(0, 50), // Recent 50 orders
    };
  }

  /**
   * Calculate shipping performance metrics
   */
  private async calculateShippingPerformance(orders: ShopifyOrder[]) {
    const shippingData = {
      withTracking: 0,
      withoutTracking: 0,
      delivered: 0,
      inTransit: 0,
      total: 0,
    };

    const shippingTimes: number[] = [];
    const shippingCosts: number[] = [];

    orders
      .filter(order => order.displayFulfillmentStatus === 'fulfilled')
      .forEach(order => {
        shippingData.total++;

        // Check for tracking information
        const hasTracking = order.fulfillments?.some(f => 
          f.trackingInfo && f.trackingInfo.length > 0
        ) || false;

        if (hasTracking) {
          shippingData.withTracking++;
        } else {
          shippingData.withoutTracking++;
        }

        // Calculate shipping cost (from order total shipping price)
        const shippingCost = parseFloat(order.totalShippingPriceSet?.shopMoney?.amount || '0');
        if (shippingCost > 0) {
          shippingCosts.push(shippingCost);
        }

        // Estimate shipping time (simplified)
        if (order.fulfillments && order.fulfillments.length > 0) {
          const fulfillmentDate = moment(order.fulfillments[0].createdAt);
          const estimatedDelivery = fulfillmentDate.clone().add(3, 'days'); // Assume 3 day delivery
          const shippingTime = estimatedDelivery.diff(fulfillmentDate, 'hours');
          shippingTimes.push(shippingTime);
        }
      });

    const averageShippingCost = shippingCosts.length > 0 ? _.mean(shippingCosts) : 0;
    const averageShippingTime = shippingTimes.length > 0 ? _.mean(shippingTimes) : 0;

    return {
      trackingCoverage: shippingData.total > 0 ? 
        (shippingData.withTracking / shippingData.total) * 100 : 0,
      averageShippingCost: Math.round(averageShippingCost * 100) / 100,
      averageShippingTime: Math.round(averageShippingTime * 100) / 100, // in hours
      shippingBreakdown: shippingData,
      shippingCostDistribution: this.calculateCostDistribution(shippingCosts),
    };
  }

  /**
   * Calculate order processing metrics
   */
  private async calculateOrderProcessingMetrics(orders: ShopifyOrder[]) {
    const processingTimes: number[] = [];
    const ordersByHour = new Array(24).fill(0);
    const ordersByDay = new Array(7).fill(0);
    
    orders.forEach(order => {
      // Calculate processing time (order created to processed)
      const orderDate = moment(order.createdAt);
      const processedDate = moment(order.processedAt || order.createdAt);
      const processingHours = processedDate.diff(orderDate, 'hours');
      processingTimes.push(processingHours);

      // Track order patterns
      ordersByHour[orderDate.hour()]++;
      ordersByDay[orderDate.day()]++;
    });

    const averageProcessingTime = processingTimes.length > 0 ? _.mean(processingTimes) : 0;
    const medianProcessingTime = processingTimes.length > 0 ? 
      this.calculateMedian(processingTimes) : 0;

    // Find peak hours and days
    const peakHour = ordersByHour.indexOf(Math.max(...ordersByHour));
    const peakDay = ordersByDay.indexOf(Math.max(...ordersByDay));
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return {
      averageProcessingTime: Math.round(averageProcessingTime * 100) / 100,
      medianProcessingTime: Math.round(medianProcessingTime * 100) / 100,
      processingTimeDistribution: this.calculateTimeDistribution(processingTimes),
      peakOrderHour: peakHour,
      peakOrderDay: dayNames[peakDay],
      hourlyOrderPattern: ordersByHour.map((count, hour) => ({ hour, count })),
      dailyOrderPattern: ordersByDay.map((count, day) => ({ 
        day: dayNames[day], 
        count 
      })),
    };
  }

  /**
   * Calculate payment analytics
   */
  private async calculatePaymentAnalytics(orders: ShopifyOrder[]) {
    const paymentData = {
      paid: 0,
      pending: 0,
      partially_paid: 0,
      refunded: 0,
      voided: 0,
      total: orders.length,
    };

    const paymentAmounts: number[] = [];
    const refundAmounts: number[] = [];

    orders.forEach(order => {
      const financialStatus = order.displayFinancialStatus || 'pending';
      const orderAmount = parseFloat(order.totalPriceSet?.shopMoney?.amount || '0');
      
      // Count by financial status
      if (paymentData.hasOwnProperty(financialStatus)) {
        paymentData[financialStatus as keyof typeof paymentData]++;
      }

      if (financialStatus === 'paid') {
        paymentAmounts.push(orderAmount);
      } else if (financialStatus === 'refunded') {
        refundAmounts.push(orderAmount);
      }
    });

    const totalPayments = paymentAmounts.reduce((sum, amount) => sum + amount, 0);
    const totalRefunds = refundAmounts.reduce((sum, amount) => sum + amount, 0);
    const averagePaymentAmount = paymentAmounts.length > 0 ? _.mean(paymentAmounts) : 0;

    return {
      statusBreakdown: paymentData,
      paymentSuccessRate: paymentData.total > 0 ? 
        (paymentData.paid / paymentData.total) * 100 : 0,
      refundRate: paymentData.total > 0 ? 
        (paymentData.refunded / paymentData.total) * 100 : 0,
      totalPayments: Math.round(totalPayments * 100) / 100,
      totalRefunds: Math.round(totalRefunds * 100) / 100,
      averagePaymentAmount: Math.round(averagePaymentAmount * 100) / 100,
      netRevenue: Math.round((totalPayments - totalRefunds) * 100) / 100,
    };
  }

  /**
   * Calculate operational efficiency metrics
   */
  private async calculateOperationalEfficiency(orders: ShopifyOrder[], customers: ShopifyCustomer[]) {
    const last30Days = moment().subtract(30, 'days');
    const recentOrders = orders.filter(order => moment(order.createdAt).isAfter(last30Days));
    
    // Order processing efficiency
    const totalOrders = orders.length;
    const fulfilledOrders = orders.filter(order => 
      order.displayFulfillmentStatus === 'fulfilled'
    ).length;

    // Customer service efficiency
    const totalCustomers = customers.length;
    const activeCustomers = this.countActiveCustomers(customers, orders);
    
    // Revenue per order
    const totalRevenue = orders.reduce((sum, order) => 
      sum + parseFloat(order.totalPriceSet?.shopMoney?.amount || '0'), 0);
    const revenuePerOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Order frequency
    const averageOrdersPerCustomer = totalCustomers > 0 ? totalOrders / totalCustomers : 0;

    return {
      orderFulfillmentEfficiency: totalOrders > 0 ? (fulfilledOrders / totalOrders) * 100 : 0,
      customerRetentionRate: this.calculateCustomerRetentionRate(customers),
      averageOrdersPerCustomer: Math.round(averageOrdersPerCustomer * 100) / 100,
      revenuePerOrder: Math.round(revenuePerOrder * 100) / 100,
      orderVelocity: recentOrders.length, // Orders in last 30 days
      customerLifetimeValue: this.calculateAverageCustomerLifetimeValue(customers),
      operationalScores: {
        efficiency: Math.round(((fulfilledOrders / totalOrders) * 0.4 + 
                              (activeCustomers / totalCustomers) * 0.3 + 
                              Math.min(averageOrdersPerCustomer / 5, 1) * 0.3) * 100),
        quality: Math.round((1 - (this.calculateRefundRate(orders) / 100)) * 100),
        speed: Math.round(Math.max(0, 100 - (this.calculateAverageProcessingTime(orders) / 24) * 10)),
      },
    };
  }

  /**
   * Calculate key performance indicators (KPIs)
   */
  private async calculateKPIMetrics(orders: ShopifyOrder[], customers: ShopifyCustomer[]) {
    const now = moment();
    const thisMonth = now.clone().startOf('month');
    const lastMonth = now.clone().subtract(1, 'month').startOf('month');
    const thisYear = now.clone().startOf('year');

    // Monthly metrics
    const thisMonthOrders = orders.filter(order => moment(order.createdAt).isAfter(thisMonth));
    const lastMonthOrders = orders.filter(order => {
      const orderDate = moment(order.createdAt);
      return orderDate.isAfter(lastMonth) && orderDate.isBefore(thisMonth);
    });

    // Revenue metrics
    const thisMonthRevenue = thisMonthOrders.reduce((sum, order) => 
      sum + parseFloat(order.totalPriceSet?.shopMoney?.amount || '0'), 0);
    const lastMonthRevenue = lastMonthOrders.reduce((sum, order) => 
      sum + parseFloat(order.totalPriceSet?.shopMoney?.amount || '0'), 0);

    // Growth calculations
    const revenueGrowth = lastMonthRevenue > 0 ? 
      ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;
    const orderGrowth = lastMonthOrders.length > 0 ? 
      ((thisMonthOrders.length - lastMonthOrders.length) / lastMonthOrders.length) * 100 : 0;

    // Year-to-date metrics
    const ytdOrders = orders.filter(order => moment(order.createdAt).isAfter(thisYear));
    const ytdRevenue = ytdOrders.reduce((sum, order) => 
      sum + parseFloat(order.totalPriceSet?.shopMoney?.amount || '0'), 0);

    return {
      monthlyMetrics: {
        revenue: Math.round(thisMonthRevenue * 100) / 100,
        orders: thisMonthOrders.length,
        averageOrderValue: thisMonthOrders.length > 0 ? 
          Math.round((thisMonthRevenue / thisMonthOrders.length) * 100) / 100 : 0,
        revenueGrowth: Math.round(revenueGrowth * 100) / 100,
        orderGrowth: Math.round(orderGrowth * 100) / 100,
      },
      yearToDateMetrics: {
        revenue: Math.round(ytdRevenue * 100) / 100,
        orders: ytdOrders.length,
        averageOrderValue: ytdOrders.length > 0 ? 
          Math.round((ytdRevenue / ytdOrders.length) * 100) / 100 : 0,
      },
      customerMetrics: {
        totalCustomers: customers.length,
        newCustomersThisMonth: this.countNewCustomers(customers, thisMonth),
        customerRetentionRate: this.calculateCustomerRetentionRate(customers),
        averageCustomerValue: this.calculateAverageCustomerLifetimeValue(customers),
      },
      performanceScores: {
        overall: this.calculateOverallPerformanceScore(orders, customers),
        sales: this.calculateSalesPerformanceScore(orders),
        operations: this.calculateOperationsPerformanceScore(orders),
        customer: this.calculateCustomerPerformanceScore(customers, orders),
      },
    };
  }

  /**
   * Calculate trend analysis
   */
  private async calculateTrendAnalysis(orders: ShopifyOrder[]) {
    const last12Months = moment().subtract(12, 'months');
    const monthlyData = new Map<string, {
      revenue: number;
      orders: number;
      customers: Set<string>;
    }>();

    // Initialize last 12 months
    for (let i = 0; i < 12; i++) {
      const month = moment().subtract(i, 'months').format('YYYY-MM');
      monthlyData.set(month, { revenue: 0, orders: 0, customers: new Set() });
    }

    // Aggregate data by month
    orders
      .filter(order => moment(order.createdAt).isAfter(last12Months))
      .forEach(order => {
        const month = moment(order.createdAt).format('YYYY-MM');
        const revenue = parseFloat(order.totalPriceSet?.shopMoney?.amount || '0');
        const customerId = order.customer?.id;

        if (monthlyData.has(month)) {
          const data = monthlyData.get(month)!;
          data.revenue += revenue;
          data.orders += 1;
          if (customerId) {
            data.customers.add(customerId);
          }
        }
      });

    // Calculate trends
    const monthlyTrends = Array.from(monthlyData.entries())
      .map(([month, data]) => ({
        month,
        revenue: Math.round(data.revenue * 100) / 100,
        orders: data.orders,
        customers: data.customers.size,
        averageOrderValue: data.orders > 0 ? 
          Math.round((data.revenue / data.orders) * 100) / 100 : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Calculate growth rates
    const trendsWithGrowth = monthlyTrends.map((current, index) => {
      if (index === 0) {
        return { ...current, revenueGrowth: 0, orderGrowth: 0 };
      }

      const previous = monthlyTrends[index - 1];
      const revenueGrowth = previous.revenue > 0 ? 
        ((current.revenue - previous.revenue) / previous.revenue) * 100 : 0;
      const orderGrowth = previous.orders > 0 ? 
        ((current.orders - previous.orders) / previous.orders) * 100 : 0;

      return {
        ...current,
        revenueGrowth: Math.round(revenueGrowth * 100) / 100,
        orderGrowth: Math.round(orderGrowth * 100) / 100,
      };
    });

    return {
      monthlyTrends: trendsWithGrowth,
      overallTrend: this.calculateOverallTrend(trendsWithGrowth),
      seasonalPatterns: this.calculateSeasonalPatterns(trendsWithGrowth),
      projections: this.calculateProjections(trendsWithGrowth),
    };
  }

  // Helper methods
  private calculateEstimatedShipDate(orderDate: string): string {
    return moment(orderDate).add(2, 'days').format('YYYY-MM-DD');
  }

  private calculateTimeDistribution(times: number[]) {
    if (times.length === 0) return {};

    const sorted = times.sort((a, b) => a - b);
    return {
      min: sorted[0] || 0,
      max: sorted[sorted.length - 1] || 0,
      median: this.calculateMedian(sorted),
      q1: this.calculatePercentile(sorted, 25),
      q3: this.calculatePercentile(sorted, 75),
    };
  }

  private calculateCostDistribution(costs: number[]) {
    if (costs.length === 0) return {};

    const sorted = costs.sort((a, b) => a - b);
    return {
      min: Math.round((sorted[0] || 0) * 100) / 100,
      max: Math.round((sorted[sorted.length - 1] || 0) * 100) / 100,
      average: Math.round(_.mean(costs) * 100) / 100,
      median: Math.round(this.calculateMedian(sorted) * 100) / 100,
    };
  }

  private calculateMedian(arr: number[]): number {
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  }

  private calculatePercentile(arr: number[], percentile: number): number {
    const index = (percentile / 100) * (arr.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    return upper >= arr.length ? arr[lower] : 
           arr[lower] * (1 - weight) + arr[upper] * weight;
  }

  private calculateAverageOrderValue(orders: ShopifyOrder[]): number {
    const totalRevenue = orders.reduce((sum, order) => 
      sum + parseFloat(order.totalPriceSet?.shopMoney?.amount || '0'), 0);
    return orders.length > 0 ? Math.round((totalRevenue / orders.length) * 100) / 100 : 0;
  }

  private calculateFulfillmentRate(orders: ShopifyOrder[]): number {
    const fulfilledOrders = orders.filter(order => 
      order.displayFulfillmentStatus === 'fulfilled'
    ).length;
    return orders.length > 0 ? Math.round((fulfilledOrders / orders.length) * 10000) / 100 : 0;
  }

  private countActiveCustomers(customers: ShopifyCustomer[], orders: ShopifyOrder[]): number {
    const last30Days = moment().subtract(30, 'days');
    const activeCustomerIds = new Set<string>();

    orders
      .filter(order => moment(order.createdAt).isAfter(last30Days))
      .forEach(order => {
        if (order.customer?.id) {
          activeCustomerIds.add(order.customer.id);
        }
      });

    return activeCustomerIds.size;
  }

  private calculateCustomerRetentionRate(customers: ShopifyCustomer[]): number {
    const returningCustomers = customers.filter(c => c.numberOfOrders > 1).length;
    return customers.length > 0 ? 
      Math.round((returningCustomers / customers.length) * 10000) / 100 : 0;
  }

  private calculateAverageCustomerLifetimeValue(customers: ShopifyCustomer[]): number {
    const totalValue = customers.reduce((sum, customer) => 
      sum + parseFloat(customer.amountSpent?.amount || '0'), 0);
    return customers.length > 0 ? Math.round((totalValue / customers.length) * 100) / 100 : 0;
  }

  private calculateRefundRate(orders: ShopifyOrder[]): number {
    const refundedOrders = orders.filter(order => order.displayFinancialStatus === 'refunded').length;
    return orders.length > 0 ? (refundedOrders / orders.length) * 100 : 0;
  }

  private calculateAverageProcessingTime(orders: ShopifyOrder[]): number {
    const processingTimes = orders.map(order => {
      const orderDate = moment(order.createdAt);
      const processedDate = moment(order.processedAt || order.createdAt);
      return processedDate.diff(orderDate, 'hours');
    });

    return processingTimes.length > 0 ? _.mean(processingTimes) : 0;
  }

  private countNewCustomers(customers: ShopifyCustomer[], since: moment.Moment): number {
    return customers.filter(customer => moment(customer.createdAt).isAfter(since)).length;
  }

  private calculateOverallPerformanceScore(orders: ShopifyOrder[], customers: ShopifyCustomer[]): number {
    const fulfillmentRate = this.calculateFulfillmentRate(orders);
    const retentionRate = this.calculateCustomerRetentionRate(customers);
    const avgOrderValue = this.calculateAverageOrderValue(orders);
    const refundRate = this.calculateRefundRate(orders);

    // Weighted score
    return Math.round(
      (fulfillmentRate * 0.3 + 
       retentionRate * 0.3 + 
       Math.min(avgOrderValue / 100, 100) * 0.2 + 
       (100 - refundRate) * 0.2)
    );
  }

  private calculateSalesPerformanceScore(orders: ShopifyOrder[]): number {
    const avgOrderValue = this.calculateAverageOrderValue(orders);
    const revenueGrowth = 10; // Placeholder - would calculate from historical data
    
    return Math.round(
      Math.min(avgOrderValue / 50, 100) * 0.6 + 
      Math.max(0, Math.min(revenueGrowth + 50, 100)) * 0.4
    );
  }

  private calculateOperationsPerformanceScore(orders: ShopifyOrder[]): number {
    const fulfillmentRate = this.calculateFulfillmentRate(orders);
    const processingTime = this.calculateAverageProcessingTime(orders);
    
    return Math.round(
      fulfillmentRate * 0.7 + 
      Math.max(0, 100 - (processingTime / 24) * 10) * 0.3
    );
  }

  private calculateCustomerPerformanceScore(customers: ShopifyCustomer[], orders: ShopifyOrder[]): number {
    const retentionRate = this.calculateCustomerRetentionRate(customers);
    const clv = this.calculateAverageCustomerLifetimeValue(customers);
    
    return Math.round(
      retentionRate * 0.6 + 
      Math.min(clv / 500, 100) * 0.4
    );
  }

  private calculateOverallTrend(trends: any[]): string {
    if (trends.length < 3) return 'Insufficient Data';

    const recentTrends = trends.slice(-3);
    const avgGrowth = recentTrends.reduce((sum, t) => sum + t.revenueGrowth, 0) / recentTrends.length;

    if (avgGrowth > 5) return 'Growing';
    if (avgGrowth > 0) return 'Stable Growth';
    if (avgGrowth > -5) return 'Stable';
    return 'Declining';
  }

  private calculateSeasonalPatterns(trends: any[]) {
    // Simple seasonal analysis based on month patterns
    const seasonalData = {
      Q1: trends.filter(t => ['01', '02', '03'].includes(t.month.split('-')[1])),
      Q2: trends.filter(t => ['04', '05', '06'].includes(t.month.split('-')[1])),
      Q3: trends.filter(t => ['07', '08', '09'].includes(t.month.split('-')[1])),
      Q4: trends.filter(t => ['10', '11', '12'].includes(t.month.split('-')[1])),
    };

    return Object.entries(seasonalData).map(([quarter, data]) => ({
      quarter,
      averageRevenue: data.length > 0 ? _.meanBy(data, 'revenue') : 0,
      averageOrders: data.length > 0 ? _.meanBy(data, 'orders') : 0,
    }));
  }

  private calculateProjections(trends: any[]) {
    if (trends.length < 3) return { nextMonth: 0, nextQuarter: 0 };

    const recentTrends = trends.slice(-3);
    const avgRevenue = _.meanBy(recentTrends, 'revenue');
    const avgGrowthRate = _.meanBy(recentTrends, 'revenueGrowth') / 100;

    return {
      nextMonth: Math.round(avgRevenue * (1 + avgGrowthRate) * 100) / 100,
      nextQuarter: Math.round(avgRevenue * (1 + avgGrowthRate) * 3 * 100) / 100,
    };
  }
}
