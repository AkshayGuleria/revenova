import { Module } from '@nestjs/common';
import { TaxRatesService } from './tax-rates.service';
import { TaxRatesController } from './tax-rates.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TaxRatesController],
  providers: [TaxRatesService],
  exports: [TaxRatesService],
})
export class TaxRatesModule {}
