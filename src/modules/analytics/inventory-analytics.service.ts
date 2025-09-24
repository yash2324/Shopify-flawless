import { Injectable, Logger } from '@nestjs/common';
import * as moment from 'moment';
import * as _ from 'lodash';
import {
  ShopifyProduct,
  ShopifyOrder,
  InventoryTurnoverAnalysis,
  VariantTurnoverData,
  ReorderRecommendation,
} from '@interfaces/shopify.interface';

@Injectable()
export class InventoryAnalyticsService {
  private readonly logger = new Logger(InventoryAnalyticsService.name);

  /**
   * Process inventory data and generate comprehensive analytics
   */
  async processInventoryData(products: ShopifyProduct[], orders: ShopifyOrder[]): Promise<any> {
    this.logger.log('Processing inventory analytics data');

    try {
      // EMERGENCY: Use fast version with only essential calculations
      return this.processInventoryDataFast(products, orders);
    } catch (error) {
      this.logger.error('Error processing inventory data:', error);
      throw error;
    }
  }

  /**
   * Fast inventory analytics with only essential calculations
   */
  async processInventoryDataFast(products: ShopifyProduct[], orders: ShopifyOrder[]): Promise<any> {
    this.logger.log('Processing inventory analytics (FAST MODE)');

    try {
      // Only do essential calculations, skip heavy processing
      const [
        stockLevels,
        lowStockAlerts,
        outOfStockProducts,
        inventoryValuation,
      ] = await Promise.all([
        this.calculateStockLevelsFast(products),
        this.generateLowStockAlertsFast(products),
        this.identifyOutOfStockProducts(products),
        this.calculateInventoryValuationFast(products),
      ]);

      return {
        stockLevels: stockLevels.slice(0, 50), // Limit to 50 products
        lowStockAlerts: lowStockAlerts.slice(0, 20), // Limit to 20 alerts
        outOfStockProducts: outOfStockProducts.slice(0, 20), // Limit to 20 products
        inventoryValuation,
        summary: {
          totalProducts: products.length,
          totalVariants: this.countTotalVariants(products),
          lowStockCount: lowStockAlerts.length,
          outOfStockCount: outOfStockProducts.length,
          totalInventoryValue: inventoryValuation.totalValue,
        },
        lastUpdated: new Date().toISOString(),
        mode: 'fast',
      };
    } catch (error) {
      this.logger.error('Error processing inventory data (fast):', error);
      throw error;
    }
  }

