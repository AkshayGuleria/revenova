import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AnalyticsPointInTimeDto {
  @ApiPropertyOptional({
    description: 'Point-in-time date for the calculation (defaults to today)',
    example: '2026-05-31',
  })
  @IsOptional()
  @IsDateString()
  asOf?: string;
}

export class AnalyticsDateRangeDto {
  @ApiPropertyOptional({
    description: 'Start of date range (inclusive)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'End of date range (inclusive)',
    example: '2026-05-31',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
