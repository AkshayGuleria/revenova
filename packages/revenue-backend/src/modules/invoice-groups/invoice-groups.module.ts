import { Module } from '@nestjs/common';
import { InvoiceGroupsService } from './invoice-groups.service';
import { InvoiceGroupsController } from './invoice-groups.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InvoiceGroupsController],
  providers: [InvoiceGroupsService],
  exports: [InvoiceGroupsService],
})
export class InvoiceGroupsModule {}
