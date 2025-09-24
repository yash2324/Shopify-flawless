import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShopifyGraphQLService } from './shopify-graphql.service';
import {
  ShopifyOrder,
  ShopifyProduct,
  ShopifyCustomer,
  PaginationOptions,
  QueryFilters,
  APIError,
} from '@interfaces/shopify.interface';

@Injectable()
export class ShopifyService {
  private readonly logger = new Logger(ShopifyService.name);

  constructor(
    private readonly graphqlService: ShopifyGraphQLService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get cache-friendly time window for data fetching
   */
  private getOptimizedTimeWindow(requestedHours: number): number {
    // Cap large requests to prevent performance issues
    if (requestedHours > 2160) return 2160; // Max 90 days
    if (requestedHours > 720) return 720;   // Max 30 days for heavy queries
    return requestedHours;
  }

  /**
   * Fetch all orders with automatic pagination
   */
  async fetchAllOrders(filters: QueryFilters = {}): Promise<ShopifyOrder[]> {
    const allOrders: ShopifyOrder[] = [];
    let hasNextPage = true;
    let cursor: string | undefined;
    let retryCount = 0;
    const maxRetries = 3;

    this.logger.log('Starting to fetch all orders from Shopify');

    while (hasNextPage && retryCount < maxRetries) {
      try {
        const pagination: PaginationOptions = {
          first: 50,
          after: cursor,
        };

        const response = await this.graphqlService.getOrders(pagination, filters);
        
        if (!response.orders?.edges) {
          this.logger.warn('No orders found in response');
          break;
        }

        const orders = response.orders.edges.map(edge => edge.node);
        allOrders.push(...orders);

        hasNextPage = response.orders.pageInfo.hasNextPage;
        cursor = response.orders.pageInfo.endCursor;

        this.logger.debug(`Fetched ${orders.length} orders, total: ${allOrders.length}`);

        // Add delay to respect rate limits
        if (hasNextPage) {
          await this.delay(200);
        }

        retryCount = 0; // Reset retry count on success
      } catch (error) {
        retryCount++;
        this.logger.error(`Error fetching orders (attempt ${retryCount}):`, error);

        if (error instanceof APIError && error.isRetryable && retryCount < maxRetries) {
          await this.delay(1000 * retryCount); // Exponential backoff
          continue;
        }

        if (retryCount >= maxRetries) {
          this.logger.error('Max retries reached, stopping order fetch');
          break;
        }

        throw error;
      }
    }

    this.logger.log(`Successfully fetched ${allOrders.length} orders`);
    return allOrders;
  }

  /**
   * Fetch products with emergency limits for performance
   */
  async fetchAllProducts(): Promise<ShopifyProduct[]> {
    // EMERGENCY: Cap products to prevent performance issues  
    return this.fetchLimitedProducts(300); // Max 300 products instead of 3635
  }

  /**
   * Fetch limited products for performance-critical operations
   */
  async fetchLimitedProducts(maxProducts: number = 200): Promise<ShopifyProduct[]> {
    const products: ShopifyProduct[] = [];
    let hasNextPage = true;
    let cursor: string | undefined;
    let retryCount = 0;
    const maxRetries = 2;
    const pageSize = 50;

    this.logger.log(`Fetching limited products (max: ${maxProducts})`);

    while (hasNextPage && products.length < maxProducts && retryCount < maxRetries) {
      try {
        const pagination: PaginationOptions = {
          first: Math.min(pageSize, maxProducts - products.length),
          after: cursor,
        };

        const response = await this.graphqlService.getProducts(pagination);
        
        if (!response.products?.edges) {
          this.logger.warn('No products found in response');
          break;
        }

        const fetchedProducts = response.products.edges.map(edge => edge.node);
        products.push(...fetchedProducts);

        hasNextPage = response.products.pageInfo.hasNextPage && products.length < maxProducts;
        cursor = response.products.pageInfo.endCursor;

        this.logger.debug(`Fetched ${fetchedProducts.length} products, total: ${products.length}/${maxProducts}`);

        if (hasNextPage && products.length < maxProducts) {
          await this.delay(50);
        }

        retryCount = 0;
      } catch (error) {
        retryCount++;
        this.logger.error(`Error fetching limited products (attempt ${retryCount}):`, error);

        if (retryCount >= maxRetries) {
          this.logger.error('Max retries reached for products, returning partial data');
          break;
        }

        await this.delay(500 * retryCount);
      }
    }

    this.logger.log(`Successfully fetched ${products.length} limited products`);
    return products;
  }

  /**
   * Fetch all products with automatic pagination (ORIGINAL - SLOW)
   */
  async fetchAllProductsOriginal(): Promise<ShopifyProduct[]> {
    const allProducts: ShopifyProduct[] = [];
    let hasNextPage = true;
    let cursor: string | undefined;
    let retryCount = 0;
    const maxRetries = 3;

    this.logger.log('Starting to fetch all products from Shopify');

    while (hasNextPage && retryCount < maxRetries) {
      try {
        const pagination: PaginationOptions = {
          first: 50,
          after: cursor,
        };

        const response = await this.graphqlService.getProducts(pagination);
        
        if (!response.products?.edges) {
          this.logger.warn('No products found in response');
          break;
        }

        const products = response.products.edges.map(edge => edge.node);
        allProducts.push(...products);

        hasNextPage = response.products.pageInfo.hasNextPage;
        cursor = response.products.pageInfo.endCursor;

        this.logger.debug(`Fetched ${products.length} products, total: ${allProducts.length}`);

        // Add delay to respect rate limits
        if (hasNextPage) {
          await this.delay(200);
        }

        retryCount = 0; // Reset retry count on success
      } catch (error) {
        retryCount++;
        this.logger.error(`Error fetching products (attempt ${retryCount}):`, error);

        if (error instanceof APIError && error.isRetryable && retryCount < maxRetries) {
          await this.delay(1000 * retryCount); // Exponential backoff
          continue;
        }

        if (retryCount >= maxRetries) {
          this.logger.error('Max retries reached, stopping product fetch');
          break;
        }

        throw error;
      }
    }

    this.logger.log(`Successfully fetched ${allProducts.length} products`);
    return allProducts;
  }

  /**
   * Fetch customers with emergency limits for performance
   */
  async fetchAllCustomers(): Promise<ShopifyCustomer[]> {
    // EMERGENCY: Cap customers to prevent performance issues
    return this.fetchLimitedCustomers(500); // Max 500 customers instead of 6593
  }

  /**
   * Fetch limited customers for performance-critical operations
   */
  async fetchLimitedCustomers(maxCustomers: number = 200): Promise<ShopifyCustomer[]> {
    const customers: ShopifyCustomer[] = [];
    let hasNextPage = true;
    let cursor: string | undefined;
    let retryCount = 0;
    const maxRetries = 2; // Reduced retries
    const pageSize = 50;

    this.logger.log(`Fetching limited customers (max: ${maxCustomers})`);

    while (hasNextPage && customers.length < maxCustomers && retryCount < maxRetries) {
      try {
        const pagination: PaginationOptions = {
          first: Math.min(pageSize, maxCustomers - customers.length),
          after: cursor,
        };

        const response = await this.graphqlService.getCustomers(pagination);
        
        if (!response.customers?.edges) {
          this.logger.warn('No customers found in response');
          break;
        }

        const fetchedCustomers = response.customers.edges.map(edge => edge.node);
        customers.push(...fetchedCustomers);

        hasNextPage = response.customers.pageInfo.hasNextPage && customers.length < maxCustomers;
        cursor = response.customers.pageInfo.endCursor;

        this.logger.debug(`Fetched ${fetchedCustomers.length} customers, total: ${customers.length}/${maxCustomers}`);

        // Minimal delay for limited requests
        if (hasNextPage && customers.length < maxCustomers) {
          await this.delay(50);
        }

        retryCount = 0;
      } catch (error) {
        retryCount++;
        this.logger.error(`Error fetching limited customers (attempt ${retryCount}):`, error);

        if (retryCount >= maxRetries) {
          this.logger.error('Max retries reached for customers, returning partial data');
          break;
        }

        await this.delay(500 * retryCount);
      }
    }

    this.logger.log(`Successfully fetched ${customers.length} limited customers`);
    return customers;
  }

  /**
   * Fetch all customers with automatic pagination (ORIGINAL - SLOW)
   */
  async fetchAllCustomersOriginal(): Promise<ShopifyCustomer[]> {
    const allCustomers: ShopifyCustomer[] = [];
    let hasNextPage = true;
    let cursor: string | undefined;
    let retryCount = 0;
    const maxRetries = 3;

    this.logger.log('Starting to fetch all customers from Shopify');

    while (hasNextPage && retryCount < maxRetries) {
      try {
        const pagination: PaginationOptions = {
          first: 50,
          after: cursor,
        };

        const response = await this.graphqlService.getCustomers(pagination);
        
        if (!response.customers?.edges) {
          this.logger.warn('No customers found in response');
          break;
        }

        const customers = response.customers.edges.map(edge => edge.node);
        allCustomers.push(...customers);

        hasNextPage = response.customers.pageInfo.hasNextPage;
        cursor = response.customers.pageInfo.endCursor;

        this.logger.debug(`Fetched ${customers.length} customers, total: ${allCustomers.length}`);

        // Add delay to respect rate limits
        if (hasNextPage) {
          await this.delay(200);
        }

        retryCount = 0; // Reset retry count on success
      } catch (error) {
        retryCount++;
        this.logger.error(`Error fetching customers (attempt ${retryCount}):`, error);

        if (error instanceof APIError && error.isRetryable && retryCount < maxRetries) {
          await this.delay(1000 * retryCount); // Exponential backoff
          continue;
        }

        if (retryCount >= maxRetries) {
          this.logger.error('Max retries reached, stopping customer fetch');
          break;
        }

        throw error;
      }
    }

    this.logger.log(`Successfully fetched ${allCustomers.length} customers`);
    return allCustomers;
  }

  /**
   * Fetch recent orders with intelligent optimization
   */
  async fetchRecentOrders(hours: number = 24): Promise<ShopifyOrder[]> {
    const optimizedHours = this.getOptimizedTimeWindow(hours);
    const sinceDate = new Date(Date.now() - optimizedHours * 60 * 60 * 1000);
    
    this.logger.log(`Fetching orders from last ${optimizedHours} hours (requested: ${hours})`);
    
    const filters: QueryFilters = {
      createdAtMin: sinceDate.toISOString(),
    };

    // For analytics, we often don't need ALL data - sample intelligently
    if (optimizedHours <= 24) {
      return this.fetchLimitedOrders(filters, 200); // Last 200 orders for recent data
    } else if (optimizedHours <= 168) { // 1 week
      return this.fetchLimitedOrders(filters, 500); // Last 500 orders for weekly data
    }

    return this.fetchAllOrders(filters);
  }

  /**
   * Fetch limited number of orders for performance-critical operations
   */
  async fetchLimitedOrders(filters: QueryFilters = {}, maxOrders: number = 200): Promise<ShopifyOrder[]> {
    const orders: ShopifyOrder[] = [];
    let hasNextPage = true;
    let cursor: string | undefined;
    let retryCount = 0;
    const maxRetries = 3;
    const pageSize = 50; // Shopify's max per page

    this.logger.log(`Fetching limited orders (max: ${maxOrders})`);

    while (hasNextPage && orders.length < maxOrders && retryCount < maxRetries) {
      try {
        const pagination: PaginationOptions = {
          first: Math.min(pageSize, maxOrders - orders.length),
          after: cursor,
        };

        const response = await this.graphqlService.getOrders(pagination, filters);
        
        if (!response.orders?.edges) {
          this.logger.warn('No orders found in response');
          break;
        }

        const fetchedOrders = response.orders.edges.map(edge => edge.node);
        orders.push(...fetchedOrders);

        hasNextPage = response.orders.pageInfo.hasNextPage && orders.length < maxOrders;
        cursor = response.orders.pageInfo.endCursor;

        this.logger.debug(`Fetched ${fetchedOrders.length} orders, total: ${orders.length}/${maxOrders}`);

        // Respect rate limits with minimal delay
        if (hasNextPage && orders.length < maxOrders) {
          await this.delay(100);
        }

        retryCount = 0;
      } catch (error) {
        retryCount++;
        this.logger.error(`Error fetching limited orders (attempt ${retryCount}):`, error);

        if (error instanceof APIError && error.isRetryable && retryCount < maxRetries) {
          await this.delay(1000 * retryCount);
          continue;
        }

        if (retryCount >= maxRetries) {
          this.logger.error('Max retries reached for limited orders, returning partial data');
          break;
        }

        throw error;
      }
    }

    this.logger.log(`Successfully fetched ${orders.length} limited orders`);
    return orders;
  }

  /**
   * Fetch orders for a specific date range
   */
  async fetchOrdersByDateRange(startDate: Date, endDate: Date): Promise<ShopifyOrder[]> {
    const filters: QueryFilters = {
      createdAtMin: startDate.toISOString(),
      createdAtMax: endDate.toISOString(),
    };

    return this.fetchAllOrders(filters);
  }

  /**
   * Fetch limited orders by date range for performance
   */
  async fetchLimitedOrdersByDateRange(startDate: Date, endDate: Date, limit: number): Promise<ShopifyOrder[]> {
    const filters: QueryFilters = {
      createdAtMin: startDate.toISOString(),
      createdAtMax: endDate.toISOString(),
    };

    return this.fetchLimitedOrders(filters, limit);
  }

  /**
   * Fetch unfulfilled orders
   */
  async fetchUnfulfilledOrders(): Promise<ShopifyOrder[]> {
    const filters: QueryFilters = {
      displayFulfillmentStatus: 'unfulfilled',
    };

    return this.fetchAllOrders(filters);
  }

  /**
   * Fetch orders by financial status
   */
  async fetchOrdersByFinancialStatus(status: string): Promise<ShopifyOrder[]> {
    const filters: QueryFilters = {
      displayFinancialStatus: status,
    };

    return this.fetchAllOrders(filters);
  }

  /**
   * Get daily sales data
   */
  async getDailySalesData(date?: string): Promise<ShopifyOrder[]> {
    try {
      const response = await this.graphqlService.getDailySalesData(date);
      return response.orders?.edges?.map(edge => edge.node) || [];
    } catch (error) {
      this.logger.error('Error fetching daily sales data:', error);
      throw error;
    }
  }

  /**
   * Get sales representative performance data
   */
  async getSalesRepPerformanceData(): Promise<ShopifyOrder[]> {
    try {
      const response = await this.graphqlService.getSalesRepPerformance();
      return response.orders?.edges?.map(edge => edge.node) || [];
    } catch (error) {
      this.logger.error('Error fetching sales rep performance data:', error);
      throw error;
    }
  }

  /**
   * Get customer profitability data
   */
  async getCustomerProfitabilityData(): Promise<ShopifyCustomer[]> {
    try {
      const response = await this.graphqlService.getCustomerProfitabilityData();
      return response.customers?.edges?.map(edge => edge.node) || [];
    } catch (error) {
      this.logger.error('Error fetching customer profitability data:', error);
      throw error;
    }
  }

  /**
   * Get stock levels
   */
  async getStockLevels(): Promise<ShopifyProduct[]> {
    try {
      const response = await this.graphqlService.getStockLevels();
      return response.products?.edges?.map(edge => edge.node) || [];
    } catch (error) {
      this.logger.error('Error fetching stock levels:', error);
      throw error;
    }
  }

  /**
   * Get top-selling products
   */
  async getTopSellingProducts(dateFilter?: string): Promise<ShopifyOrder[]> {
    try {
      const response = await this.graphqlService.getTopSellingProducts(dateFilter);
      return response.orders?.edges?.map(edge => edge.node) || [];
    } catch (error) {
      this.logger.error('Error fetching top-selling products:', error);
      throw error;
    }
  }

  /**
   * Get outstanding orders
   */
  async getOutstandingOrders(): Promise<ShopifyOrder[]> {
    try {
      const response = await this.graphqlService.getOutstandingOrders();
      return response.orders?.edges?.map(edge => edge.node) || [];
    } catch (error) {
      this.logger.error('Error fetching outstanding orders:', error);
      throw error;
    }
  }

  /**
   * Get shipped orders
   */
  async getShippedOrders(): Promise<ShopifyOrder[]> {
    try {
      const response = await this.graphqlService.getShippedOrders();
      return response.orders?.edges?.map(edge => edge.node) || [];
    } catch (error) {
      this.logger.error('Error fetching shipped orders:', error);
      throw error;
    }
  }

  /**
   * Health check for Shopify API connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to fetch a minimal amount of data to test connectivity
      const response = await this.graphqlService.getOrders({ first: 1 });
      return response.orders !== undefined;
    } catch (error) {
      this.logger.error('Shopify API health check failed:', error);
      return false;
    }
  }

  /**
   * Get API usage statistics
   */
  async getAPIUsageStats(): Promise<any> {
    try {
      // This would ideally return the last known API cost information
      // For now, we'll return a placeholder
      return {
        lastQueryCost: 0,
        availableCredits: 0,
        maxCredits: 0,
        restoreRate: 0,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error getting API usage stats:', error);
      return null;
    }
  }

  /**
   * Utility method to add delay between API calls
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate that required Shopify configuration is present
   */
  validateConfiguration(): boolean {
    const shopifyConfig = this.configService.get('config.shopify');
    
    if (!shopifyConfig.shopDomain) {
      this.logger.error('Shopify shop domain is not configured');
      return false;
    }

    if (!shopifyConfig.accessToken) {
      this.logger.error('Shopify access token is not configured');
      return false;
    }

    if (!shopifyConfig.graphqlEndpoint) {
      this.logger.error('Shopify GraphQL endpoint is not configured');
      return false;
    }

    return true;
  }
}
