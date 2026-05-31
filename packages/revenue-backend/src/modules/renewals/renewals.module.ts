import { Module } from '@nestjs/common';
import { RenewalsService } from './renewals.service';
import { RenewalsController } from './renewals.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RenewalsController],
  providers: [RenewalsService],
  exports: [RenewalsService],
})
export class RenewalsModule {}
