import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsString, IsOptional, IsDateString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CalculateTaxDto {
  @ApiProperty({ example: 10000, description: 'Pre-tax amount' })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @ApiProperty({ example: 'EU-DE', description: 'Jurisdiction code' })
  @IsString()
  jurisdiction: string;

  @ApiPropertyOptional({ enum: ['VAT', 'GST', 'SALES_TAX', 'WHT'], example: 'VAT' })
  @IsOptional()
  @IsString()
  @IsIn(['VAT', 'GST', 'SALES_TAX', 'WHT'])
  taxType?: string;

  @ApiPropertyOptional({ example: '2026-05-30', description: 'Look up rate effective on this date (defaults to today)' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
