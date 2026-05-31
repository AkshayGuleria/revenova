import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  Min,
  Max,
  IsDateString,
  IsOptional,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export const TAX_TYPES = ['VAT', 'GST', 'SALES_TAX', 'WHT'] as const;
export type TaxType = (typeof TAX_TYPES)[number];

export class CreateTaxRateDto {
  @ApiProperty({
    example: 'EU-DE',
    description:
      'Jurisdiction code, e.g. US-CA, EU-DE, UK, AU. Used to look up applicable rates at invoice time.',
  })
  @IsString()
  jurisdiction: string;

  @ApiProperty({
    enum: TAX_TYPES,
    example: 'VAT',
    description:
      'Tax type: VAT (Europe), GST (Australia/Canada), SALES_TAX (US states), WHT (withholding tax)',
  })
  @IsString()
  @IsIn(TAX_TYPES)
  taxType: string;

  @ApiProperty({
    example: 0.19,
    description:
      'Rate as a decimal between 0 and 1. Example: 0.19 = 19%, 0.0 = tax-exempt.',
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  @Type(() => Number)
  rate: number;

  @ApiProperty({ example: 'German VAT Standard Rate' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example: 'Standard VAT rate for goods and services in Germany',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: '2026-01-01',
    description: 'ISO date string — the first day this rate is effective.',
  })
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description:
      'ISO date string — last day this rate is effective. Omit for open-ended rates.',
  })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
