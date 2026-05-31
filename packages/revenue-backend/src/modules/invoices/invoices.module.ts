import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { CreditManagementModule } from '../credit-management/credit-management.module';

@Module({
  imports: [PrismaModule, CreditManagementModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
