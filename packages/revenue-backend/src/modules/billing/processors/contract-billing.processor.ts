import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { ConflictException, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BillingEngineService } from '../services/billing-engine.service';
import { QUEUE_NAMES, JOB_TYPES } from '../../../common/queues';

export interface GenerateContractInvoiceJobData {
  contractId: string;
  periodStart?: string;
  periodEnd?: string;
}

export interface BatchContractBillingJobData {
  billingDate: string;
  billingPeriod: 'monthly' | 'quarterly' | 'annual';
}

@Processor(QUEUE_NAMES.CONTRACT_BILLING, {
  concurrency: 5, // Process 5 contract billing jobs concurrently
})
export class ContractBillingProcessor extends WorkerHost {
  private readonly logger = new Logger(ContractBillingProcessor.name);

  constructor(private readonly billingEngine: BillingEngineService) {
    super();
  }

  async process(
    job: Job<GenerateContractInvoiceJobData | BatchContractBillingJobData>,
  ): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    switch (job.name) {
      case JOB_TYPES.GENERATE_CONTRACT_INVOICE:
        return this.handleGenerateContractInvoice(
          job as Job<GenerateContractInvoiceJobData>,
        );

      case JOB_TYPES.BATCH_CONTRACT_BILLING:
        return this.handleBatchContractBilling(
          job as Job<BatchContractBillingJobData>,
        );

      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  /**
   * Handle single contract invoice generation
   */
  private async handleGenerateContractInvoice(
    job: Job<GenerateContractInvoiceJobData>,
  ) {
    const { contractId, periodStart, periodEnd } = job.data;

    this.logger.log(`Generating invoice for contract ${contractId}`);

    let result: any;
    try {
      result = await this.billingEngine.generateInvoiceFromContract({
        contractId,
        periodStart: periodStart ? new Date(periodStart) : undefined,
        periodEnd: periodEnd ? new Date(periodEnd) : undefined,
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        // Invoice already exists for this contract + period — not an error for
        // the queue worker; treat as a successful no-op so the job completes
        // instead of entering the failed/retry cycle.
        this.logger.warn(
          `Skipping duplicate invoice generation for contract ${contractId}: ${error.message}`,
        );
        return { skipped: true, reason: error.message };
      }
      throw error;
    }

    this.logger.log(
      `Invoice ${result.invoiceNumber} generated for contract ${contractId}`,
    );

    return result;
  }

  /**
   * Handle batch contract billing (scheduled job)
   */
  private async handleBatchContractBilling(
    job: Job<BatchContractBillingJobData>,
  ) {
    const { billingDate, billingPeriod } = job.data;

    this.logger.log(
      `Running batch contract billing for ${billingPeriod} on ${billingDate}`,
    );

    // TODO: Implement batch billing logic
    // 1. Find all contracts due for billing
    // 2. Generate invoices for each contract
    // 3. Return summary of processed contracts

    return {
      processedCount: 0,
      failedCount: 0,
      message: 'Batch billing not yet implemented',
    };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed with error: ${error.message}`);
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Job ${job.id} started processing`);
  }
}
