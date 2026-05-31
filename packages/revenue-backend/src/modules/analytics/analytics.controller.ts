import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('mrr')
  @ApiOperation({
    summary: 'Monthly Recurring Revenue',
    description:
      'Returns MRR calculated from all active contracts at the given point in time. ' +
      'Annual contracts are divided by 12, quarterly by 3, monthly kept as-is.',
  })
  @ApiQuery({
    name: 'asOf',
    required: false,
    type: String,
    example: '2026-05-31',
    description: 'Point-in-time date (defaults to today)',
  })
  getMrr(@Query('asOf') asOf?: string) {
    return this.analyticsService.getMrr(asOf);
  }

  @Get('arr')
  @ApiOperation({
    summary: 'Annual Recurring Revenue',
    description: 'Returns ARR (MRR × 12) at the given point in time.',
  })
  @ApiQuery({
    name: 'asOf',
    required: false,
    type: String,
    example: '2026-05-31',
    description: 'Point-in-time date (defaults to today)',
  })
  getArr(@Query('asOf') asOf?: string) {
    return this.analyticsService.getArr(asOf);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Analytics dashboard summary',
    description:
      'Combined view of MRR, ARR, active contract count, and total active accounts.',
  })
  @ApiQuery({
    name: 'asOf',
    required: false,
    type: String,
    example: '2026-05-31',
    description: 'Point-in-time date (defaults to today)',
  })
  getSummary(@Query('asOf') asOf?: string) {
    return this.analyticsService.getSummary(asOf);
  }

  @Get('churn')
  @ApiOperation({
    summary: 'Churned contracts in date range',
    description:
      'Returns contracts that moved to expired or cancelled status within the date range, ' +
      'along with their annualised value (churnedArr).',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    example: '2026-01-01',
    description: 'Start of date range (defaults to start of current year)',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    example: '2026-05-31',
    description: 'End of date range (defaults to today)',
  })
  getChurn(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analyticsService.getChurn(from, to);
  }

  @Get('bookings')
  @ApiOperation({
    summary: 'New contract bookings in date range',
    description:
      'Returns new contracts created within the date range and their total booked value.',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    example: '2026-01-01',
    description: 'Start of date range (defaults to start of current year)',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    example: '2026-05-31',
    description: 'End of date range (defaults to today)',
  })
  getBookings(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analyticsService.getBookings(from, to);
  }
}
