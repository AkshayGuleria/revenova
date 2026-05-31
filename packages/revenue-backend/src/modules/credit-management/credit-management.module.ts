import { Module } from '@nestjs/common';
import { CreditHoldGuard } from './credit-hold.guard';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CreditHoldGuard],
  exports: [CreditHoldGuard],
})
export class CreditManagementModule {}
