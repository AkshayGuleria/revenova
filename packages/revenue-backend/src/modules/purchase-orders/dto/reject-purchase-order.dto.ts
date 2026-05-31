import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RejectPurchaseOrderDto {
  @ApiProperty({ example: 'Budget not approved for this quarter' })
  @IsString()
  @MinLength(5)
  rejectionReason: string;
}
