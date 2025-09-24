import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { RedisService } from './redis.service';

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisConfig = configService.get('config.redis');
        
        return {
          store: redisStore,
          socket: {
            host: redisConfig.host,
            port: redisConfig.port,
          },
          password: redisConfig.password,
          database: redisConfig.db,
          ttl: redisConfig.ttl * 1000, // Convert to milliseconds
          max: 1000, // Maximum number of items in cache
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [RedisService],
  exports: [RedisService, CacheModule],
})
export class RedisModule {}
