import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateExchangeRateDto {
  @ApiPropertyOptional({ example: 0.935, description: 'Updated exchange rate' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @IsPositive()
  @Type(() => Number)
  rate?: number;

  @ApiPropertyOptional({
    example: 'ecb',
    enum: ['manual', 'ecb', 'openexchangerates'],
    description: 'Updated source of the exchange rate data',
  })
  @IsOptional()
  @IsString()
  source?: string;
}
