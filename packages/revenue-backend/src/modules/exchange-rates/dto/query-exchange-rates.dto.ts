import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { BasePaginationDto } from '../../../common/dto/pagination.dto';

export class QueryExchangeRatesDto extends BasePaginationDto {
  @ApiPropertyOptional({ example: 'USD', description: 'Filter by source currency' })
  @IsOptional()
  @IsString()
  'fromCurrency[eq]'?: string;

  @ApiPropertyOptional({ example: 'EUR', description: 'Filter by target currency' })
  @IsOptional()
  @IsString()
  'toCurrency[eq]'?: string;

  @ApiPropertyOptional({ example: 'manual', description: 'Filter by rate source' })
  @IsOptional()
  @IsString()
  'source[eq]'?: string;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Filter rates on or after this date' })
  @IsOptional()
  @IsString()
  'effectiveDate[gte]'?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Filter rates on or before this date' })
  @IsOptional()
  @IsString()
  'effectiveDate[lte]'?: string;
}
