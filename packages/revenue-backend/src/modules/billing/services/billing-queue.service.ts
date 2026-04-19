import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, JOB_TYPES } from '../../../common/queues';
import {
  GenerateContractInvoiceJobData,
  BatchContractBillingJobData,
} from '../processors/contract-billing.processor';
import { ConsolidatedBillingJobData } from '../processors/consolidated-billing.processor';

@Injectable()
export class BillingQueueService {
  private readonly logger = new Logger(BillingQueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.CONTRACT_BILLING)
    private contractBillingQueue: Queue,
    @InjectQueue(QUEUE_NAMES.CONSOLIDATED_BILLING)
    private consolidatedBillingQueue: Queue,
  ) {}

  /**
   * Queue a contract invoice generation job
   */
  async queueContractInvoiceGeneration(
    data: GenerateContractInvoiceJobData,
  ): Promise<string> {
    const job = await this.contractBillingQueue.add(
      JOB_TYPES.GENERATE_CONTRACT_INVOICE,
      data,
      {
        // Deterministic job ID (Layer 3 dedup): BullMQ silently drops a new
        // job if one with the same ID already exists in waiting/active state.
        jobId: `contract-invoice:${data.contractId}:${data.periodStart ?? 'auto'}:${data.periodEnd ?? 'auto'}`,
        removeOnComplete: { count: 100, age: 3600 },
        removeOnFail: false,
      },
    );

    this.logger.log(
      `Queued contract invoice generation job ${job.id} for contract ${data.contractId}`,
    );

    return job.id!;
  }

  /**
   * Queue a batch contract billing job
   */
  async queueBatchContractBilling(
    data: BatchContractBillingJobData,
  ): Promise<string> {
    const job = await this.contractBillingQueue.add(
      JOB_TYPES.BATCH_CONTRACT_BILLING,
      data,
      {
        removeOnComplete: { count: 100, age: 3600 },
        removeOnFail: false,
      },
    );

    this.logger.log(
      `Queued batch contract billing job ${job.id} for ${data.billingPeriod}`,
    );

    return job.id!;
  }

  /**
   * Queue a consolidated invoice generation job
   */
  async queueConsolidatedInvoiceGeneration(
    data: ConsolidatedBillingJobData,
  ): Promise<string> {
    const job = await this.consolidatedBillingQueue.add(
      JOB_TYPES.GENERATE_CONSOLIDATED_INVOICE,
      data,
      {
        // Deterministic job ID (Layer 3 dedup): prevents duplicate consolidated
        // billing jobs for the same parent account + period from being enqueued.
        jobId: `consolidated:${data.parentAccountId}:${data.periodStart}:${data.periodEnd}`,
        removeOnComplete: { count: 100, age: 3600 },
        removeOnFail: false,
      },
    );

    this.logger.log(
      `Queued consolidated invoice generation job ${job.id} for parent account ${data.parentAccountId}`,
    );

    return job.id!;
  }

  /**
   * Get job status (checks both queues)
   */
  async getJobStatus(jobId: string) {
    // Try contract billing queue first
    let job = await this.contractBillingQueue.getJob(jobId);

    // If not found, try consolidated billing queue
    if (!job) {
      job = await this.consolidatedBillingQueue.getJob(jobId);
    }

    if (!job) {
      return null;
    }

    const state = await job.getState();

    // Map BullMQ state to frontend-expected status values
    const status =
      state === 'waiting' || state === 'delayed' ? 'queued' : state;

    return {
      id: job.id,
      type: job.name,
      data: job.data,
      status,
      progress: job.progress,
      result: job.returnvalue,
      error: job.failedReason,
      attemptsMade: job.attemptsMade,
      maxAttempts: (job.opts as any)?.attempts ?? 3,
      createdAt: job.timestamp
        ? new Date(job.timestamp).toISOString()
        : new Date().toISOString(),
      processedAt: job.processedOn
        ? new Date(job.processedOn).toISOString()
        : undefined,
      finishedAt: job.finishedOn
        ? new Date(job.finishedOn).toISOString()
        : undefined,
    };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.contractBillingQueue.getWaitingCount(),
      this.contractBillingQueue.getActiveCount(),
      this.contractBillingQueue.getCompletedCount(),
      this.contractBillingQueue.getFailedCount(),
      this.contractBillingQueue.getDelayedCount(),
    ]);

    return {
      queue: QUEUE_NAMES.CONTRACT_BILLING,
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }

  /**
   * Get consolidated billing queue statistics
   */
  async getConsolidatedQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.consolidatedBillingQueue.getWaitingCount(),
      this.consolidatedBillingQueue.getActiveCount(),
      this.consolidatedBillingQueue.getCompletedCount(),
      this.consolidatedBillingQueue.getFailedCount(),
      this.consolidatedBillingQueue.getDelayedCount(),
    ]);

    return {
      queue: QUEUE_NAMES.CONSOLIDATED_BILLING,
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }
}
