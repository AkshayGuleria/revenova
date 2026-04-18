import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateInvoiceItemDto {
  @ApiProperty({
    description: 'Line item description',
    example: 'Enterprise Plan - 100 seats',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Quantity',
    example: 100,
  })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({
    description: 'Unit price',
    example: 99.99,
  })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({
    description: 'Total amount (quantity × unitPrice)',
    example: 9999.0,
  })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({
    description:
      'Organizational unit reference for cost allocation (cost center code, department code, etc.)',
    example: 'DEPT-ENG',
  })
  @IsOptional()
  @IsString()
  groupReference?: string;
}
