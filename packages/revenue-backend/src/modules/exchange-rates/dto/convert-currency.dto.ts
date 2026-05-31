import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsPositive,
  IsString,
  IsOptional,
  IsDateString,
  Length,
  IsUppercase,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ConvertCurrencyDto {
  @ApiProperty({
    example: 1000,
    description: 'Amount to convert (must be positive)',
  })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @ApiProperty({ example: 'USD', description: 'Source currency (ISO 4217)' })
  @IsString()
  @IsUppercase()
  @Length(3, 3)
  from: string;

  @ApiProperty({ example: 'EUR', description: 'Target currency (ISO 4217)' })
  @IsString()
  @IsUppercase()
  @Length(3, 3)
  to: string;

  @ApiPropertyOptional({
    example: '2026-05-31',
    description:
      'Use the most-recent rate on or before this date (defaults to today)',
  })
  @IsOptional()
  @IsDateString()
  date?: string;
}