  /**
   * Original comprehensive analytics (SLOW - disabled)
   */
  async processInventoryDataComplete(products: ShopifyProduct[], orders: ShopifyOrder[]): Promise<any> {
    this.logger.log('Processing inventory analytics data (COMPLETE)');

    try {
      const [
        stockLevels,
        turnoverAnalysis,
        lowStockAlerts,
        outOfStockProducts,
        fastMovingProducts,
        slowMovingProducts,
        inventoryValuation,
        demandForecasting,
      ] = await Promise.all([
        this.calculateStockLevels(products),
        this.calculateInventoryTurnover(products, orders),
        this.generateLowStockAlerts(products, orders),
        this.identifyOutOfStockProducts(products),
        this.identifyFastMovingProducts(products, orders),
        this.identifySlowMovingProducts(products, orders),
        this.calculateInventoryValuation(products),
        this.calculateDemandForecasting(products, orders),
      ]);

      return {
        stockLevels,
        turnoverAnalysis,
        lowStockAlerts,
        outOfStockProducts,
        fastMovingProducts,
        slowMovingProducts,
        inventoryValuation,
        demandForecasting,
        summary: {
          totalProducts: products.length,
          totalVariants: this.countTotalVariants(products),
          lowStockCount: lowStockAlerts.length,
          outOfStockCount: outOfStockProducts.length,
          totalInventoryValue: inventoryValuation.totalValue,
        },
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error processing inventory data:', error);
      throw error;
    }
  }

  /**
   * Calculate current stock levels across all products
   */
  private async calculateStockLevels(products: ShopifyProduct[]) {
    const stockData = products.map(product => {
      const variants = product.variants?.edges?.map(edge => {
        const variant = edge.node;
        return {
          variantId: variant.id,
          title: variant.title,
          sku: variant.sku || 'N/A',
          currentStock: variant.inventoryQuantity || 0,
          tracked: variant.inventoryItem?.tracked || false,
          price: parseFloat(variant.price || '0'),
          stockValue: (variant.inventoryQuantity || 0) * parseFloat(variant.price || '0'),
        };
      }) || [];

      const totalStock = variants.reduce((sum, variant) => sum + variant.currentStock, 0);
      const totalValue = variants.reduce((sum, variant) => sum + variant.stockValue, 0);

      return {
        productId: product.id,
        title: product.title,
        productType: product.productType,
        vendor: product.vendor,
        totalStock,
        totalValue: Math.round(totalValue * 100) / 100,
        variants,
        status: this.determineStockStatus(totalStock, variants.length),
      };
    });

    return {
      products: stockData,
      summary: {
        totalProducts: stockData.length,
        totalStockUnits: stockData.reduce((sum, p) => sum + p.totalStock, 0),
        totalStockValue: Math.round(stockData.reduce((sum, p) => sum + p.totalValue, 0) * 100) / 100,
        lowStockProducts: stockData.filter(p => p.status === 'Low Stock').length,
        outOfStockProducts: stockData.filter(p => p.status === 'Out of Stock').length,
      },
    };
  }

  /**
   * Calculate inventory turnover analysis
   */
  private async calculateInventoryTurnover(
    products: ShopifyProduct[], 
    orders: ShopifyOrder[]
  ): Promise<InventoryTurnoverAnalysis[]> {
    // Calculate sales velocity for each variant
    const variantSalesMap = this.calculateVariantSales(orders);
    
    const turnoverAnalysis = products.map(product => {
      const variants: VariantTurnoverData[] = product.variants?.edges?.map(edge => {
        const variant = edge.node;
        const variantId = variant.id;
        const currentStock = variant.inventoryQuantity || 0;
        
        const salesData = variantSalesMap.get(variantId) || {
          lastMonth: 0,
          last3Months: 0,
          totalSold: 0,
        };

        // Calculate turnover rate (sales / average inventory)
        const averageInventory = currentStock > 0 ? currentStock : 1; // Avoid division by zero
        const turnoverRate = salesData.last3Months / 3 / averageInventory; // Monthly turnover

        // Calculate days of stock remaining
        const averageMonthlySales = salesData.last3Months / 3;
        const daysOfStockRemaining = averageMonthlySales > 0 ? 
          (currentStock / averageMonthlySales) * 30 : 999;

        return {
          variantId,
          variantTitle: variant.title,
          sku: variant.sku || 'N/A',
          currentStock,
          unitsSoldLastMonth: salesData.lastMonth,
          unitsSoldLast3Months: salesData.last3Months,
          turnoverRate: Math.round(turnoverRate * 100) / 100,
          daysOfStockRemaining: Math.round(daysOfStockRemaining),
        };
      }) || [];

      // Calculate overall product turnover
      const totalCurrentStock = variants.reduce((sum, v) => sum + v.currentStock, 0);
      const totalSoldLast3Months = variants.reduce((sum, v) => sum + v.unitsSoldLast3Months, 0);
      const overallTurnoverRate = totalCurrentStock > 0 ? 
        (totalSoldLast3Months / 3) / totalCurrentStock : 0;

      // Calculate average days in inventory
      const averageDaysInInventory = variants.length > 0 ? 
        variants.reduce((sum, v) => sum + v.daysOfStockRemaining, 0) / variants.length : 0;

      // Determine stock status
      const stockStatus = this.determineStockStatusFromTurnover(
        overallTurnoverRate, 
        averageDaysInInventory
      );

      // Generate reorder recommendation
      const reorderRecommendation = this.generateReorderRecommendation(
        variants,
        stockStatus,
        overallTurnoverRate
      );

      return {
        productId: product.id,
        productTitle: product.title,
        variants,
        overallTurnoverRate: Math.round(overallTurnoverRate * 100) / 100,
        daysInInventory: Math.round(averageDaysInInventory),
        stockStatus,
        reorderRecommendation,
      };
    });

    return turnoverAnalysis.sort((a, b) => b.overallTurnoverRate - a.overallTurnoverRate);
  }

  /**
   * Generate low stock alerts
   */
  private async generateLowStockAlerts(products: ShopifyProduct[], orders: ShopifyOrder[]) {
    const lowStockThreshold = 10;
    const criticalStockThreshold = 5;
    const variantSalesMap = this.calculateVariantSales(orders);

    const alerts: any[] = [];

    products.forEach(product => {
      product.variants?.edges?.forEach(edge => {
        const variant = edge.node;
        const currentStock = variant.inventoryQuantity || 0;

        if (currentStock <= lowStockThreshold && variant.inventoryItem?.tracked) {
          const salesData = variantSalesMap.get(variant.id) || { lastMonth: 0, last3Months: 0, totalSold: 0 };
          const averageMonthlySales = salesData.last3Months / 3;
          const daysOfStockRemaining = averageMonthlySales > 0 ? 
            (currentStock / averageMonthlySales) * 30 : 999;

          let urgency: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
          if (currentStock <= criticalStockThreshold) urgency = 'Critical';
          else if (daysOfStockRemaining <= 7) urgency = 'High';
          else if (daysOfStockRemaining <= 14) urgency = 'Medium';

          alerts.push({
            productId: product.id,
            productTitle: product.title,
            variantId: variant.id,
            variantTitle: variant.title,
            sku: variant.sku || 'N/A',
            currentStock,
            averageMonthlySales: Math.round(averageMonthlySales * 100) / 100,
            daysOfStockRemaining: Math.round(daysOfStockRemaining),
            urgency,
            recommendedReorderQuantity: Math.max(
              lowStockThreshold * 2, 
              Math.ceil(averageMonthlySales * 2)
            ), // 2 months of stock
            productType: product.productType,
            vendor: product.vendor,
          });
        }
      });
    });

    return alerts.sort((a, b) => {
      const urgencyOrder = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
    });
  }

  /**
   * Identify out of stock products
   */
  private async identifyOutOfStockProducts(products: ShopifyProduct[]) {
    const outOfStockProducts: any[] = [];

    products.forEach(product => {
      const outOfStockVariants = product.variants?.edges?.filter(edge => {
        const variant = edge.node;
        return (variant.inventoryQuantity || 0) === 0 && variant.inventoryItem?.tracked;
      }) || [];

      if (outOfStockVariants.length > 0) {
        outOfStockProducts.push({
          productId: product.id,
          productTitle: product.title,
          productType: product.productType,
          vendor: product.vendor,
          outOfStockVariants: outOfStockVariants.map(edge => ({
            variantId: edge.node.id,
            variantTitle: edge.node.title,
            sku: edge.node.sku || 'N/A',
            price: parseFloat(edge.node.price || '0'),
          })),
          totalVariants: product.variants?.edges?.length || 0,
          percentageOutOfStock: Math.round((outOfStockVariants.length / (product.variants?.edges?.length || 1)) * 10000) / 100,
        });
      }
    });

    return outOfStockProducts.sort((a, b) => b.percentageOutOfStock - a.percentageOutOfStock);
  }

  /**
   * Identify fast-moving products
   */
  private async identifyFastMovingProducts(products: ShopifyProduct[], orders: ShopifyOrder[]) {
    const variantSalesMap = this.calculateVariantSales(orders);
    const fastMovingProducts: any[] = [];

    products.forEach(product => {
      let totalSalesLast3Months = 0;
      let totalCurrentStock = 0;

      product.variants?.edges?.forEach(edge => {
        const variant = edge.node;
        const salesData = variantSalesMap.get(variant.id) || { last3Months: 0 };
        totalSalesLast3Months += salesData.last3Months;
        totalCurrentStock += variant.inventoryQuantity || 0;
      });

      const turnoverRate = totalCurrentStock > 0 ? 
        (totalSalesLast3Months / 3) / totalCurrentStock : 0;

      // Consider fast-moving if turnover rate > 1 (selling more than current stock per month)
      if (turnoverRate > 1) {
        fastMovingProducts.push({
          productId: product.id,
          productTitle: product.title,
          productType: product.productType,
          vendor: product.vendor,
          turnoverRate: Math.round(turnoverRate * 100) / 100,
          unitsSoldLast3Months: totalSalesLast3Months,
          currentStock: totalCurrentStock,
          averageMonthlySales: Math.round((totalSalesLast3Months / 3) * 100) / 100,
        });
      }
    });

    return fastMovingProducts.sort((a, b) => b.turnoverRate - a.turnoverRate).slice(0, 20);
  }

  /**
   * Identify slow-moving products
   */
  private async identifySlowMovingProducts(products: ShopifyProduct[], orders: ShopifyOrder[]) {
    const variantSalesMap = this.calculateVariantSales(orders);
    const slowMovingProducts: any[] = [];

    products.forEach(product => {
      let totalSalesLast3Months = 0;
      let totalCurrentStock = 0;
      let hasTrackedVariants = false;

      product.variants?.edges?.forEach(edge => {
        const variant = edge.node;
        if (variant.inventoryItem?.tracked) {
          hasTrackedVariants = true;
          const salesData = variantSalesMap.get(variant.id) || { last3Months: 0 };
          totalSalesLast3Months += salesData.last3Months;
          totalCurrentStock += variant.inventoryQuantity || 0;
        }
      });

      if (hasTrackedVariants && totalCurrentStock > 0) {
        const turnoverRate = (totalSalesLast3Months / 3) / totalCurrentStock;

        // Consider slow-moving if turnover rate < 0.1 and have stock
        if (turnoverRate < 0.1 && totalCurrentStock > 5) {
          const daysOfStock = totalSalesLast3Months > 0 ? 
            (totalCurrentStock / (totalSalesLast3Months / 90)) : 999;

          slowMovingProducts.push({
            productId: product.id,
            productTitle: product.title,
            productType: product.productType,
            vendor: product.vendor,
            turnoverRate: Math.round(turnoverRate * 100) / 100,
            unitsSoldLast3Months: totalSalesLast3Months,
            currentStock: totalCurrentStock,
            daysOfStock: Math.round(daysOfStock),
            potentialDeadStock: daysOfStock > 180,
            averageMonthlySales: Math.round((totalSalesLast3Months / 3) * 100) / 100,
          });
        }
      }
    });

    return slowMovingProducts.sort((a, b) => a.turnoverRate - b.turnoverRate).slice(0, 20);
  }

  /**
   * Calculate inventory valuation
   */
  private async calculateInventoryValuation(products: ShopifyProduct[]) {
    let totalValue = 0;
    let totalUnits = 0;
    const categoryBreakdown = new Map<string, { value: number; units: number }>();

    products.forEach(product => {
      const category = product.productType || 'Uncategorized';
      
      if (!categoryBreakdown.has(category)) {
        categoryBreakdown.set(category, { value: 0, units: 0 });
      }

      let productValue = 0;
      let productUnits = 0;

      product.variants?.edges?.forEach(edge => {
        const variant = edge.node;
        const stock = variant.inventoryQuantity || 0;
        const price = parseFloat(variant.price || '0');
        const value = stock * price;

        productValue += value;
        productUnits += stock;
        totalValue += value;
        totalUnits += stock;

        const categoryData = categoryBreakdown.get(category)!;
        categoryData.value += value;
        categoryData.units += stock;
      });
    });

    const categoryAnalysis = Array.from(categoryBreakdown.entries())
      .map(([category, data]) => ({
        category,
        totalValue: Math.round(data.value * 100) / 100,
        totalUnits: data.units,
        averageUnitValue: data.units > 0 ? Math.round((data.value / data.units) * 100) / 100 : 0,
        percentageOfTotalValue: totalValue > 0 ? Math.round((data.value / totalValue) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.totalValue - a.totalValue);

    return {
      totalValue: Math.round(totalValue * 100) / 100,
      totalUnits,
      averageUnitValue: totalUnits > 0 ? Math.round((totalValue / totalUnits) * 100) / 100 : 0,
      categoryBreakdown: categoryAnalysis,
    };
  }

  /**
   * Calculate demand forecasting
   */
  private async calculateDemandForecasting(products: ShopifyProduct[], orders: ShopifyOrder[]) {
    const variantSalesMap = this.calculateVariantSales(orders);
    const forecasts: any[] = [];

    products.forEach(product => {
      product.variants?.edges?.forEach(edge => {
        const variant = edge.node;
        const salesData = variantSalesMap.get(variant.id) || {
          lastMonth: 0,
          last3Months: 0,
          totalSold: 0,
        };

        if (salesData.last3Months > 0) {
          const averageMonthlySales = salesData.last3Months / 3;
          const growthRate = salesData.lastMonth > 0 ? 
            (salesData.lastMonth - (salesData.last3Months / 3)) / (salesData.last3Months / 3) : 0;

          // Simple linear forecasting
          const nextMonthForecast = averageMonthlySales * (1 + growthRate);
          const next3MonthsForecast = nextMonthForecast * 3;

          const currentStock = variant.inventoryQuantity || 0;
          const stockoutRisk = currentStock < nextMonthForecast;

          forecasts.push({
            productId: product.id,
            productTitle: product.title,
            variantId: variant.id,
            variantTitle: variant.title,
            sku: variant.sku || 'N/A',
            currentStock,
            averageMonthlySales: Math.round(averageMonthlySales * 100) / 100,
            nextMonthForecast: Math.round(nextMonthForecast * 100) / 100,
            next3MonthsForecast: Math.round(next3MonthsForecast * 100) / 100,
            growthRate: Math.round(growthRate * 10000) / 100,
            stockoutRisk,
            recommendedOrderQuantity: stockoutRisk ? 
              Math.ceil(next3MonthsForecast - currentStock) : 0,
          });
        }
      });
    });

    return forecasts
      .filter(f => f.averageMonthlySales > 0)
      .sort((a, b) => b.nextMonthForecast - a.nextMonthForecast)
      .slice(0, 50);
  }

  // Helper methods
  private calculateVariantSales(orders: ShopifyOrder[]) {
    const variantSalesMap = new Map<string, {
      lastMonth: number;
      last3Months: number;
      totalSold: number;
    }>();

    const now = moment();
    const lastMonth = now.clone().subtract(1, 'month');
    const last3Months = now.clone().subtract(3, 'months');

    orders.forEach(order => {
      const orderDate = moment(order.createdAt);
      
      order.lineItems?.edges?.forEach(edge => {
        const item = edge.node;
        const variantId = item.variant?.id;
        
        if (variantId) {
          if (!variantSalesMap.has(variantId)) {
            variantSalesMap.set(variantId, {
              lastMonth: 0,
              last3Months: 0,
              totalSold: 0,
            });
          }

          const data = variantSalesMap.get(variantId)!;
          const quantity = item.quantity || 0;

          data.totalSold += quantity;

          if (orderDate.isAfter(last3Months)) {
            data.last3Months += quantity;
          }

          if (orderDate.isAfter(lastMonth)) {
            data.lastMonth += quantity;
          }
        }
      });
    });

    return variantSalesMap;
  }

  private determineStockStatus(totalStock: number, variantCount: number): string {
    if (totalStock === 0) return 'Out of Stock';
    if (totalStock <= 10) return 'Low Stock';
    if (totalStock <= 50) return 'Medium Stock';
    return 'Well Stocked';
  }

  private determineStockStatusFromTurnover(
    turnoverRate: number, 
    daysInInventory: number
  ): 'Optimal' | 'Overstocked' | 'Understocked' | 'Out of Stock' {
    if (daysInInventory === 0) return 'Out of Stock';
    if (turnoverRate > 2) return 'Understocked';
    if (turnoverRate >= 0.5) return 'Optimal';
    return 'Overstocked';
  }

  private generateReorderRecommendation(
    variants: VariantTurnoverData[],
    stockStatus: string,
    turnoverRate: number
  ): ReorderRecommendation {
    const totalCurrentStock = variants.reduce((sum, v) => sum + v.currentStock, 0);
    const averageMonthlySales = variants.reduce((sum, v) => sum + v.unitsSoldLast3Months, 0) / 3;

    let shouldReorder = false;
    let urgencyLevel: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
    let recommendedQuantity = 0;
    let reasoning = 'Stock levels are adequate';

    if (stockStatus === 'Out of Stock') {
      shouldReorder = true;
      urgencyLevel = 'Critical';
      recommendedQuantity = Math.ceil(averageMonthlySales * 3); // 3 months supply
      reasoning = 'Product is out of stock';
    } else if (stockStatus === 'Understocked' || turnoverRate > 1.5) {
      shouldReorder = true;
      urgencyLevel = 'High';
      recommendedQuantity = Math.ceil(averageMonthlySales * 2); // 2 months supply
      reasoning = 'High demand, low stock levels';
    } else if (totalCurrentStock < averageMonthlySales) {
      shouldReorder = true;
      urgencyLevel = 'Medium';
      recommendedQuantity = Math.ceil(averageMonthlySales * 1.5); // 1.5 months supply
      reasoning = 'Stock below monthly sales rate';
    }

    return {
      shouldReorder,
      recommendedQuantity,
      urgencyLevel,
      reasoning,
    };
  }

  private countTotalVariants(products: ShopifyProduct[]): number {
    return products.reduce((sum, product) => {
      return sum + (product.variants?.edges?.length || 0);
    }, 0);
  }

  // Fast calculation methods for performance

  /**
   * Fast stock levels calculation (simplified)
   */
  private async calculateStockLevelsFast(products: ShopifyProduct[]) {
    return products
      .slice(0, 50) // Max 50 products
      .map(product => {
        const totalStock = product.variants?.edges?.reduce((sum, variantEdge) => {
          return sum + (variantEdge.node.inventoryQuantity || 0);
        }, 0) || 0;

        return {
          productId: product.id,
          productTitle: product.title,
          totalStock,
          status: this.determineStockStatus(totalStock, product.variants?.edges?.length || 0),
          variantCount: product.variants?.edges?.length || 0,
        };
      })
      .sort((a, b) => a.totalStock - b.totalStock);
  }

  /**
   * Fast low stock alerts (simplified)
   */
  public async generateLowStockAlertsFast(products: ShopifyProduct[]) {
    return products
      .filter(product => {
        const totalStock = product.variants?.edges?.reduce((sum, variantEdge) => {
          return sum + (variantEdge.node.inventoryQuantity || 0);
        }, 0) || 0;
        return totalStock <= 10 && totalStock > 0; // Low stock threshold
      })
      .slice(0, 20) // Max 20 alerts
      .map(product => {
        const totalStock = product.variants?.edges?.reduce((sum, variantEdge) => {
          return sum + (variantEdge.node.inventoryQuantity || 0);
        }, 0) || 0;

        return {
          productId: product.id,
          productTitle: product.title,
          currentStock: totalStock,
          recommendedReorder: Math.max(50, totalStock * 3), // Simple reorder calculation
          priority: totalStock <= 5 ? 'HIGH' : 'MEDIUM',
          daysOfStockLeft: Math.max(1, Math.floor(totalStock / 2)), // Simplified estimate
        };
      });
  }

  /**
   * Fast inventory valuation (simplified)
   */
  private async calculateInventoryValuationFast(products: ShopifyProduct[]) {
    let totalValue = 0;
    let totalUnits = 0;

    products.forEach(product => {
      product.variants?.edges?.forEach(variantEdge => {
        const variant = variantEdge.node;
        const quantity = variant.inventoryQuantity || 0;
        const price = parseFloat(variant.price || '0');
        
        totalValue += quantity * price;
        totalUnits += quantity;
      });
    });

    return {
      totalValue: Math.round(totalValue * 100) / 100,
      totalUnits,
      averageValuePerUnit: totalUnits > 0 ? Math.round((totalValue / totalUnits) * 100) / 100 : 0,
      currency: 'USD', // Simplified
    };
  }
}
