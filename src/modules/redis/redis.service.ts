import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';

export interface CacheOptions {
  ttl?: number;
  compress?: boolean;
}

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private readonly defaultTtl: number;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {
    this.defaultTtl = this.configService.get<number>('config.cache.ttlSeconds', 300);
  }

  /**
   * Get value from Redis cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.cacheManager.get<T>(key);
      this.logger.debug(`Cache GET: ${key} - ${value ? 'HIT' : 'MISS'}`);
      return value || null;
    } catch (error) {
      this.logger.error(`Cache GET error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in Redis cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const ttl = options?.ttl || this.defaultTtl;
      await this.cacheManager.set(key, value, ttl * 1000); // Convert to milliseconds
      this.logger.debug(`Cache SET: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      this.logger.error(`Cache SET error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete value from Redis cache
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Cache DEL: ${key}`);
    } catch (error) {
      this.logger.error(`Cache DEL error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const value = await this.cacheManager.get(key);
      return value !== undefined && value !== null;
    } catch (error) {
      this.logger.error(`Cache EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set multiple values at once
   */
  async mset(keyValuePairs: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    try {
      const promises = keyValuePairs.map(({ key, value, ttl }) =>
        this.set(key, value, { ttl })
      );
      await Promise.all(promises);
      this.logger.debug(`Cache MSET: ${keyValuePairs.length} keys`);
    } catch (error) {
      this.logger.error('Cache MSET error:', error);
      throw error;
    }
  }

  /**
   * Get multiple values at once
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const promises = keys.map(key => this.get<T>(key));
      const values = await Promise.all(promises);
      this.logger.debug(`Cache MGET: ${keys.length} keys`);
      return values;
    } catch (error) {
      this.logger.error('Cache MGET error:', error);
      throw error;
    }
  }

  /**
   * Increment a numeric value
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      const current = await this.get<number>(key) || 0;
      const newValue = current + amount;
      await this.set(key, newValue);
      this.logger.debug(`Cache INCR: ${key} by ${amount} = ${newValue}`);
      return newValue;
    } catch (error) {
      this.logger.error(`Cache INCR error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Set value with expiration time
   */
  async setex(key: string, seconds: number, value: any): Promise<void> {
    await this.set(key, value, { ttl: seconds });
  }

  /**
   * Get or set pattern - get value, if not exists, execute factory function and cache result
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    try {
      let value = await this.get<T>(key);
      
      if (value === null) {
        this.logger.debug(`Cache MISS for ${key}, executing factory function`);
        value = await factory();
        await this.set(key, value, options);
      }
      
      return value;
    } catch (error) {
      this.logger.error(`Cache getOrSet error for key ${key}:`, error);
      // If cache fails, still try to get the value from factory
      return await factory();
    }
  }

  /**
   * Cache keys for different data types
   */
  getCacheKeys() {
    return {
      dashboard: {
        summary: 'dashboard:summary',
        salesData: 'dashboard:sales',
        topProducts: 'dashboard:top_products',
        customerData: 'dashboard:customers',
        inventoryData: 'dashboard:inventory',
        orderData: 'dashboard:orders',
      },
      shopify: {
        orders: (page: number = 1) => `shopify:orders:page:${page}`,
        products: (page: number = 1) => `shopify:products:page:${page}`,
        customers: (page: number = 1) => `shopify:customers:page:${page}`,
        lastSync: 'shopify:last_sync',
      },
      analytics: {
        dailySales: (date: string) => `analytics:daily_sales:${date}`,
        monthlySales: (month: string) => `analytics:monthly_sales:${month}`,
        yearToDate: (year: string) => `analytics:ytd:${year}`,
        topSellingProducts: (period: string) => `analytics:top_products:${period}`,
        customerAnalytics: (customerId: string) => `analytics:customer:${customerId}`,
      },
      performance: {
        requestCount: (endpoint: string) => `perf:requests:${endpoint}`,
        responseTime: (endpoint: string) => `perf:response_time:${endpoint}`,
      }
    };
  }

  /**
   * Clear all cache data (use with caution)
   */
  async clearAll(): Promise<void> {
    try {
      await this.cacheManager.reset();
      this.logger.warn('All cache data cleared');
    } catch (error) {
      this.logger.error('Cache CLEAR ALL error:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics (if supported by store)
   */
  async getStats(): Promise<any> {
    try {
      // This depends on the cache store implementation
      // For Redis, we could implement custom stats
      return {
        hits: 0,
        misses: 0,
        // Add more stats as needed
      };
    } catch (error) {
      this.logger.error('Cache STATS error:', error);
      return null;
    }
  }
}
