import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BillingController } from './billing.controller';
import { BillingEngineService } from './services/billing-engine.service';
import { SeatCalculatorService } from './services/seat-calculator.service';
import { BillingQueueService } from './services/billing-queue.service';
import { ConsolidatedBillingService } from './services/consolidated-billing.service';
import { ContractBillingProcessor } from './processors/contract-billing.processor';
import { ConsolidatedBillingProcessor } from './processors/consolidated-billing.processor';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { QUEUE_NAMES } from '../../common/queues';

@Module({
  imports: [
    PrismaModule,
    AuditLogModule,
    // Register billing queues
    BullModule.registerQueue({
      name: QUEUE_NAMES.CONTRACT_BILLING,
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.CONSOLIDATED_BILLING,
    }),
  ],
  controllers: [BillingController],
  providers: [
    BillingEngineService,
    SeatCalculatorService,
    BillingQueueService,
    ConsolidatedBillingService,
    ContractBillingProcessor,
    ConsolidatedBillingProcessor,
  ],
  exports: [
    BillingEngineService,
    SeatCalculatorService,
    BillingQueueService,
    ConsolidatedBillingService,
  ],
})
export class BillingModule {}
