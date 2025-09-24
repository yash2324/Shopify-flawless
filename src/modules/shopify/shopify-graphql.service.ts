import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import {
  ShopifyResponse,
  ShopifyAPIOptions,
  OrdersQueryResponse,
  ProductsQueryResponse,
  CustomersQueryResponse,
  PaginationOptions,
  QueryFilters,
  APIError,
} from '@interfaces/shopify.interface';

@Injectable()
export class ShopifyGraphQLService {
  private readonly logger = new Logger(ShopifyGraphQLService.name);
  private readonly shopifyConfig: any;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.shopifyConfig = this.configService.get('config.shopify');
  }

  /**
   * Execute GraphQL query against Shopify API
   */
  async executeQuery<T>(options: ShopifyAPIOptions): Promise<ShopifyResponse<T>> {
    try {
      const response: AxiosResponse<ShopifyResponse<T>> = await firstValueFrom(
        this.httpService.post(
          this.shopifyConfig.graphqlEndpoint,
          {
            query: options.query,
            variables: options.variables || {},
            operationName: options.operationName,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': this.shopifyConfig.accessToken,
            },
          },
        ),
      );

      if (response.data.errors && response.data.errors.length > 0) {
        this.logger.error('GraphQL errors:', response.data.errors);
        throw new APIError(`GraphQL Error: ${response.data.errors[0].message}`);
      }

      // Log API cost information if available
      if (response.data.extensions?.cost) {
        const cost = response.data.extensions.cost;
        this.logger.debug(
          `API Cost - Requested: ${cost.requestedQueryCost}, Actual: ${cost.actualQueryCost}, Available: ${cost.throttleStatus.currentlyAvailable}/${cost.throttleStatus.maximumAvailable}`,
        );
      }

      return response.data;
    } catch (error) {
      this.logger.error('GraphQL query failed:', error);
      if (error.response?.status === 429) {
        throw new APIError('Rate limit exceeded', 429, true);
      }
      throw error;
    }
  }

  /**
   * Get orders with pagination and filters
   */
  async getOrders(
    pagination: PaginationOptions = {},
    filters: QueryFilters = {},
  ): Promise<OrdersQueryResponse> {
    const query = this.buildOrdersQuery(pagination, filters);
    const variables = this.buildOrdersVariables(pagination, filters);

    const response = await this.executeQuery<OrdersQueryResponse>({
      query,
      variables,
      operationName: 'GetOrders',
    });

    return response.data;
  }

  /**
   * Get products with pagination
   */
  async getProducts(pagination: PaginationOptions = {}): Promise<ProductsQueryResponse> {
    const query = this.buildProductsQuery(pagination);
    const variables = this.buildProductsVariables(pagination);

    const response = await this.executeQuery<ProductsQueryResponse>({
      query,
      variables,
      operationName: 'GetProducts',
    });

    return response.data;
  }

  /**
   * Get customers with pagination
   */
  async getCustomers(pagination: PaginationOptions = {}): Promise<CustomersQueryResponse> {
    const query = this.buildCustomersQuery(pagination);
    const variables = this.buildCustomersVariables(pagination);

    const response = await this.executeQuery<CustomersQueryResponse>({
      query,
      variables,
      operationName: 'GetCustomers',
    });

    return response.data;
  }

  /**
   * Get daily sales dashboard data
   */
  async getDailySalesData(dateFilter?: string): Promise<OrdersQueryResponse> {
    const query = `
      query GetDailySales($first: Int!, $query: String) {
        orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              name
              createdAt
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              lineItems(first: 50) {
                edges {
                  node {
                    title
                    sku
                    quantity
                    variant {
                      product {
                        productType
                        vendor
                      }
                    }
                  }
                }
              }
              customer {
                id
                displayName
                email
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `;

    const variables = {
      first: 50,
      query: dateFilter || `created_at:>=${new Date().toISOString().split('T')[0]}`,
    };

    const response = await this.executeQuery<OrdersQueryResponse>({
      query,
      variables,
      operationName: 'GetDailySales',
    });

    return response.data;
  }

  /**
   * Get sales representative performance data
   */
  async getSalesRepPerformance(): Promise<OrdersQueryResponse> {
    const query = `
      query GetSalesRepPerformance($first: Int!) {
        orders(first: $first, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              name
              createdAt
              tags
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              customer {
                id
                displayName
                email
                tags
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `;

    const response = await this.executeQuery<OrdersQueryResponse>({
      query,
      variables: { first: 100 },
      operationName: 'GetSalesRepPerformance',
    });

    return response.data;
  }

  /**
   * Get customer profitability analysis data
   */
  async getCustomerProfitabilityData(): Promise<CustomersQueryResponse> {
    const query = `
      query GetCustomerProfitability($first: Int!) {
        customers(first: $first) {
          edges {
            node {
              id
              displayName
              email
              numberOfOrders
              amountSpent {
                amount
                currencyCode
              }
              createdAt
              tags
              orders(first: 10, sortKey: CREATED_AT, reverse: true) {
                edges {
                  node {
                    name
                    createdAt
                    totalPriceSet {
                      shopMoney {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `;

    const response = await this.executeQuery<CustomersQueryResponse>({
      query,
      variables: { first: 50 },
      operationName: 'GetCustomerProfitability',
    });

    return response.data;
  }

  /**
   * Get real-time stock levels
   */
  async getStockLevels(): Promise<ProductsQueryResponse> {
    const query = `
      query GetStockLevels($first: Int!) {
        products(first: $first) {
          edges {
            node {
              id
              title
              productType
              vendor
              variants(first: 50) {
                edges {
                  node {
                    id
                    title
                    sku
                    inventoryQuantity
                    inventoryItem {
                      id
                      tracked
                    }
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `;

    const response = await this.executeQuery<ProductsQueryResponse>({
      query,
      variables: { first: 100 },
      operationName: 'GetStockLevels',
    });

    return response.data;
  }

  /**
   * Get top-selling products analysis
   */
  async getTopSellingProducts(dateFilter?: string): Promise<OrdersQueryResponse> {
    const query = `
      query GetTopSellingProducts($first: Int!, $query: String) {
        orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              name
              createdAt
              lineItems(first: 50) {
                edges {
                  node {
                    title
                    sku
                    quantity
                    variant {
                      id
                      title
                      product {
                        id
                        title
                        productType
                        vendor
                      }
                    }
                    originalUnitPriceSet {
                      shopMoney {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `;

    const variables = {
      first: 100,
      query: dateFilter || `created_at:>=${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`,
    };

    const response = await this.executeQuery<OrdersQueryResponse>({
      query,
      variables,
      operationName: 'GetTopSellingProducts',
    });

    return response.data;
  }

  /**
   * Get outstanding orders tracking
   */
  async getOutstandingOrders(): Promise<OrdersQueryResponse> {
    const query = `
      query GetOutstandingOrders($first: Int!, $query: String) {
        orders(first: $first, query: $query) {
          edges {
            node {
              id
              name
              createdAt
              displayFulfillmentStatus
              lineItems(first: 50) {
                edges {
                  node {
                    title
                    quantity
                    sku
                  }
                }
              }
              customer {
                id
                displayName
                email
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `;

    const response = await this.executeQuery<OrdersQueryResponse>({
      query,
      variables: {
        first: 50,
        query: 'fulfillment_status:unfulfilled',
      },
      operationName: 'GetOutstandingOrders',
    });

    return response.data;
  }

  /**
   * Get shipped orders monitoring
   */
  async getShippedOrders(): Promise<OrdersQueryResponse> {
    const query = `
      query GetShippedOrders($first: Int!, $query: String) {
        orders(first: $first, query: $query) {
          edges {
            node {
              id
              name
              createdAt
              displayFulfillmentStatus
              fulfillments(first: 5) {
                trackingInfo(first: 1) {
                  number
                  url
                }
              }
              customer {
                id
                displayName
                email
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `;

    const response = await this.executeQuery<OrdersQueryResponse>({
      query,
      variables: {
        first: 50,
        query: 'fulfillment_status:fulfilled',
      },
      operationName: 'GetShippedOrders',
    });

    return response.data;
  }

  // Helper methods for building queries
  private buildOrdersQuery(pagination: PaginationOptions, filters: QueryFilters): string {
    return `
      query GetOrders($first: Int, $after: String, $last: Int, $before: String, $query: String) {
        orders(
          first: $first
          after: $after
          last: $last
          before: $before
          query: $query
          sortKey: CREATED_AT
          reverse: true
        ) {
          edges {
            cursor
            node {
              id
              name
              createdAt
              updatedAt
              processedAt
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              subtotalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              totalTaxSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              displayFinancialStatus
              displayFulfillmentStatus
              tags
              note
              lineItems(first: 50) {
                edges {
                  node {
                    id
                    title
                    quantity
                    sku
                    variant {
                      id
                      title
                      product {
                        id
                        title
                        productType
                        vendor
                      }
                    }
                    originalUnitPriceSet {
                      shopMoney {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
              customer {
                id
                displayName
                email
                numberOfOrders
                amountSpent {
                  amount
                  currencyCode
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `;
  }

  private buildProductsQuery(pagination: PaginationOptions): string {
    return `
      query GetProducts($first: Int, $after: String, $last: Int, $before: String) {
        products(
          first: $first
          after: $after
          last: $last
          before: $before
        ) {
          edges {
            cursor
            node {
              id
              title
              handle
              description
              productType
              vendor
              tags
              status
              createdAt
              updatedAt
              totalInventory
              variants(first: 50) {
                edges {
                  node {
                    id
                    title
                    sku
                    inventoryQuantity
                    price
                    compareAtPrice
                    inventoryItem {
                      id
                      tracked
                    }
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `;
  }

  private buildCustomersQuery(pagination: PaginationOptions): string {
    return `
      query GetCustomers($first: Int, $after: String, $last: Int, $before: String) {
        customers(
          first: $first
          after: $after
          last: $last
          before: $before
        ) {
          edges {
            cursor
            node {
              id
              firstName
              lastName
              displayName
              email
              phone
              createdAt
              updatedAt
              numberOfOrders
              amountSpent {
                amount
                currencyCode
              }
              tags
              note
              addresses(first: 5) {
                id
                address1
                city
                country
                zip
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `;
  }

  private buildOrdersVariables(pagination: PaginationOptions, filters: QueryFilters) {
    const variables: any = {
      first: pagination.first || 50,
    };

    if (pagination.after) variables.after = pagination.after;
    if (pagination.before) variables.before = pagination.before;
    if (pagination.last) variables.last = pagination.last;

    // Build query string from filters
    const queryParts: string[] = [];
    if (filters.createdAtMin) queryParts.push(`created_at:>=${filters.createdAtMin}`);
    if (filters.createdAtMax) queryParts.push(`created_at:<=${filters.createdAtMax}`);
    if (filters.updatedAtMin) queryParts.push(`updated_at:>=${filters.updatedAtMin}`);
    if (filters.updatedAtMax) queryParts.push(`updated_at:<=${filters.updatedAtMax}`);
    if (filters.status) queryParts.push(`status:${filters.status}`);
    if (filters.displayFinancialStatus) queryParts.push(`financial_status:${filters.displayFinancialStatus}`);
    if (filters.displayFulfillmentStatus) queryParts.push(`fulfillment_status:${filters.displayFulfillmentStatus}`);

    if (queryParts.length > 0) {
      variables.query = queryParts.join(' AND ');
    }

    return variables;
  }

  private buildProductsVariables(pagination: PaginationOptions) {
    const variables: any = {
      first: pagination.first || 50,
    };

    if (pagination.after) variables.after = pagination.after;
    if (pagination.before) variables.before = pagination.before;
    if (pagination.last) variables.last = pagination.last;

    return variables;
  }

  private buildCustomersVariables(pagination: PaginationOptions) {
    const variables: any = {
      first: pagination.first || 50,
    };

    if (pagination.after) variables.after = pagination.after;
    if (pagination.before) variables.before = pagination.before;
    if (pagination.last) variables.last = pagination.last;

    return variables;
  }
}
