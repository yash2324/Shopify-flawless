// Base Shopify Types
export interface ShopifyResponse<T> {
  data: T;
  extensions?: {
    cost: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus: {
        maximumAvailable: number;
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
  errors?: Array<{
    message: string;
    locations?: Array<{
      line: number;
      column: number;
    }>;
    path?: string[];
    extensions?: {
      code: string;
      exception?: any;
    };
  }>;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

export interface Edge<T> {
  cursor: string;
  node: T;
}

export interface Connection<T> {
  edges: Edge<T>[];
  pageInfo: PageInfo;
}

// Money Types
export interface MoneyV2 {
  amount: string;
  currencyCode: string;
}

export interface MoneyBag {
  shopMoney: MoneyV2;
  presentmentMoney: MoneyV2;
}

// Order Types
export interface ShopifyOrder {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
  closedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  totalPriceSet: MoneyBag;
  subtotalPriceSet: MoneyBag;
  totalTaxSet: MoneyBag;
  totalDiscountsSet: MoneyBag;
  totalShippingPriceSet: MoneyBag;
  lineItems: Connection<LineItem>;
  customer?: ShopifyCustomer;
  billingAddress?: Address;
  shippingAddress?: Address;
  displayFinancialStatus: string;
  tags: string[];
  note?: string;
  displayFulfillmentStatus: string;
  fulfillments: Fulfillment[];
}

export interface LineItem {
  id: string;
  title: string;
  quantity: number;
  sku?: string;
  variant?: ProductVariant;
  originalUnitPriceSet: MoneyBag;
  discountedUnitPriceSet: MoneyBag;
  totalDiscountSet: MoneyBag;
}

export interface Fulfillment {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  trackingInfo: TrackingInfo[];
}

export interface TrackingInfo {
  number?: string;
  url?: string;
  company?: string;
}

// Product Types
export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  productType: string;
  vendor: string;
  tags: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  variants: Connection<ProductVariant>;
  totalInventory: number;
}

export interface ProductVariant {
  id: string;
  title: string;
  sku?: string;
  inventoryQuantity: number;
  price: string;
  compareAtPrice?: string;
  product: {
    id: string;
    title: string;
    productType: string;
    vendor: string;
  };
  inventoryItem: {
    id: string;
    tracked: boolean;
  };
}

// Customer Types
export interface ShopifyCustomer {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  email: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
  numberOfOrders: number;
  amountSpent: MoneyV2;
  tags: string[];
  note?: string;
  addresses: Address[];
  orders?: Connection<ShopifyOrder>;
}

export interface Address {
  id?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  country?: string;
  zip?: string;
  phone?: string;
  name?: string;
  company?: string;
}

// GraphQL Query Response Types
export interface OrdersQueryResponse {
  orders: Connection<ShopifyOrder>;
}

export interface ProductsQueryResponse {
  products: Connection<ShopifyProduct>;
}

export interface CustomersQueryResponse {
  customers: Connection<ShopifyCustomer>;
}

// Analytics Types
export interface DashboardSummary {
  totalSales: number;
  totalOrders: number;
  totalCustomers: number;
  averageOrderValue: number;
  conversionRate: number;
  topSellingProducts: TopSellingProduct[];
  recentOrders: ShopifyOrder[];
  lowStockProducts: LowStockProduct[];
  salesTrend: SalesTrendData[];
  customerMetrics: CustomerMetrics;
  inventoryMetrics: InventoryMetrics;
  lastUpdated: string;
}

export interface TopSellingProduct {
  productId: string;
  productTitle: string;
  variantId: string;
  variantTitle: string;
  sku: string;
  totalQuantitySold: number;
  totalRevenue: number;
  averagePrice: number;
  productType: string;
  vendor: string;
}

export interface LowStockProduct {
  productId: string;
  productTitle: string;
  variantId: string;
  variantTitle: string;
  sku: string;
  currentStock: number;
  recommendedReorderLevel: number;
  daysOfStockRemaining: number;
}

export interface SalesTrendData {
  date: string;
  sales: number;
  orders: number;
  customers: number;
}

export interface CustomerMetrics {
  newCustomers: number;
  returningCustomers: number;
  customerRetentionRate: number;
  averageCustomerLifetimeValue: number;
  topCustomers: TopCustomer[];
}

export interface TopCustomer {
  customerId: string;
  customerName: string;
  email: string;
  totalSpent: number;
  orderCount: number;
  lastOrderDate: string;
  averageOrderValue: number;
}

export interface InventoryMetrics {
  totalProducts: number;
  totalVariants: number;
  outOfStockProducts: number;
  lowStockProducts: number;
  totalInventoryValue: number;
  inventoryTurnoverRate: number;
}

// Performance Metrics
export interface SalesRepPerformance {
  repId: string;
  repName: string;
  totalSales: number;
  orderCount: number;
  averageOrderValue: number;
  conversionRate: number;
  customerCount: number;
  targetVsActual: {
    target: number;
    actual: number;
    percentage: number;
  };
}

export interface MonthlyTargetVsActual {
  month: string;
  year: number;
  targetSales: number;
  actualSales: number;
  variance: number;
  variancePercentage: number;
  onTrack: boolean;
}

export interface YearToDateReport {
  year: number;
  totalSales: number;
  totalOrders: number;
  totalCustomers: number;
  monthlyBreakdown: MonthlyBreakdown[];
  quarterlyBreakdown: QuarterlyBreakdown[];
  growthRate: number;
  projectedYearEnd: number;
}

export interface MonthlyBreakdown {
  month: string;
  sales: number;
  orders: number;
  customers: number;
  growthRateFromPreviousMonth: number;
}

export interface QuarterlyBreakdown {
  quarter: string;
  sales: number;
  orders: number;
  customers: number;
  growthRateFromPreviousQuarter: number;
}

export interface CustomerProfitabilityAnalysis {
  customerId: string;
  customerName: string;
  email: string;
  registrationDate: string;
  totalSpent: number;
  orderCount: number;
  averageOrderValue: number;
  lifetimeValue: number;
  profitMargin: number;
  lastPurchaseDate: string;
  daysSinceLastPurchase: number;
  purchaseFrequency: number;
  segmentation: 'High Value' | 'Medium Value' | 'Low Value' | 'At Risk' | 'New';
}

export interface PurchaseHistoryAnalysis {
  customerId: string;
  purchaseHistory: PurchaseRecord[];
  purchaseFrequency: {
    averageDaysBetweenPurchases: number;
    frequency: 'High' | 'Medium' | 'Low';
  };
  seasonalTrends: SeasonalTrend[];
  predictedNextPurchase?: string;
  recommendations: string[];
}

export interface PurchaseRecord {
  orderId: string;
  orderName: string;
  date: string;
  amount: number;
  itemCount: number;
  items: LineItem[];
}

export interface SeasonalTrend {
  month: string;
  averageSpend: number;
  orderCount: number;
  trend: 'Increasing' | 'Decreasing' | 'Stable';
}

// Inventory Analysis Types
export interface InventoryTurnoverAnalysis {
  productId: string;
  productTitle: string;
  variants: VariantTurnoverData[];
  overallTurnoverRate: number;
  daysInInventory: number;
  stockStatus: 'Optimal' | 'Overstocked' | 'Understocked' | 'Out of Stock';
  reorderRecommendation: ReorderRecommendation;
}

export interface VariantTurnoverData {
  variantId: string;
  variantTitle: string;
  sku: string;
  currentStock: number;
  unitsSoldLastMonth: number;
  unitsSoldLast3Months: number;
  turnoverRate: number;
  daysOfStockRemaining: number;
}

export interface ReorderRecommendation {
  shouldReorder: boolean;
  recommendedQuantity: number;
  urgencyLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  reasoning: string;
}

// Order Fulfillment Types
export interface OrderFulfillmentStatus {
  orderId: string;
  orderName: string;
  customerName: string;
  createdAt: string;
  status: 'unfulfilled' | 'partial' | 'fulfilled' | 'cancelled';
  lineItems: FulfillmentLineItem[];
  estimatedShipDate?: string;
  actualShipDate?: string;
  trackingNumbers: string[];
  fulfillmentLocation?: string;
}

export interface FulfillmentLineItem {
  lineItemId: string;
  title: string;
  sku: string;
  quantity: number;
  fulfilledQuantity: number;
  remainingQuantity: number;
  status: 'pending' | 'fulfilled' | 'cancelled';
}

// API Request Types
export interface ShopifyAPIOptions {
  query: string;
  variables?: Record<string, any>;
  operationName?: string;
}

export interface PaginationOptions {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

export interface QueryFilters {
  createdAtMin?: string;
  createdAtMax?: string;
  updatedAtMin?: string;
  updatedAtMax?: string;
  status?: string;
  displayFinancialStatus?: string;
  displayFulfillmentStatus?: string;
}

// Error Types
export interface ShopifyError {
  message: string;
  code?: string;
  field?: string;
  details?: any;
}

export class APIError extends Error {
  statusCode?: number;
  response?: any;
  isRetryable?: boolean;

  constructor(message: string, statusCode?: number, isRetryable?: boolean) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
  }
}
