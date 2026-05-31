import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { ProductsModule } from './modules/products/products.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { BillingModule } from './modules/billing/billing.module';
import { InvoiceGroupsModule } from './modules/invoice-groups/invoice-groups.module';
import { AppConfigModule } from './modules/app-config/app-config.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { TaxRatesModule } from './modules/tax-rates/tax-rates.module';
import { getQueueConfig } from './common/queues';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // BullMQ Configuration for Phase 2
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getQueueConfig,
      inject: [ConfigService],
    }),
    PrismaModule,
    HealthModule,
    AccountsModule,
    ContractsModule,
    ProductsModule,
    InvoicesModule,
    BillingModule,
    InvoiceGroupsModule,
    AppConfigModule,
    PurchaseOrdersModule,
    TaxRatesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
