import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { BillingQueueService } from './billing-queue.service';
import { QUEUE_NAMES } from '../../../common/queues';

describe('BillingQueueService', () => {
  let service: BillingQueueService;
  let mockContractQueue: any;
  let mockConsolidatedQueue: any;

  beforeEach(async () => {
    mockContractQueue = {
      add: jest.fn(),
      getJob: jest.fn(),
      getWaitingCount: jest.fn(),
      getActiveCount: jest.fn(),
      getCompletedCount: jest.fn(),
      getFailedCount: jest.fn(),
      getDelayedCount: jest.fn(),
    };

    mockConsolidatedQueue = {
      add: jest.fn(),
      getJob: jest.fn(),
      getWaitingCount: jest.fn(),
      getActiveCount: jest.fn(),
      getCompletedCount: jest.fn(),
      getFailedCount: jest.fn(),
      getDelayedCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingQueueService,
        {
          provide: getQueueToken(QUEUE_NAMES.CONTRACT_BILLING),
          useValue: mockContractQueue,
        },
        {
          provide: getQueueToken(QUEUE_NAMES.CONSOLIDATED_BILLING),
          useValue: mockConsolidatedQueue,
        },
      ],
    }).compile();

    service = module.get<BillingQueueService>(BillingQueueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('queueContractInvoiceGeneration', () => {
    it('should queue a contract invoice generation job', async () => {
      const jobData = {
        contractId: 'contract-123',
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
      };

      const mockJob = { id: 'job-123' };
      mockContractQueue.add.mockResolvedValue(mockJob);

      const result = await service.queueContractInvoiceGeneration(jobData);

      expect(result).toBe('job-123');
      expect(mockContractQueue.add).toHaveBeenCalledWith(
        'generate-contract-invoice',
        jobData,
        {
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    });

    it('should queue job without optional period dates', async () => {
      const jobData = {
        contractId: 'contract-123',
      };

      const mockJob = { id: 'job-456' };
      mockContractQueue.add.mockResolvedValue(mockJob);

      const result = await service.queueContractInvoiceGeneration(jobData);

      expect(result).toBe('job-456');
      expect(mockContractQueue.add).toHaveBeenCalledWith(
        'generate-contract-invoice',
        jobData,
        expect.any(Object),
      );
    });
  });

  describe('queueBatchContractBilling', () => {
    it('should queue a batch contract billing job', async () => {
      const jobData = {
        billingDate: '2026-01-01',
        billingPeriod: 'monthly' as const,
      };

      const mockJob = { id: 'batch-job-123' };
      mockContractQueue.add.mockResolvedValue(mockJob);

      const result = await service.queueBatchContractBilling(jobData);

      expect(result).toBe('batch-job-123');
      expect(mockContractQueue.add).toHaveBeenCalledWith(
        'batch-contract-billing',
        jobData,
        {
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    });

    it('should queue batch job with quarterly period', async () => {
      const jobData = {
        billingDate: '2026-01-01',
        billingPeriod: 'quarterly' as const,
      };

      const mockJob = { id: 'batch-job-456' };
      mockContractQueue.add.mockResolvedValue(mockJob);

      const result = await service.queueBatchContractBilling(jobData);

      expect(result).toBe('batch-job-456');
    });

    it('should queue batch job with annual period', async () => {
      const jobData = {
        billingDate: '2026-01-01',
        billingPeriod: 'annual' as const,
      };

      const mockJob = { id: 'batch-job-789' };
      mockContractQueue.add.mockResolvedValue(mockJob);

      const result = await service.queueBatchContractBilling(jobData);

      expect(result).toBe('batch-job-789');
    });
  });

  describe('getJobStatus', () => {
    it('should return null if job not found', async () => {
      mockContractQueue.getJob.mockResolvedValue(null);

      const result = await service.getJobStatus('nonexistent-job');

      expect(result).toBeNull();
      expect(mockContractQueue.getJob).toHaveBeenCalledWith('nonexistent-job');
    });

    it('should return job status for waiting job', async () => {
      const mockJob = {
        id: 'job-123',
        name: 'generate-contract-invoice',
        data: { contractId: 'contract-123' },
        getState: jest.fn().mockResolvedValue('waiting'),
        progress: 0,
        returnvalue: null,
        failedReason: null,
        attemptsMade: 0,
        processedOn: null,
        finishedOn: null,
      };

      mockContractQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getJobStatus('job-123');

      expect(result).toEqual({
        id: 'job-123',
        name: 'generate-contract-invoice',
        data: { contractId: 'contract-123' },
        state: 'waiting',
        progress: 0,
        result: null,
        error: null,
        attemptsMade: 0,
        processedOn: null,
        finishedOn: null,
      });
    });

    it('should return job status for completed job', async () => {
      const mockJob = {
        id: 'job-123',
        name: 'generate-contract-invoice',
        data: { contractId: 'contract-123' },
        getState: jest.fn().mockResolvedValue('completed'),
        progress: 100,
        returnvalue: {
          invoiceId: 'invoice-123',
          invoiceNumber: 'INV-2026-000001',
        },
        failedReason: null,
        attemptsMade: 1,
        processedOn: 1737154400000,
        finishedOn: 1737154405000,
      };

      mockContractQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getJobStatus('job-123');

      expect(result).toEqual({
        id: 'job-123',
        name: 'generate-contract-invoice',
        data: { contractId: 'contract-123' },
        state: 'completed',
        progress: 100,
        result: {
          invoiceId: 'invoice-123',
          invoiceNumber: 'INV-2026-000001',
        },
        error: null,
        attemptsMade: 1,
        processedOn: 1737154400000,
        finishedOn: 1737154405000,
      });
    });

    it('should return job status for failed job', async () => {
      const mockJob = {
        id: 'job-123',
        name: 'generate-contract-invoice',
        data: { contractId: 'contract-123' },
        getState: jest.fn().mockResolvedValue('failed'),
        progress: 0,
        returnvalue: null,
        failedReason: 'Contract not found',
        attemptsMade: 3,
        processedOn: 1737154400000,
        finishedOn: 1737154410000,
      };

      mockContractQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getJobStatus('job-123');

      expect(result?.status).toBe('failed');
      expect(result?.error).toBe('Contract not found');
      expect(result?.attemptsMade).toBe(3);
    });

    it('should return job status for active job with progress', async () => {
      const mockJob = {
        id: 'job-123',
        name: 'batch-contract-billing',
        data: { billingDate: '2026-01-01', billingPeriod: 'monthly' },
        getState: jest.fn().mockResolvedValue('active'),
        progress: 50,
        returnvalue: null,
        failedReason: null,
        attemptsMade: 1,
        processedOn: 1737154400000,
        finishedOn: null,
      };

      mockContractQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getJobStatus('job-123');

      expect(result?.status).toBe('active');
      expect(result?.progress).toBe(50);
      expect(result?.finishedAt).toBeUndefined();
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      mockContractQueue.getWaitingCount.mockResolvedValue(5);
      mockContractQueue.getActiveCount.mockResolvedValue(2);
      mockContractQueue.getCompletedCount.mockResolvedValue(100);
      mockContractQueue.getFailedCount.mockResolvedValue(3);
      mockContractQueue.getDelayedCount.mockResolvedValue(1);

      const result = await service.getQueueStats();

      expect(result).toEqual({
        queue: 'contract-billing',
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
        total: 111,
      });
    });

    it('should return empty queue statistics', async () => {
      mockContractQueue.getWaitingCount.mockResolvedValue(0);
      mockContractQueue.getActiveCount.mockResolvedValue(0);
      mockContractQueue.getCompletedCount.mockResolvedValue(0);
      mockContractQueue.getFailedCount.mockResolvedValue(0);
      mockContractQueue.getDelayedCount.mockResolvedValue(0);

      const result = await service.getQueueStats();

      expect(result).toEqual({
        queue: 'contract-billing',
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        total: 0,
      });
    });

    it('should handle large numbers correctly', async () => {
      mockContractQueue.getWaitingCount.mockResolvedValue(1000);
      mockContractQueue.getActiveCount.mockResolvedValue(50);
      mockContractQueue.getCompletedCount.mockResolvedValue(50000);
      mockContractQueue.getFailedCount.mockResolvedValue(100);
      mockContractQueue.getDelayedCount.mockResolvedValue(25);

      const result = await service.getQueueStats();

      expect(result.total).toBe(51175);
    });
  });

  describe('queueConsolidatedInvoiceGeneration', () => {
    it('should queue a consolidated invoice generation job', async () => {
      const jobData = {
        parentAccountId: 'parent-123',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        includeChildren: true,
      };

      const mockJob = { id: 'consolidated-job-123' };
      mockConsolidatedQueue.add.mockResolvedValue(mockJob);

      const result = await service.queueConsolidatedInvoiceGeneration(jobData);

      expect(result).toBe('consolidated-job-123');
      expect(mockConsolidatedQueue.add).toHaveBeenCalledWith(
        'generate-consolidated-invoice',
        jobData,
        {
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    });

    it('should queue job without optional includeChildren', async () => {
      const jobData = {
        parentAccountId: 'parent-456',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
      };

      const mockJob = { id: 'consolidated-job-456' };
      mockConsolidatedQueue.add.mockResolvedValue(mockJob);

      const result = await service.queueConsolidatedInvoiceGeneration(jobData);

      expect(result).toBe('consolidated-job-456');
      expect(mockConsolidatedQueue.add).toHaveBeenCalledWith(
        'generate-consolidated-invoice',
        jobData,
        expect.any(Object),
      );
    });
  });

  describe('getConsolidatedQueueStats', () => {
    it('should return consolidated billing queue statistics', async () => {
      mockConsolidatedQueue.getWaitingCount.mockResolvedValue(3);
      mockConsolidatedQueue.getActiveCount.mockResolvedValue(1);
      mockConsolidatedQueue.getCompletedCount.mockResolvedValue(50);
      mockConsolidatedQueue.getFailedCount.mockResolvedValue(2);
      mockConsolidatedQueue.getDelayedCount.mockResolvedValue(0);

      const result = await service.getConsolidatedQueueStats();

      expect(result).toEqual({
        queue: 'consolidated-billing',
        waiting: 3,
        active: 1,
        completed: 50,
        failed: 2,
        delayed: 0,
        total: 56,
      });
    });

    it('should return empty consolidated queue statistics', async () => {
      mockConsolidatedQueue.getWaitingCount.mockResolvedValue(0);
      mockConsolidatedQueue.getActiveCount.mockResolvedValue(0);
      mockConsolidatedQueue.getCompletedCount.mockResolvedValue(0);
      mockConsolidatedQueue.getFailedCount.mockResolvedValue(0);
      mockConsolidatedQueue.getDelayedCount.mockResolvedValue(0);

      const result = await service.getConsolidatedQueueStats();

      expect(result.total).toBe(0);
    });
  });
});
