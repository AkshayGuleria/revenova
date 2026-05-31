import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { RenewalsService } from './renewals.service';

@ApiTags('Renewals')
@Controller('api/renewals')
export class RenewalsController {
  constructor(private readonly renewalsService: RenewalsService) {}

  @Get('upcoming')
  @ApiOperation({ summary: 'Contracts expiring within N days' })
  @ApiQuery({ name: 'days', required: false, type: Number, example: 90 })
  @ApiQuery({ name: 'offset[eq]', required: false, type: Number })
  @ApiQuery({ name: 'limit[eq]', required: false, type: Number })
  getUpcoming(
    @Query('days') days?: string,
    @Query('offset[eq]') offset?: string,
    @Query('limit[eq]') limit?: string,
  ) {
    return this.renewalsService.getUpcoming(
      days ? parseInt(days) : 90,
      offset ? parseInt(offset) : 0,
      limit ? Math.min(parseInt(limit), 100) : 20,
    );
  }

  @Get('overdue')
  @ApiOperation({ summary: 'Active contracts past their end date' })
  @ApiQuery({ name: 'offset[eq]', required: false, type: Number })
  @ApiQuery({ name: 'limit[eq]', required: false, type: Number })
  getOverdue(
    @Query('offset[eq]') offset?: string,
    @Query('limit[eq]') limit?: string,
  ) {
    return this.renewalsService.getOverdue(
      offset ? parseInt(offset) : 0,
      limit ? Math.min(parseInt(limit), 100) : 20,
    );
  }

  @Get(':contractId/status')
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Renewal status for a single contract' })
  getStatus(@Param('contractId') contractId: string) {
    return this.renewalsService.getStatus(contractId);
  }

  @Post(':contractId/renew')
  @ApiParam({ name: 'contractId', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Renew contract by extending endDate by 1 year' })
  renew(@Param('contractId') contractId: string) {
    return this.renewalsService.renew(contractId);
  }
}
