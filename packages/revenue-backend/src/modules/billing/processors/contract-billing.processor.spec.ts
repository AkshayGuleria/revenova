import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ContractBillingProcessor } from './contract-billing.processor';
import { BillingEngineService } from '../services/billing-engine.service';
import { Job } from 'bullmq';
import { Decimal } from '@prisma/client/runtime/library';

describe('ContractBillingProcessor', () => {
  let processor: ContractBillingProcessor;
  let billingEngine: BillingEngineService;

  const mockBillingEngine = {
    generateInvoiceFromContract: jest.fn(),
    findContractsDueForBilling: jest.fn(),
  };

  beforeEach(async () => {
    // Mock logger to suppress console output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractBillingProcessor,
        {
          provide: BillingEngineService,
          useValue: mockBillingEngine,
        },
      ],
    }).compile();

    processor = module.get<ContractBillingProcessor>(ContractBillingProcessor);
    billingEngine = module.get<BillingEngineService>(BillingEngineService);

    // Prevent unused variable warning
    void billingEngine;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('process - generate-contract-invoice', () => {
    it('should process single contract invoice generation job', async () => {
      const jobData = {
        contractId: 'contract-123',
      };

      const mockJob = {
        id: 'job-123',
        name: 'generate-contract-invoice',
        data: jobData,
      } as Job;

      const mockResult = {
        invoiceId: 'invoice-123',
        invoiceNumber: 'INV-2026-000001',
        total: new Decimal(30000),
      };

      mockBillingEngine.generateInvoiceFromContract.mockResolvedValue(
        mockResult,
      );

      const result = await processor.process(mockJob);

      expect(result).toEqual(mockResult);
      expect(
        mockBillingEngine.generateInvoiceFromContract,
      ).toHaveBeenCalledWith({
        contractId: 'contract-123',
        periodStart: undefined,
        periodEnd: undefined,
      });
    });

    it('should process job with period dates', async () => {
      const jobData = {
        contractId: 'contract-456',
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
      };

      const mockJob = {
        id: 'job-456',
        name: 'generate-contract-invoice',
        data: jobData,
      } as Job;

      const mockResult = {
        invoiceId: 'invoice-456',
        invoiceNumber: 'INV-2026-000002',
        total: new Decimal(30000),
      };

      mockBillingEngine.generateInvoiceFromContract.mockResolvedValue(
        mockResult,
      );

      const result = await processor.process(mockJob);

      expect(result).toEqual(mockResult);
      expect(
        mockBillingEngine.generateInvoiceFromContract,
      ).toHaveBeenCalledWith({
        contractId: 'contract-456',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-03-31'),
      });
    });

    it('should throw error if invoice generation fails', async () => {
      const jobData = {
        contractId: 'invalid-contract',
      };

      const mockJob = {
        id: 'job-789',
        name: 'generate-contract-invoice',
        data: jobData,
      } as Job;

      mockBillingEngine.generateInvoiceFromContract.mockRejectedValue(
        new Error('Contract not found'),
      );

      await expect(processor.process(mockJob)).rejects.toThrow(
        'Contract not found',
      );
    });
  });

  describe('process - batch-contract-billing', () => {
    it('should process batch contract billing job', async () => {
      const jobData = {
        billingDate: '2026-01-01',
        billingPeriod: 'monthly' as const,
      };

      const mockJob = {
        id: 'batch-job-123',
        name: 'batch-contract-billing',
        data: jobData,
      } as Job;

      mockBillingEngine.findContractsDueForBilling.mockResolvedValue([]);

      const result = await processor.process(mockJob);

      expect(mockBillingEngine.findContractsDueForBilling).toHaveBeenCalledWith(
        'monthly',
        new Date('2026-01-01'),
        { afterId: undefined, take: 100 },
      );
      expect(result).toMatchObject({
        processedCount: 0,
        skippedCount: 0,
        failedCount: 0,
      });
    });

    it('should handle quarterly batch billing', async () => {
      const jobData = {
        billingDate: '2026-04-01',
        billingPeriod: 'quarterly' as const,
      };

      const mockJob = {
        id: 'batch-job-456',
        name: 'batch-contract-billing',
        data: jobData,
      } as Job;

      mockBillingEngine.findContractsDueForBilling.mockResolvedValue([]);

      const result = await processor.process(mockJob);

      expect(mockBillingEngine.findContractsDueForBilling).toHaveBeenCalledWith(
        'quarterly',
        new Date('2026-04-01'),
        { afterId: undefined, take: 100 },
      );
      expect(result.message).toContain('quarterly');
    });

    it('should handle annual batch billing', async () => {
      const jobData = {
        billingDate: '2026-01-01',
        billingPeriod: 'annual' as const,
      };

      const mockJob = {
        id: 'batch-job-789',
        name: 'batch-contract-billing',
        data: jobData,
      } as Job;

      mockBillingEngine.findContractsDueForBilling.mockResolvedValue([]);

      const result = await processor.process(mockJob);

      expect(mockBillingEngine.findContractsDueForBilling).toHaveBeenCalledWith(
        'annual',
        new Date('2026-01-01'),
        { afterId: undefined, take: 100 },
      );
      expect(result.message).toContain('annual');
    });
  });

  describe('process - unknown job type', () => {
    it('should throw error for unknown job type', async () => {
      const mockJob = {
        id: 'job-unknown',
        name: 'unknown-job-type',
        data: {},
      } as Job;

      await expect(processor.process(mockJob)).rejects.toThrow(
        'Unknown job type: unknown-job-type',
      );
    });
  });

  describe('event handlers', () => {
    it('should handle onCompleted event', () => {
      const mockJob = {
        id: 'job-123',
        name: 'generate-contract-invoice',
      } as Job;

      // Should not throw
      expect(() => processor.onCompleted(mockJob)).not.toThrow();
    });

    it('should handle onFailed event', () => {
      const mockJob = {
        id: 'job-456',
        name: 'generate-contract-invoice',
      } as Job;

      const error = new Error('Processing failed');

      // Should not throw
      expect(() => processor.onFailed(mockJob, error)).not.toThrow();
    });

    it('should handle onActive event', () => {
      const mockJob = {
        id: 'job-789',
        name: 'generate-contract-invoice',
      } as Job;

      // Should not throw
      expect(() => processor.onActive(mockJob)).not.toThrow();
    });
  });

  describe('batch contract billing (P0-9)', () => {
    beforeEach(() => {
      // mockResolvedValueOnce queues are not drained by clearAllMocks
      mockBillingEngine.findContractsDueForBilling.mockReset();
      mockBillingEngine.generateInvoiceFromContract.mockReset();
    });

    const batchJob = {
      id: 'job-batch',
      name: 'batch-contract-billing',
      data: { billingDate: '2026-02-01', billingPeriod: 'monthly' },
    } as Job<any>;

    it('bills every contract that is due and reports the counts', async () => {
      mockBillingEngine.findContractsDueForBilling.mockImplementation(
        async (_freq: string, _asOf: Date, { afterId }: any) =>
          !afterId ? [{ id: 'c-1' }, { id: 'c-2' }, { id: 'c-3' }] : [],
      );
      mockBillingEngine.generateInvoiceFromContract.mockResolvedValue({
        invoiceId: 'inv',
        total: new Decimal(100),
      });

      const result = await processor.process(batchJob);

      expect(
        mockBillingEngine.generateInvoiceFromContract,
      ).toHaveBeenCalledTimes(3);
      expect(result).toMatchObject({
        processedCount: 3,
        skippedCount: 0,
        failedCount: 0,
      });
    });

    it('passes billingDate to the engine so the period is not "today"', async () => {
      mockBillingEngine.findContractsDueForBilling.mockImplementation(
        async (_f: string, _a: Date, { afterId }: any) =>
          !afterId ? [{ id: 'c-1' }] : [],
      );
      mockBillingEngine.generateInvoiceFromContract.mockResolvedValue({
        invoiceId: 'inv',
        total: new Decimal(1),
      });

      await processor.process(batchJob);

      expect(
        mockBillingEngine.generateInvoiceFromContract,
      ).toHaveBeenCalledWith({
        contractId: 'c-1',
        billingDate: new Date('2026-02-01'),
      });
    });

    it('pages by id cursor so billed contracts leaving the set are not skipped', async () => {
      const page1 = Array.from({ length: 100 }, (_, i) => ({ id: `a-${i}` }));
      mockBillingEngine.findContractsDueForBilling
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce([{ id: 'b-0' }]);
      mockBillingEngine.generateInvoiceFromContract.mockResolvedValue({
        invoiceId: 'inv',
        total: new Decimal(1),
      });

      await processor.process(batchJob);

      expect(
        mockBillingEngine.findContractsDueForBilling,
      ).toHaveBeenNthCalledWith(2, 'monthly', new Date('2026-02-01'), {
        afterId: 'a-99',
        take: 100,
      });
    });

    it('counts an already-billed period as skipped, not failed', async () => {
      const { ConflictException } = jest.requireActual('@nestjs/common');
      mockBillingEngine.findContractsDueForBilling.mockImplementation(
        async (_freq: string, _asOf: Date, { afterId }: any) =>
          !afterId ? [{ id: 'c-1' }, { id: 'c-2' }] : [],
      );
      mockBillingEngine.generateInvoiceFromContract
        .mockResolvedValueOnce({ invoiceId: 'inv-1', total: new Decimal(100) })
        .mockRejectedValueOnce(new ConflictException('already billed'));

      const result = await processor.process(batchJob);

      expect(result).toMatchObject({
        processedCount: 1,
        skippedCount: 1,
        failedCount: 0,
      });
    });

    it('keeps going after a failure instead of abandoning the run', async () => {
      mockBillingEngine.findContractsDueForBilling.mockImplementation(
        async (_freq: string, _asOf: Date, { afterId }: any) =>
          !afterId ? [{ id: 'c-1' }, { id: 'c-2' }, { id: 'c-3' }] : [],
      );
      mockBillingEngine.generateInvoiceFromContract
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ invoiceId: 'inv-2', total: new Decimal(100) })
        .mockResolvedValueOnce({ invoiceId: 'inv-3', total: new Decimal(100) });

      const result = await processor.process(batchJob);

      expect(
        mockBillingEngine.generateInvoiceFromContract,
      ).toHaveBeenCalledTimes(3);
      expect(result).toMatchObject({
        processedCount: 2,
        failedCount: 1,
      });
    });

    it('never reports success while billing nothing', async () => {
      mockBillingEngine.findContractsDueForBilling.mockResolvedValue([]);

      const result = await processor.process(batchJob);

      expect(result).toMatchObject({ processedCount: 0 });
      expect(result.message).not.toMatch(/not yet implemented/i);
    });
  });
});
