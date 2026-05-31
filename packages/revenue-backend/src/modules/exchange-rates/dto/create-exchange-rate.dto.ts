import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsPositive,
  IsDateString,
  IsOptional,
  IsUppercase,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExchangeRateDto {
  @ApiProperty({ example: 'USD', description: 'ISO 4217 currency code (3 uppercase letters)' })
  @IsString()
  @IsUppercase()
  @Length(3, 3)
  fromCurrency: string;

  @ApiProperty({ example: 'EUR', description: 'ISO 4217 currency code (3 uppercase letters)' })
  @IsString()
  @IsUppercase()
  @Length(3, 3)
  toCurrency: string;

  @ApiProperty({ example: 0.921543, description: 'Exchange rate (positive, max 6 decimal places)' })
  @IsNumber({ maxDecimalPlaces: 6 })
  @IsPositive()
  @Type(() => Number)
  rate: number;

  @ApiProperty({ example: '2026-05-31', description: 'Date this rate becomes effective (YYYY-MM-DD)' })
  @IsDateString()
  effectiveDate: string;

  @ApiPropertyOptional({
    example: 'manual',
    enum: ['manual', 'ecb', 'openexchangerates'],
    description: 'Source of the exchange rate data',
  })
  @IsOptional()
  @IsString()
  source?: string;
}
