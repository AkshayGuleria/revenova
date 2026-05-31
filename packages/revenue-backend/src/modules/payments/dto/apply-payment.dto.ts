import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ApplyPaymentDto {
  @ApiProperty({ description: 'Invoice ID to apply this payment to' })
  @IsUUID()
  invoiceId: string;
}
