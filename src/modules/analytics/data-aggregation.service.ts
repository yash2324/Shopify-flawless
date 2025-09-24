import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as _ from 'lodash';
import * as moment from 'moment';
import {
  ShopifyOrder,
  ShopifyProduct,
  ShopifyCustomer,
  LineItem,
  DashboardSummary,
  TopSellingProduct,
  LowStockProduct,
  SalesTrendData,
  CustomerMetrics,
  TopCustomer,
  InventoryMetrics,
} from '@interfaces/shopify.interface';

@Injectable()
export class DataAggregationService {
  private readonly logger = new Logger(DataAggregationService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Aggregate all data into a comprehensive dashboard summary
   */
  async aggregateDashboardData(
    orders: ShopifyOrder[],
    products: ShopifyProduct[],
    customers: ShopifyCustomer[],
  ): Promise<DashboardSummary> {
    this.logger.log('Starting dashboard data aggregation');

    try {
      const [
        salesMetrics,
        topSellingProducts,
        lowStockProducts,
        salesTrend,
        customerMetrics,
        inventoryMetrics,
      ] = await Promise.all([
        this.calculateSalesMetrics(orders),
        this.calculateTopSellingProducts(orders),
        this.calculateLowStockProducts(products),
        this.calculateSalesTrend(orders),
        this.calculateCustomerMetrics(customers, orders),
        this.calculateInventoryMetrics(products),
      ]);

      const recentOrders = this.getRecentOrders(orders, 10);

      const summary: DashboardSummary = {
        totalSales: salesMetrics.totalSales,
        totalOrders: salesMetrics.totalOrders,
        totalCustomers: customers.length,
        averageOrderValue: salesMetrics.averageOrderValue,
        conversionRate: salesMetrics.conversionRate,
        topSellingProducts,
        recentOrders,
        lowStockProducts,
        salesTrend,
        customerMetrics,
        inventoryMetrics,
        lastUpdated: new Date().toISOString(),
      };

      this.logger.log(`Dashboard data aggregation completed successfully`);
      return summary;
    } catch (error) {
      this.logger.error('Error aggregating dashboard data:', error);
      throw error;
    }
  }

  /**
   * Calculate basic sales metrics
   */
  private async calculateSalesMetrics(orders: ShopifyOrder[]) {
    const totalSales = orders.reduce((sum, order) => {
      const amount = parseFloat(order.totalPriceSet?.shopMoney?.amount || '0');
      return sum + amount;
    }, 0);

    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    // Calculate conversion rate (assuming all customers who placed orders converted)
    // This is a simplified calculation - in reality, you'd need visitor data
    const conversionRate = 0.025; // 2.5% placeholder

    return {
      totalSales,
      totalOrders,
      averageOrderValue,
      conversionRate,
    };
  }

  /**
   * Calculate top-selling products based on quantity and revenue
   */
  private async calculateTopSellingProducts(orders: ShopifyOrder[]): Promise<TopSellingProduct[]> {
    const productSales = new Map<string, {
      productId: string;
      productTitle: string;
      variantId: string;
      variantTitle: string;
      sku: string;
      quantity: number;
      revenue: number;
      productType: string;
      vendor: string;
      prices: number[];
    }>();

    // Aggregate sales data by product variant
    orders.forEach(order => {
      order.lineItems?.edges?.forEach(edge => {
        const item = edge.node;
        const variantId = item.variant?.id || 'unknown';
        const productId = item.variant?.product?.id || 'unknown';
        const quantity = item.quantity || 0;
        const unitPrice = parseFloat(item.originalUnitPriceSet?.shopMoney?.amount || '0');
        const revenue = quantity * unitPrice;

        const key = `${productId}-${variantId}`;
        
        if (productSales.has(key)) {
          const existing = productSales.get(key)!;
          existing.quantity += quantity;
          existing.revenue += revenue;
          existing.prices.push(unitPrice);
        } else {
          productSales.set(key, {
            productId,
            productTitle: item.variant?.product?.title || item.title || 'Unknown Product',
            variantId,
            variantTitle: item.variant?.title || 'Default',
            sku: item.sku || 'N/A',
            quantity,
            revenue,
            productType: item.variant?.product?.productType || 'Unknown',
            vendor: item.variant?.product?.vendor || 'Unknown',
            prices: [unitPrice],
          });
        }
      });
    });

    // Convert to array and calculate averages
    const topProducts: TopSellingProduct[] = Array.from(productSales.values())
      .map(product => ({
        productId: product.productId,
        productTitle: product.productTitle,
        variantId: product.variantId,
        variantTitle: product.variantTitle,
        sku: product.sku,
        totalQuantitySold: product.quantity,
        totalRevenue: product.revenue,
        averagePrice: product.prices.length > 0 ? 
          product.prices.reduce((sum, price) => sum + price, 0) / product.prices.length : 0,
        productType: product.productType,
        vendor: product.vendor,
      }))
      .sort((a, b) => b.totalQuantitySold - a.totalQuantitySold) // Sort by quantity sold
      .slice(0, 10); // Top 10

    return topProducts;
  }

  /**
   * Calculate low stock products that need attention
   */
  private async calculateLowStockProducts(products: ShopifyProduct[]): Promise<LowStockProduct[]> {
    const lowStockThreshold = 10; // Configurable threshold
    const criticalStockThreshold = 5;

    const lowStockProducts: LowStockProduct[] = [];

    products.forEach(product => {
      product.variants?.edges?.forEach(edge => {
        const variant = edge.node;
        const currentStock = variant.inventoryQuantity || 0;

        if (currentStock <= lowStockThreshold && variant.inventoryItem?.tracked) {
          lowStockProducts.push({
            productId: product.id,
            productTitle: product.title,
            variantId: variant.id,
            variantTitle: variant.title,
            sku: variant.sku || 'N/A',
            currentStock,
            recommendedReorderLevel: lowStockThreshold * 2,
            daysOfStockRemaining: this.calculateDaysOfStockRemaining(currentStock),
          });
        }
      });
    });

    // Sort by urgency (lowest stock first)
    return lowStockProducts
      .sort((a, b) => a.currentStock - b.currentStock)
      .slice(0, 20); // Top 20 most urgent
  }

  /**
   * Calculate sales trend over time
   */
  private async calculateSalesTrend(orders: ShopifyOrder[]): Promise<SalesTrendData[]> {
    const last30Days = moment().subtract(30, 'days');
    const trendData = new Map<string, { sales: number; orders: number; customers: Set<string> }>();

    // Initialize last 30 days
    for (let i = 0; i < 30; i++) {
      const date = moment().subtract(i, 'days').format('YYYY-MM-DD');
      trendData.set(date, { sales: 0, orders: 0, customers: new Set() });
    }

    // Aggregate orders by date
    orders
      .filter(order => moment(order.createdAt).isAfter(last30Days))
      .forEach(order => {
        const date = moment(order.createdAt).format('YYYY-MM-DD');
        const sales = parseFloat(order.totalPriceSet?.shopMoney?.amount || '0');
        const customerId = order.customer?.id;

        if (trendData.has(date)) {
          const data = trendData.get(date)!;
          data.sales += sales;
          data.orders += 1;
          if (customerId) {
            data.customers.add(customerId);
          }
        }
      });

    // Convert to array format
    return Array.from(trendData.entries())
      .map(([date, data]) => ({
        date,
        sales: data.sales,
        orders: data.orders,
        customers: data.customers.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Calculate customer metrics and insights
   */
  private async calculateCustomerMetrics(
    customers: ShopifyCustomer[],
    orders: ShopifyOrder[],
  ): Promise<CustomerMetrics> {
    const last30Days = moment().subtract(30, 'days');
    
    // Calculate new vs returning customers
    const newCustomers = customers.filter(customer => 
      moment(customer.createdAt).isAfter(last30Days)
    ).length;

    const returningCustomers = customers.filter(customer => 
      customer.numberOfOrders > 1
    ).length;

    const customerRetentionRate = customers.length > 0 ? 
      (returningCustomers / customers.length) * 100 : 0;

    // Calculate average customer lifetime value
    const totalCustomerValue = customers.reduce((sum, customer) => {
      return sum + parseFloat(customer.amountSpent?.amount || '0');
    }, 0);

    const averageCustomerLifetimeValue = customers.length > 0 ? 
      totalCustomerValue / customers.length : 0;

    // Get top customers
    const topCustomers: TopCustomer[] = customers
      .filter(customer => customer.numberOfOrders > 0)
      .map(customer => {
        const totalSpent = parseFloat(customer.amountSpent?.amount || '0');
        const orderCount = customer.numberOfOrders;
        const averageOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;

        // Find last order date
        const customerOrders = orders.filter(order => order.customer?.id === customer.id);
        const lastOrderDate = customerOrders.length > 0 ? 
          moment.max(customerOrders.map(order => moment(order.createdAt))).format('YYYY-MM-DD') : 
          'Never';

        return {
          customerId: customer.id,
          customerName: customer.displayName || `${customer.firstName} ${customer.lastName}`.trim() || 'Unknown',
          email: customer.email,
          totalSpent,
          orderCount,
          lastOrderDate,
          averageOrderValue,
        };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    return {
      newCustomers,
      returningCustomers,
      customerRetentionRate,
      averageCustomerLifetimeValue,
      topCustomers,
    };
  }

  /**
   * Calculate inventory metrics
   */
  private async calculateInventoryMetrics(products: ShopifyProduct[]): Promise<InventoryMetrics> {
    let totalVariants = 0;
    let outOfStockProducts = 0;
    let lowStockProducts = 0;
    let totalInventoryValue = 0;

    const lowStockThreshold = 10;

    products.forEach(product => {
      product.variants?.edges?.forEach(edge => {
        const variant = edge.node;
        totalVariants++;

        const stock = variant.inventoryQuantity || 0;
        const price = parseFloat(variant.price || '0');

        if (stock === 0) {
          outOfStockProducts++;
        } else if (stock <= lowStockThreshold) {
          lowStockProducts++;
        }

        totalInventoryValue += stock * price;
      });
    });

    // Calculate inventory turnover rate (simplified)
    // This would ideally use cost of goods sold over average inventory
    const inventoryTurnoverRate = 4.5; // Placeholder - would need historical data

    return {
      totalProducts: products.length,
      totalVariants,
      outOfStockProducts,
      lowStockProducts,
      totalInventoryValue,
      inventoryTurnoverRate,
    };
  }

  /**
   * Get recent orders for dashboard display
   */
  private getRecentOrders(orders: ShopifyOrder[], limit: number = 10): ShopifyOrder[] {
    return orders
      .sort((a, b) => moment(b.createdAt).valueOf() - moment(a.createdAt).valueOf())
      .slice(0, limit);
  }

  /**
   * Calculate estimated days of stock remaining
   */
  private calculateDaysOfStockRemaining(currentStock: number): number {
    // This is a simplified calculation
    // In reality, you'd use historical sales velocity
    const averageDailySales = 2; // Placeholder
    return currentStock / averageDailySales;
  }

  /**
   * Calculate period-over-period growth
   */
  async calculateGrowthMetrics(
    currentPeriodOrders: ShopifyOrder[],
    previousPeriodOrders: ShopifyOrder[],
  ) {
    const currentSales = currentPeriodOrders.reduce((sum, order) => {
      return sum + parseFloat(order.totalPriceSet?.shopMoney?.amount || '0');
    }, 0);

    const previousSales = previousPeriodOrders.reduce((sum, order) => {
      return sum + parseFloat(order.totalPriceSet?.shopMoney?.amount || '0');
    }, 0);

    const salesGrowth = previousSales > 0 ? 
      ((currentSales - previousSales) / previousSales) * 100 : 0;

    const orderGrowth = previousPeriodOrders.length > 0 ? 
      ((currentPeriodOrders.length - previousPeriodOrders.length) / previousPeriodOrders.length) * 100 : 0;

    return {
      salesGrowth,
      orderGrowth,
      currentSales,
      previousSales,
      currentOrders: currentPeriodOrders.length,
      previousOrders: previousPeriodOrders.length,
    };
  }

  /**
   * Calculate metrics for a specific time period
   */
  async calculatePeriodMetrics(
    orders: ShopifyOrder[],
    startDate: Date,
    endDate: Date,
  ) {
    const periodOrders = orders.filter(order => {
      const orderDate = moment(order.createdAt);
      return orderDate.isBetween(startDate, endDate, 'day', '[]');
    });

    const totalSales = periodOrders.reduce((sum, order) => {
      return sum + parseFloat(order.totalPriceSet?.shopMoney?.amount || '0');
    }, 0);

    const uniqueCustomers = new Set(
      periodOrders
        .map(order => order.customer?.id)
        .filter(id => id)
    ).size;

    return {
      totalSales,
      totalOrders: periodOrders.length,
      uniqueCustomers,
      averageOrderValue: periodOrders.length > 0 ? totalSales / periodOrders.length : 0,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };
  }
}
