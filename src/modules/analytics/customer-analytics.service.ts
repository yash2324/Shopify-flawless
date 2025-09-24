import { Injectable, Logger } from '@nestjs/common';
import * as moment from 'moment';
import * as _ from 'lodash';
import {
  ShopifyCustomer,
  ShopifyOrder,
  CustomerProfitabilityAnalysis,
  PurchaseHistoryAnalysis,
  PurchaseRecord,
  SeasonalTrend,
} from '@interfaces/shopify.interface';

@Injectable()
export class CustomerAnalyticsService {
  private readonly logger = new Logger(CustomerAnalyticsService.name);

  /**
   * Process customer data and generate comprehensive analytics
   */
  async processCustomerData(customers: ShopifyCustomer[], orders: ShopifyOrder[]): Promise<any> {
    this.logger.log('Processing customer analytics data');

    try {
      // EMERGENCY: Use fast version with only essential calculations
      return this.processCustomerDataFast(customers, orders);
    } catch (error) {
      this.logger.error('Error processing customer data:', error);
      throw error;
    }
  }

  /**
   * Fast customer analytics with only essential calculations
   */
  async processCustomerDataFast(customers: ShopifyCustomer[], orders: ShopifyOrder[]): Promise<any> {
    this.logger.log('Processing customer analytics (FAST MODE)');
    
    // Only do essential calculations, skip heavy processing
    const profitabilityAnalysis = await this.calculateCustomerProfitabilityFast(customers, orders);
    
    return {
      profitabilityAnalysis,
      summary: {
        totalCustomers: customers.length,
        activeCustomers: this.countActiveCustomers(customers, orders),
        newCustomers: this.countNewCustomers(customers),
        averageOrdersPerCustomer: this.calculateAverageOrdersPerCustomer(customers),
        averageCustomerValue: this.calculateAverageCustomerValue(customers),
      },
      lastUpdated: new Date().toISOString(),
      mode: 'fast',
    };
  }

