import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  SHOPIFY_SHOP_DOMAIN: string;

  @IsString()
  @IsNotEmpty()
  SHOPIFY_ACCESS_TOKEN: string;

  @IsString()
  @IsOptional()
  SHOPIFY_API_VERSION: string = '2025-04';

  @IsString()
  @IsOptional()
  REDIS_HOST: string = 'localhost';

  @IsNumber()
  @IsOptional()
  REDIS_PORT: number = 6379;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsNumber()
  @IsOptional()
  REDIS_DB: number = 0;

  @IsNumber()
  @IsOptional()
  REDIS_TTL: number = 300;

  @IsNumber()
  @IsOptional()
  CACHE_TTL_SECONDS: number = 300;

  @IsNumber()
  @IsOptional()
  DASHBOARD_DATA_TTL: number = 60;

  @IsNumber()
  @IsOptional()
  THROTTLE_TTL: number = 60;

  @IsNumber()
  @IsOptional()
  THROTTLE_LIMIT: number = 100;

  @IsString()
  @IsOptional()
  SHOPIFY_SYNC_CRON: string = '0 * * * * *';

  @IsString()
  @IsOptional()
  DATA_CLEANUP_CRON: string = '0 0 * * *';

  @IsString()
  @IsOptional()
  LOG_LEVEL: string = 'info';

  @IsString()
  @IsOptional()
  LOG_FILE_PATH: string = './logs/app.log';

  @IsNumber()
  @IsOptional()
  MAX_CONCURRENT_SHOPIFY_REQUESTS: number = 5;

  @IsNumber()
  @IsOptional()
  REQUEST_TIMEOUT: number = 30000;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
