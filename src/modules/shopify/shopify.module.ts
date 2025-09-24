import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ShopifyService } from './shopify.service';
import { ShopifyGraphQLService } from './shopify-graphql.service';

@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 10000, // Reduced to 10 seconds for faster failure
      maxRedirects: 3,
    }),
  ],
  providers: [ShopifyService, ShopifyGraphQLService],
  exports: [ShopifyService, ShopifyGraphQLService],
})
export class ShopifyModule {}