  /**
   * Original comprehensive analytics (SLOW - disabled)
   */
  async processCustomerDataComplete(customers: ShopifyCustomer[], orders: ShopifyOrder[]): Promise<any> {
    this.logger.log('Processing customer analytics data (COMPLETE)');

    try {
      const [
        customerSegmentation,
        profitabilityAnalysis,
        purchaseHistoryAnalysis,
        cohortAnalysis,
        retentionMetrics,
        customerLifetimeValue,
        churnAnalysis,
      ] = await Promise.all([
        this.calculateCustomerSegmentation(customers, orders),
        this.calculateCustomerProfitability(customers, orders),
        this.calculatePurchaseHistoryAnalysis(customers, orders),
        this.calculateCohortAnalysis(orders),
        this.calculateRetentionMetrics(customers, orders),
        this.calculateCustomerLifetimeValue(customers, orders),
        this.calculateChurnAnalysis(customers, orders),
      ]);

      return {
        customerSegmentation,
        profitabilityAnalysis,
        purchaseHistoryAnalysis,
        cohortAnalysis,
        retentionMetrics,
        customerLifetimeValue,
        churnAnalysis,
        summary: {
          totalCustomers: customers.length,
          activeCustomers: this.countActiveCustomers(customers, orders),
          newCustomers: this.countNewCustomers(customers),
          averageOrdersPerCustomer: this.calculateAverageOrdersPerCustomer(customers),
          averageCustomerValue: this.calculateAverageCustomerValue(customers),
        },
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error processing customer data:', error);
      throw error;
    }
  }

  /**
   * Calculate customer segmentation based on RFM analysis
   */
  private async calculateCustomerSegmentation(customers: ShopifyCustomer[], orders: ShopifyOrder[]) {
    const customerOrderMap = new Map<string, ShopifyOrder[]>();
    
    // Group orders by customer
    orders.forEach(order => {
      if (order.customer?.id) {
        const customerId = order.customer.id;
        if (!customerOrderMap.has(customerId)) {
          customerOrderMap.set(customerId, []);
        }
        customerOrderMap.get(customerId)!.push(order);
      }
    });

    const rfmData = customers.map(customer => {
      const customerOrders = customerOrderMap.get(customer.id) || [];
      
      // Recency: Days since last purchase
      const lastOrderDate = customerOrders.length > 0 ? 
        moment.max(customerOrders.map(order => moment(order.createdAt))) : null;
      const recency = lastOrderDate ? moment().diff(lastOrderDate, 'days') : 999;

      // Frequency: Number of orders
      const frequency = customerOrders.length;

      // Monetary: Total spent
      const monetary = parseFloat(customer.amountSpent?.amount || '0');

      return {
        customerId: customer.id,
        customerName: customer.displayName,
        email: customer.email,
        recency,
        frequency,
        monetary,
        registrationDate: customer.createdAt,
      };
    });

    // Calculate quintiles for segmentation
    const sortedByRecency = [...rfmData].sort((a, b) => a.recency - b.recency);
    const sortedByFrequency = [...rfmData].sort((a, b) => b.frequency - a.frequency);
    const sortedByMonetary = [...rfmData].sort((a, b) => b.monetary - a.monetary);

    const getQuintile = (array: any[], item: any, field: string) => {
      const index = array.findIndex(x => x.customerId === item.customerId);
      return Math.ceil(((index + 1) / array.length) * 5);
    };

    // Assign RFM scores and segments
    const segmentedCustomers = rfmData.map(customer => {
      const rScore = getQuintile(sortedByRecency, customer, 'recency');
      const fScore = getQuintile(sortedByFrequency, customer, 'frequency');
      const mScore = getQuintile(sortedByMonetary, customer, 'monetary');

      let segment = 'Low Value';
      
      if (rScore >= 4 && fScore >= 4 && mScore >= 4) {
        segment = 'Champions';
      } else if (rScore >= 3 && fScore >= 3 && mScore >= 3) {
        segment = 'Loyal Customers';
      } else if (rScore >= 4 && fScore <= 2) {
        segment = 'New Customers';
      } else if (rScore <= 2 && fScore >= 3) {
        segment = 'At Risk';
      } else if (rScore <= 2 && fScore <= 2 && mScore >= 3) {
        segment = 'Cannot Lose Them';
      } else if (rScore >= 3 && fScore <= 2 && mScore <= 2) {
        segment = 'Potential Loyalists';
      }

      return {
        ...customer,
        rfmScore: `${rScore}${fScore}${mScore}`,
        segment,
        rScore,
        fScore,
        mScore,
      };
    });

    // Group by segments
    const segments = _.groupBy(segmentedCustomers, 'segment');
    
    return {
      segments: Object.entries(segments).map(([segmentName, customers]) => ({
        name: segmentName,
        count: customers.length,
        percentage: (customers.length / rfmData.length) * 100,
        averageMonetary: _.meanBy(customers, 'monetary'),
        averageFrequency: _.meanBy(customers, 'frequency'),
        averageRecency: _.meanBy(customers, 'recency'),
        customers: customers.slice(0, 10), // Top 10 for preview
      })),
      totalCustomers: rfmData.length,
    };
  }

  /**
   * Fast customer profitability calculation (simplified)
   */
  private async calculateCustomerProfitabilityFast(
    customers: ShopifyCustomer[], 
    orders: ShopifyOrder[]
  ): Promise<CustomerProfitabilityAnalysis[]> {
    // EMERGENCY: Simplified profitability calculation
    return customers
      .filter(customer => customer.numberOfOrders > 0)
      .slice(0, 50) // Max 50 customers for speed
      .map(customer => {
        const totalSpent = parseFloat(customer.amountSpent?.amount || '0');
        const orderCount = customer.numberOfOrders;
        const averageOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;

        return {
          customerId: customer.id,
          customerName: customer.displayName || 'Unknown',
          email: customer.email,
          registrationDate: customer.createdAt, // Add missing field
          totalSpent,
          orderCount,
          averageOrderValue,
          lifetimeValue: totalSpent * 1.5, // Simplified LTV
          profitMargin: totalSpent * 0.3, // 30% margin estimate
          lastPurchaseDate: 'N/A', // Skip expensive date calculations
          daysSinceLastPurchase: 0,
          purchaseFrequency: orderCount / 12, // Simplified frequency
          segmentation: (totalSpent > 1000 ? 'High Value' : totalSpent > 500 ? 'Medium Value' : 'Low Value') as 'High Value' | 'Medium Value' | 'Low Value' | 'At Risk' | 'New', // Add missing field
          riskScore: totalSpent < 100 ? 'HIGH' : 'LOW',
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }

  /**
   * Calculate customer profitability analysis (ORIGINAL - SLOW)
   */
  private async calculateCustomerProfitability(
    customers: ShopifyCustomer[], 
    orders: ShopifyOrder[]
  ): Promise<CustomerProfitabilityAnalysis[]> {
    const customerOrderMap = new Map<string, ShopifyOrder[]>();
    
    // Group orders by customer
    orders.forEach(order => {
      if (order.customer?.id) {
        const customerId = order.customer.id;
        if (!customerOrderMap.has(customerId)) {
          customerOrderMap.set(customerId, []);
        }
        customerOrderMap.get(customerId)!.push(order);
      }
    });

    const profitabilityData = customers
      .filter(customer => customer.numberOfOrders > 0)
      .map(customer => {
        const customerOrders = customerOrderMap.get(customer.id) || [];
        const totalSpent = parseFloat(customer.amountSpent?.amount || '0');
        const orderCount = customer.numberOfOrders;
        const averageOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;

        // Calculate lifetime value (simplified)
        const estimatedLifetimeMonths = 24; // 2 years average
        const monthlyOrderFrequency = orderCount / this.getCustomerAgeInMonths(customer.createdAt);
        const lifetimeValue = averageOrderValue * monthlyOrderFrequency * estimatedLifetimeMonths;

        // Calculate profit margin (simplified - would need cost data in reality)
        const estimatedProfitMargin = 0.3; // 30% margin
        const profitMargin = totalSpent * estimatedProfitMargin;

        // Find last purchase date
        const lastPurchaseDate = customerOrders.length > 0 ? 
          moment.max(customerOrders.map(order => moment(order.createdAt))).format('YYYY-MM-DD') : 
          'Never';

        const daysSinceLastPurchase = customerOrders.length > 0 ? 
          moment().diff(moment.max(customerOrders.map(order => moment(order.createdAt))), 'days') : 
          999;

        // Purchase frequency (orders per month)
        const customerAgeMonths = this.getCustomerAgeInMonths(customer.createdAt);
        const purchaseFrequency = customerAgeMonths > 0 ? orderCount / customerAgeMonths : 0;

        // Determine segmentation
        let segmentation: 'High Value' | 'Medium Value' | 'Low Value' | 'At Risk' | 'New' = 'Low Value';
        
        if (daysSinceLastPurchase <= 30 && totalSpent >= 1000) {
          segmentation = 'High Value';
        } else if (daysSinceLastPurchase <= 60 && totalSpent >= 500) {
          segmentation = 'Medium Value';
        } else if (daysSinceLastPurchase > 90) {
          segmentation = 'At Risk';
        } else if (this.getCustomerAgeInMonths(customer.createdAt) <= 3) {
          segmentation = 'New';
        }

        return {
          customerId: customer.id,
          customerName: customer.displayName || `${customer.firstName} ${customer.lastName}`.trim() || 'Unknown',
          email: customer.email,
          registrationDate: customer.createdAt,
          totalSpent: Math.round(totalSpent * 100) / 100,
          orderCount,
          averageOrderValue: Math.round(averageOrderValue * 100) / 100,
          lifetimeValue: Math.round(lifetimeValue * 100) / 100,
          profitMargin: Math.round(profitMargin * 100) / 100,
          lastPurchaseDate,
          daysSinceLastPurchase,
          purchaseFrequency: Math.round(purchaseFrequency * 100) / 100,
          segmentation,
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 100); // Top 100 customers

    return profitabilityData;
  }

  /**
   * Calculate purchase history analysis
   */
  private async calculatePurchaseHistoryAnalysis(
    customers: ShopifyCustomer[], 
    orders: ShopifyOrder[]
  ): Promise<PurchaseHistoryAnalysis[]> {
    const customerOrderMap = new Map<string, ShopifyOrder[]>();
    
    // Group orders by customer
    orders.forEach(order => {
      if (order.customer?.id) {
        const customerId = order.customer.id;
        if (!customerOrderMap.has(customerId)) {
          customerOrderMap.set(customerId, []);
        }
        customerOrderMap.get(customerId)!.push(order);
      }
    });

    const purchaseAnalysis = customers
      .filter(customer => customer.numberOfOrders > 0)
      .map(customer => {
        const customerOrders = customerOrderMap.get(customer.id) || [];
        
        // Create purchase history
        const purchaseHistory: PurchaseRecord[] = customerOrders
          .sort((a, b) => moment(b.createdAt).valueOf() - moment(a.createdAt).valueOf())
          .map(order => ({
            orderId: order.id,
            orderName: order.name,
            date: moment(order.createdAt).format('YYYY-MM-DD'),
            amount: parseFloat(order.totalPriceSet?.shopMoney?.amount || '0'),
            itemCount: order.lineItems?.edges?.reduce((sum, edge) => sum + (edge.node.quantity || 0), 0) || 0,
            items: order.lineItems?.edges?.map(edge => edge.node) || [],
          }));

        // Calculate purchase frequency
        const orderDates = customerOrders.map(order => moment(order.createdAt));
        let averageDaysBetweenPurchases = 0;
        
        if (orderDates.length > 1) {
          const intervals: number[] = [];
          for (let i = 1; i < orderDates.length; i++) {
            intervals.push(orderDates[i - 1].diff(orderDates[i], 'days'));
          }
          averageDaysBetweenPurchases = _.mean(intervals);
        }

        let frequency: 'High' | 'Medium' | 'Low' = 'Low';
        if (averageDaysBetweenPurchases <= 30) frequency = 'High';
        else if (averageDaysBetweenPurchases <= 60) frequency = 'Medium';

        // Calculate seasonal trends
        const seasonalTrends = this.calculateCustomerSeasonalTrends(customerOrders);

        // Predict next purchase (simplified)
        const lastOrderDate = orderDates.length > 0 ? orderDates[0] : null;
        const predictedNextPurchase = lastOrderDate && averageDaysBetweenPurchases > 0 ? 
          lastOrderDate.clone().add(averageDaysBetweenPurchases, 'days').format('YYYY-MM-DD') : 
          undefined;

        // Generate recommendations
        const recommendations = this.generateCustomerRecommendations(customer, purchaseHistory, frequency);

        return {
          customerId: customer.id,
          purchaseHistory: purchaseHistory.slice(0, 10), // Last 10 orders
          purchaseFrequency: {
            averageDaysBetweenPurchases: Math.round(averageDaysBetweenPurchases),
            frequency,
          },
          seasonalTrends,
          predictedNextPurchase,
          recommendations,
        };
      })
      .slice(0, 50); // Top 50 customers

    return purchaseAnalysis;
  }

  /**
   * Calculate cohort analysis
   */
  private async calculateCohortAnalysis(orders: ShopifyOrder[]) {
    const cohorts = new Map<string, Map<number, Set<string>>>();
    
    // Group customers by first purchase month (cohort)
    const customerFirstPurchase = new Map<string, moment.Moment>();
    
    orders.forEach(order => {
      if (order.customer?.id) {
        const customerId = order.customer.id;
        const orderDate = moment(order.createdAt);
        
        if (!customerFirstPurchase.has(customerId) || 
            orderDate.isBefore(customerFirstPurchase.get(customerId))) {
          customerFirstPurchase.set(customerId, orderDate);
        }
      }
    });

    // Initialize cohorts
    customerFirstPurchase.forEach((firstPurchaseDate, customerId) => {
      const cohortMonth = firstPurchaseDate.format('YYYY-MM');
      if (!cohorts.has(cohortMonth)) {
        cohorts.set(cohortMonth, new Map());
      }
    });

    // Track retention for each cohort
    orders.forEach(order => {
      if (order.customer?.id) {
        const customerId = order.customer.id;
        const orderDate = moment(order.createdAt);
        const firstPurchaseDate = customerFirstPurchase.get(customerId);
        
        if (firstPurchaseDate) {
          const cohortMonth = firstPurchaseDate.format('YYYY-MM');
          const monthsSinceFirst = orderDate.diff(firstPurchaseDate, 'months');
          
          const cohort = cohorts.get(cohortMonth)!;
          if (!cohort.has(monthsSinceFirst)) {
            cohort.set(monthsSinceFirst, new Set());
          }
          cohort.get(monthsSinceFirst)!.add(customerId);
        }
      }
    });

    // Convert to analysis format
    const cohortAnalysis = Array.from(cohorts.entries())
      .map(([cohortMonth, monthlyData]) => {
        const cohortSize = monthlyData.get(0)?.size || 0;
        const retentionRates = new Map<number, number>();
        
        for (let month = 0; month <= 12; month++) {
          const activeCustomers = monthlyData.get(month)?.size || 0;
          const retentionRate = cohortSize > 0 ? (activeCustomers / cohortSize) * 100 : 0;
          retentionRates.set(month, retentionRate);
        }
        
        return {
          cohortMonth,
          cohortSize,
          retentionRates: Array.from(retentionRates.entries()).map(([month, rate]) => ({
            month,
            retentionRate: Math.round(rate * 100) / 100,
            activeCustomers: monthlyData.get(month)?.size || 0,
          })),
        };
      })
      .sort((a, b) => b.cohortMonth.localeCompare(a.cohortMonth))
      .slice(0, 12); // Last 12 cohorts

    return cohortAnalysis;
  }

  /**
   * Calculate retention metrics
   */
  private async calculateRetentionMetrics(customers: ShopifyCustomer[], orders: ShopifyOrder[]) {
    const now = moment();
    const thirtyDaysAgo = now.clone().subtract(30, 'days');
    const sixtyDaysAgo = now.clone().subtract(60, 'days');
    const ninetyDaysAgo = now.clone().subtract(90, 'days');

    // Customers with purchases in different periods
    const activeIn30Days = new Set<string>();
    const activeIn60Days = new Set<string>();
    const activeIn90Days = new Set<string>();

    orders.forEach(order => {
      if (order.customer?.id) {
        const orderDate = moment(order.createdAt);
        const customerId = order.customer.id;

        if (orderDate.isAfter(thirtyDaysAgo)) {
          activeIn30Days.add(customerId);
        }
        if (orderDate.isAfter(sixtyDaysAgo)) {
          activeIn60Days.add(customerId);
        }
        if (orderDate.isAfter(ninetyDaysAgo)) {
          activeIn90Days.add(customerId);
        }
      }
    });

    const totalCustomers = customers.length;
    const returningCustomers = customers.filter(c => c.numberOfOrders > 1).length;

    return {
      totalCustomers,
      returningCustomers,
      oneTimeCustomers: totalCustomers - returningCustomers,
      overallRetentionRate: totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0,
      activeCustomers: {
        last30Days: activeIn30Days.size,
        last60Days: activeIn60Days.size,
        last90Days: activeIn90Days.size,
      },
      retentionRates: {
        thirtyDay: totalCustomers > 0 ? (activeIn30Days.size / totalCustomers) * 100 : 0,
        sixtyDay: totalCustomers > 0 ? (activeIn60Days.size / totalCustomers) * 100 : 0,
        ninetyDay: totalCustomers > 0 ? (activeIn90Days.size / totalCustomers) * 100 : 0,
      },
    };
  }

  /**
   * Calculate customer lifetime value
   */
  private async calculateCustomerLifetimeValue(customers: ShopifyCustomer[], orders: ShopifyOrder[]) {
    const totalRevenue = customers.reduce((sum, customer) => 
      sum + parseFloat(customer.amountSpent?.amount || '0'), 0);
    
    const totalCustomers = customers.length;
    const averageCLV = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

    // Calculate CLV by segments
    const highValueCustomers = customers.filter(c => parseFloat(c.amountSpent?.amount || '0') >= 1000);
    const mediumValueCustomers = customers.filter(c => {
      const spent = parseFloat(c.amountSpent?.amount || '0');
      return spent >= 500 && spent < 1000;
    });
    const lowValueCustomers = customers.filter(c => parseFloat(c.amountSpent?.amount || '0') < 500);

    return {
      averageCLV: Math.round(averageCLV * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      segmentBreakdown: {
        highValue: {
          count: highValueCustomers.length,
          averageCLV: highValueCustomers.length > 0 ? 
            Math.round((highValueCustomers.reduce((sum, c) => sum + parseFloat(c.amountSpent?.amount || '0'), 0) / highValueCustomers.length) * 100) / 100 : 0,
          totalRevenue: Math.round(highValueCustomers.reduce((sum, c) => sum + parseFloat(c.amountSpent?.amount || '0'), 0) * 100) / 100,
        },
        mediumValue: {
          count: mediumValueCustomers.length,
          averageCLV: mediumValueCustomers.length > 0 ? 
            Math.round((mediumValueCustomers.reduce((sum, c) => sum + parseFloat(c.amountSpent?.amount || '0'), 0) / mediumValueCustomers.length) * 100) / 100 : 0,
          totalRevenue: Math.round(mediumValueCustomers.reduce((sum, c) => sum + parseFloat(c.amountSpent?.amount || '0'), 0) * 100) / 100,
        },
        lowValue: {
          count: lowValueCustomers.length,
          averageCLV: lowValueCustomers.length > 0 ? 
            Math.round((lowValueCustomers.reduce((sum, c) => sum + parseFloat(c.amountSpent?.amount || '0'), 0) / lowValueCustomers.length) * 100) / 100 : 0,
          totalRevenue: Math.round(lowValueCustomers.reduce((sum, c) => sum + parseFloat(c.amountSpent?.amount || '0'), 0) * 100) / 100,
        },
      },
    };
  }

  /**
   * Calculate churn analysis
   */
  private async calculateChurnAnalysis(customers: ShopifyCustomer[], orders: ShopifyOrder[]) {
    const now = moment();
    const customerLastOrderMap = new Map<string, moment.Moment>();

    // Find last order date for each customer
    orders.forEach(order => {
      if (order.customer?.id) {
        const customerId = order.customer.id;
        const orderDate = moment(order.createdAt);
        
        if (!customerLastOrderMap.has(customerId) || 
            orderDate.isAfter(customerLastOrderMap.get(customerId))) {
          customerLastOrderMap.set(customerId, orderDate);
        }
      }
    });

    // Define churn periods
    const churnThresholds = {
      risk: 60,    // 60 days since last order
      churned: 120, // 120 days since last order
    };

    let atRiskCustomers = 0;
    let churnedCustomers = 0;
    let activeCustomers = 0;

    customers.forEach(customer => {
      const lastOrderDate = customerLastOrderMap.get(customer.id);
      
      if (lastOrderDate) {
        const daysSinceLastOrder = now.diff(lastOrderDate, 'days');
        
        if (daysSinceLastOrder > churnThresholds.churned) {
          churnedCustomers++;
        } else if (daysSinceLastOrder > churnThresholds.risk) {
          atRiskCustomers++;
        } else {
          activeCustomers++;
        }
      } else {
        // Customer exists but no orders found
        churnedCustomers++;
      }
    });

    const totalCustomers = customers.length;
    const churnRate = totalCustomers > 0 ? (churnedCustomers / totalCustomers) * 100 : 0;
    const atRiskRate = totalCustomers > 0 ? (atRiskCustomers / totalCustomers) * 100 : 0;

    return {
      totalCustomers,
      activeCustomers,
      atRiskCustomers,
      churnedCustomers,
      churnRate: Math.round(churnRate * 100) / 100,
      atRiskRate: Math.round(atRiskRate * 100) / 100,
      retentionRate: Math.round((100 - churnRate) * 100) / 100,
      churnThresholds,
    };
  }

  // Helper methods
  private getCustomerAgeInMonths(createdAt: string): number {
    return moment().diff(moment(createdAt), 'months');
  }

  private calculateCustomerSeasonalTrends(orders: ShopifyOrder[]): SeasonalTrend[] {
    const monthlyData = new Map<string, { amount: number; count: number }>();

    orders.forEach(order => {
      const month = moment(order.createdAt).format('MMMM');
      const amount = parseFloat(order.totalPriceSet?.shopMoney?.amount || '0');

      if (!monthlyData.has(month)) {
        monthlyData.set(month, { amount: 0, count: 0 });
      }

      const data = monthlyData.get(month)!;
      data.amount += amount;
      data.count += 1;
    });

    return Array.from(monthlyData.entries()).map(([month, data]) => ({
      month,
      averageSpend: data.count > 0 ? Math.round((data.amount / data.count) * 100) / 100 : 0,
      orderCount: data.count,
      trend: 'Stable' as const, // Simplified - would need more data for proper trend analysis
    }));
  }

  private generateCustomerRecommendations(
    customer: ShopifyCustomer, 
    purchaseHistory: PurchaseRecord[], 
    frequency: 'High' | 'Medium' | 'Low'
  ): string[] {
    const recommendations: string[] = [];
    const daysSinceLastPurchase = purchaseHistory.length > 0 ? 
      moment().diff(moment(purchaseHistory[0].date), 'days') : 999;

    if (frequency === 'High') {
      recommendations.push('VIP customer - offer exclusive products or early access');
    }

    if (daysSinceLastPurchase > 60) {
      recommendations.push('Send win-back email campaign');
    }

    if (customer.numberOfOrders === 1) {
      recommendations.push('Target with onboarding sequence for new customers');
    }

    if (parseFloat(customer.amountSpent?.amount || '0') > 1000) {
      recommendations.push('Upsell premium products or accessories');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue regular marketing communications');
    }

    return recommendations;
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

  private countNewCustomers(customers: ShopifyCustomer[]): number {
    const last30Days = moment().subtract(30, 'days');
    return customers.filter(customer => 
      moment(customer.createdAt).isAfter(last30Days)
    ).length;
  }

  private calculateAverageOrdersPerCustomer(customers: ShopifyCustomer[]): number {
    const totalOrders = customers.reduce((sum, customer) => sum + customer.numberOfOrders, 0);
    return customers.length > 0 ? Math.round((totalOrders / customers.length) * 100) / 100 : 0;
  }

  private calculateAverageCustomerValue(customers: ShopifyCustomer[]): number {
    const totalValue = customers.reduce((sum, customer) => 
      sum + parseFloat(customer.amountSpent?.amount || '0'), 0);
    return customers.length > 0 ? Math.round((totalValue / customers.length) * 100) / 100 : 0;
  }

  /**
   * Fast purchase history analysis (simplified)
   */
  public async calculatePurchaseHistoryAnalysisFast(customers: ShopifyCustomer[], orders: ShopifyOrder[]): Promise<PurchaseHistoryAnalysis[]> {
    this.logger.log('Processing purchase history analysis (FAST MODE)');
    
    const customerOrderMap = new Map<string, ShopifyOrder[]>();
    
    // Group orders by customer
    orders.forEach(order => {
      if (order.customer?.id) {
        const customerId = order.customer.id;
        if (!customerOrderMap.has(customerId)) {
          customerOrderMap.set(customerId, []);
        }
        customerOrderMap.get(customerId)!.push(order);
      }
    });

    const purchaseAnalysis = customers
      .filter(customer => customer.numberOfOrders > 0)
      .slice(0, 20) // Max 20 customers for speed
      .map(customer => {
        const customerOrders = customerOrderMap.get(customer.id) || [];
        
        // Simplified purchase history - max 5 recent orders
        const purchaseHistory: PurchaseRecord[] = customerOrders
          .sort((a, b) => moment(b.createdAt).valueOf() - moment(a.createdAt).valueOf())
          .slice(0, 5) // Only last 5 orders
          .map(order => ({
            orderId: order.id,
            orderName: order.name,
            date: moment(order.createdAt).format('YYYY-MM-DD'),
            amount: parseFloat(order.totalPriceSet?.shopMoney?.amount || '0'),
            itemCount: order.lineItems?.edges?.reduce((sum, edge) => sum + (edge.node.quantity || 0), 0) || 0,
            items: order.lineItems?.edges?.slice(0, 3).map(edge => edge.node) || [], // Max 3 items
          }));

        // Simplified frequency calculation
        let frequency: 'High' | 'Medium' | 'Low' = 'Low';
        if (customerOrders.length >= 5) frequency = 'High';
        else if (customerOrders.length >= 2) frequency = 'Medium';

        // Simplified seasonal trends
        const seasonalTrends: SeasonalTrend[] = [
          { month: 'Current', averageSpend: customerOrders.length > 0 ? customerOrders[0] ? parseFloat(customerOrders[0].totalPriceSet?.shopMoney?.amount || '0') : 0 : 0, orderCount: customerOrders.length, trend: 'Stable' },
        ];

        return {
          customerId: customer.id,
          purchaseHistory,
          purchaseFrequency: {
            averageDaysBetweenPurchases: 30, // Simplified
            frequency,
          },
          seasonalTrends,
          predictedNextPurchase: undefined, // Skip complex predictions
          recommendations: ['Continue regular engagement'], // Simplified
        };
      });

    return purchaseAnalysis;
  }
}
