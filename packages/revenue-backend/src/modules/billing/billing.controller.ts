import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BillingEngineService } from './services/billing-engine.service';
import { BillingQueueService } from './services/billing-queue.service';
import { ConsolidatedBillingService } from './services/consolidated-billing.service';
import {
  GenerateInvoiceDto,
  BatchGenerateInvoicesDto,
  GenerateConsolidatedInvoiceDto,
} from './dto/generate-invoice.dto';

@ApiTags('Billing')
@Controller('api/billing')
export class BillingController {
  constructor(
    private readonly billingEngine: BillingEngineService,
    private readonly billingQueue: BillingQueueService,
    private readonly consolidatedBilling: ConsolidatedBillingService,
  ) {}

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Generate invoice from contract (synchronous)',
    description:
      'Generates an invoice from an active contract immediately. For background processing, use /billing/queue endpoint.',
  })
  @ApiResponse({
    status: 201,
    description: 'Invoice generated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Contract not found',
  })
  async generateInvoice(@Body() dto: GenerateInvoiceDto) {
    const periodStart = dto.periodStart ? new Date(dto.periodStart) : undefined;
    const periodEnd = dto.periodEnd ? new Date(dto.periodEnd) : undefined;

    const result = await this.billingEngine.generateInvoiceFromContract({
      contractId: dto.contractId,
      periodStart,
      periodEnd,
    });

    return {
      data: result,
      paging: {
        offset: null,
        limit: null,
        total: null,
        totalPages: null,
        hasNext: null,
        hasPrev: null,
      },
    };
  }

  @Post('queue')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Queue invoice generation from contract (asynchronous)',
    description:
      'Queues an invoice generation job for background processing. Returns job ID for status tracking.',
  })
  @ApiResponse({
    status: 202,
    description: 'Invoice generation job queued',
  })
  async queueInvoiceGeneration(@Body() dto: GenerateInvoiceDto) {
    const jobId = await this.billingQueue.queueContractInvoiceGeneration({
      contractId: dto.contractId,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
    });

    return {
      data: {
        jobId,
        status: 'queued',
        message: 'Invoice generation job queued successfully',
      },
      paging: {
        offset: null,
        limit: null,
        total: null,
        totalPages: null,
        hasNext: null,
        hasPrev: null,
      },
    };
  }

  @Post('batch')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Queue batch contract billing',
    description:
      'Queues a batch billing job for all active contracts. Used for scheduled monthly/quarterly/annual billing.',
  })
  @ApiResponse({
    status: 202,
    description: 'Batch billing job queued',
  })
  async queueBatchBilling(@Body() dto: BatchGenerateInvoicesDto) {
    const jobId = await this.billingQueue.queueBatchContractBilling({
      billingDate: dto.billingDate || new Date().toISOString(),
      billingPeriod: dto.billingPeriod || 'monthly',
    });

    return {
      data: {
        jobId,
        status: 'queued',
        message: 'Batch billing job queued successfully',
      },
      paging: {
        offset: null,
        limit: null,
        total: null,
        totalPages: null,
        hasNext: null,
        hasPrev: null,
      },
    };
  }

  @Get('jobs/:jobId')
  @ApiOperation({
    summary: 'Get billing job status',
    description: 'Check the status of a queued billing job',
  })
  @ApiResponse({
    status: 200,
    description: 'Job status retrieved',
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found',
  })
  async getJobStatus(@Param('jobId') jobId: string) {
    const status = await this.billingQueue.getJobStatus(jobId);

    if (!status) {
      return {
        data: null,
        paging: {
          offset: null,
          limit: null,
          total: null,
          totalPages: null,
          hasNext: null,
          hasPrev: null,
        },
      };
    }

    return {
      data: status,
      paging: {
        offset: null,
        limit: null,
        total: null,
        totalPages: null,
        hasNext: null,
        hasPrev: null,
      },
    };
  }

  @Get('queue/stats')
  @ApiOperation({
    summary: 'Get billing queue statistics',
    description: 'Get current statistics for the contract billing queue',
  })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics retrieved',
  })
  async getQueueStats() {
    const stats = await this.billingQueue.getQueueStats();

    return {
      data: stats,
      paging: {
        offset: null,
        limit: null,
        total: null,
        totalPages: null,
        hasNext: null,
        hasPrev: null,
      },
    };
  }

  @Post('dry-run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Preview invoice from contract (dry run — no DB writes)',
    description:
      'Runs the full billing calculation pipeline for a contract and returns a preview. ' +
      'Nothing is written to the database. Returns 200 OK.',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice preview computed successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Contract not found',
  })
  async previewInvoice(@Body() dto: GenerateInvoiceDto) {
    const periodStart = dto.periodStart ? new Date(dto.periodStart) : undefined;
    const periodEnd = dto.periodEnd ? new Date(dto.periodEnd) : undefined;
    const result = await this.billingEngine.previewInvoice({
      contractId: dto.contractId,
      periodStart,
      periodEnd,
    });
    return {
      data: result,
      paging: {
        offset: null,
        limit: null,
        total: null,
        totalPages: null,
        hasNext: null,
        hasPrev: null,
      },
    };
  }

  @Post('consolidated/dry-run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Preview consolidated invoice (dry run — no DB writes)',
    description:
      'Runs the full consolidated billing calculation for a parent account and returns a preview. ' +
      'Nothing is written to the database. Credit hold is not enforced. Returns 200 OK.',
  })
  @ApiResponse({
    status: 200,
    description: 'Consolidated invoice preview computed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'No billable items found',
  })
  @ApiResponse({
    status: 404,
    description: 'Parent account not found',
  })
  async previewConsolidatedInvoice(
    @Body() dto: GenerateConsolidatedInvoiceDto,
  ) {
    const result = await this.consolidatedBilling.previewConsolidatedInvoice({
      parentAccountId: dto.parentAccountId,
      periodStart: new Date(dto.periodStart),
      periodEnd: new Date(dto.periodEnd),
      includeChildren: dto.includeChildren ?? true,
    });
    return {
      data: result,
      paging: {
        offset: null,
        limit: null,
        total: null,
        totalPages: null,
        hasNext: null,
        hasPrev: null,
      },
    };
  }

  @Post('consolidated')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Generate consolidated invoice (synchronous)',
    description:
      'Generates a consolidated invoice for a parent account and all its subsidiaries immediately. ' +
      'Includes all active contracts across the account hierarchy. For background processing, use /billing/consolidated/queue endpoint.',
  })
  @ApiResponse({
    status: 201,
    description: 'Consolidated invoice generated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or no billable items found',
  })
  @ApiResponse({
    status: 404,
    description: 'Parent account not found',
  })
  async generateConsolidatedInvoice(
    @Body() dto: GenerateConsolidatedInvoiceDto,
  ) {
    const result = await this.consolidatedBilling.generateConsolidatedInvoice({
      parentAccountId: dto.parentAccountId,
      periodStart: new Date(dto.periodStart),
      periodEnd: new Date(dto.periodEnd),
      includeChildren: dto.includeChildren ?? true,
    });

    return {
      data: result,
      paging: {
        offset: null,
        limit: null,
        total: null,
        totalPages: null,
        hasNext: null,
        hasPrev: null,
      },
    };
  }

  @Post('consolidated/queue')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Queue consolidated invoice generation (asynchronous)',
    description:
      'Queues a consolidated invoice generation job for background processing. ' +
      'Returns job ID for status tracking.',
  })
  @ApiResponse({
    status: 202,
    description: 'Consolidated invoice generation job queued',
  })
  async queueConsolidatedInvoiceGeneration(
    @Body() dto: GenerateConsolidatedInvoiceDto,
  ) {
    const jobId = await this.billingQueue.queueConsolidatedInvoiceGeneration({
      parentAccountId: dto.parentAccountId,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      includeChildren: dto.includeChildren ?? true,
    });

    return {
      data: {
        jobId,
        status: 'queued',
        message: 'Consolidated invoice generation job queued successfully',
      },
      paging: {
        offset: null,
        limit: null,
        total: null,
        totalPages: null,
        hasNext: null,
        hasPrev: null,
      },
    };
  }

  @Get('consolidated/queue/stats')
  @ApiOperation({
    summary: 'Get consolidated billing queue statistics',
    description: 'Get current statistics for the consolidated billing queue',
  })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics retrieved',
  })
  async getConsolidatedQueueStats() {
    const stats = await this.billingQueue.getConsolidatedQueueStats();

    return {
      data: stats,
      paging: {
        offset: null,
        limit: null,
        total: null,
        totalPages: null,
        hasNext: null,
        hasPrev: null,
      },
    };
  }
}
