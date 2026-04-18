import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { CreateInvoiceGroupDto } from './create-invoice-group.dto';

// accountId is not updatable — ownership cannot be transferred
export class UpdateInvoiceGroupDto extends PartialType(
  OmitType(CreateInvoiceGroupDto, ['accountId'] as const),
) {
  @ApiPropertyOptional({
    description: 'Additional metadata as JSON',
    example: { costCenterId: '4400', approver: 'jane.doe@acme.com' },
  })
  @IsOptional()
  metadata?: any;
}
