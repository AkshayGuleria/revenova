import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ConsolidatedBillingProcessor } from './consolidated-billing.processor';
import { ConsolidatedBillingService } from '../services/consolidated-billing.service';
import { Job } from 'bullmq';
import { Decimal } from '@prisma/client/runtime/library';

describe('ConsolidatedBillingProcessor', () => {
  let processor: ConsolidatedBillingProcessor;
  let consolidatedBillingService: ConsolidatedBillingService;

  const mockConsolidatedBillingService = {
    generateConsolidatedInvoice: jest.fn(),
  };

  beforeEach(async () => {
    // Mock logger to suppress console output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsolidatedBillingProcessor,
        {
          provide: ConsolidatedBillingService,
          useValue: mockConsolidatedBillingService,
        },
      ],
    }).compile();

    processor = module.get<ConsolidatedBillingProcessor>(
      ConsolidatedBillingProcessor,
    );
    consolidatedBillingService = module.get<ConsolidatedBillingService>(
      ConsolidatedBillingService,
    );

    // Prevent unused variable warning
    void consolidatedBillingService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('process', () => {
    it('should process consolidated billing job successfully', async () => {
      const jobData = {
        parentAccountId: 'parent-123',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        includeChildren: true,
      };

      const mockJob = {
        id: 'job-123',
        data: jobData,
      } as Job;

      const mockResult = {
        invoiceId: 'consolidated-invoice-123',
        invoiceNumber: 'CONS-INV-2026-000001',
        total: new Decimal(150000),
        subsidiariesIncluded: 3,
      };

      mockConsolidatedBillingService.generateConsolidatedInvoice.mockResolvedValue(
        mockResult,
      );

      const result = await processor.process(mockJob);

      expect(result).toEqual({
        success: true,
        invoiceId: 'consolidated-invoice-123',
        invoiceNumber: 'CONS-INV-2026-000001',
        total: '150000', // Decimal converted to string
        subsidiariesIncluded: 3,
      });

      expect(
        mockConsolidatedBillingService.generateConsolidatedInvoice,
      ).toHaveBeenCalledWith({
        parentAccountId: 'parent-123',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        includeChildren: true,
      });
    });

    it('should convert ISO date strings to Date objects', async () => {
      const jobData = {
        parentAccountId: 'parent-456',
        periodStart: '2026-02-01T00:00:00.000Z',
        periodEnd: '2026-02-28T23:59:59.999Z',
        includeChildren: false,
      };

      const mockJob = {
        id: 'job-456',
        data: jobData,
      } as Job;

      const mockResult = {
        invoiceId: 'consolidated-invoice-456',
        invoiceNumber: 'CONS-INV-2026-000002',
        total: new Decimal(75000),
        subsidiariesIncluded: 0,
      };

      mockConsolidatedBillingService.generateConsolidatedInvoice.mockResolvedValue(
        mockResult,
      );

      await processor.process(mockJob);

      // Verify dates are converted properly
      const callArgs =
        mockConsolidatedBillingService.generateConsolidatedInvoice.mock
          .calls[0][0];
      expect(callArgs.periodStart).toBeInstanceOf(Date);
      expect(callArgs.periodEnd).toBeInstanceOf(Date);
      expect(callArgs.periodStart.toISOString()).toBe(
        '2026-02-01T00:00:00.000Z',
      );
      expect(callArgs.periodEnd.toISOString()).toBe('2026-02-28T23:59:59.999Z');
    });

    it('should throw error and log when consolidated invoice generation fails', async () => {
      const jobData = {
        parentAccountId: 'parent-789',
        periodStart: '2026-03-01',
        periodEnd: '2026-03-31',
      };

      const mockJob = {
        id: 'job-789',
        data: jobData,
      } as Job;

      const error = new Error('Parent account not found');
      mockConsolidatedBillingService.generateConsolidatedInvoice.mockRejectedValue(
        error,
      );

      await expect(processor.process(mockJob)).rejects.toThrow(
        'Parent account not found',
      );

      // Error logging is suppressed in test environment (NODE_ENV=test)
      // to avoid confusing test output from background job failures
      expect(Logger.prototype.error).not.toHaveBeenCalled();
    });

    it('should log error in non-test environment when job fails', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const jobData = {
        parentAccountId: 'parent-prod',
        periodStart: '2026-03-01',
        periodEnd: '2026-03-31',
      };

      const mockJob = {
        id: 'job-prod',
        data: jobData,
      } as Job;

      const error = new Error('Production error');
      mockConsolidatedBillingService.generateConsolidatedInvoice.mockRejectedValue(
        error,
      );

      await expect(processor.process(mockJob)).rejects.toThrow(
        'Production error',
      );

      // In non-test environment, error should be logged
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to generate consolidated invoice'),
        error.stack,
      );

      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should return correct job result structure with Decimal conversion', async () => {
      const jobData = {
        parentAccountId: 'parent-999',
        periodStart: '2026-04-01',
        periodEnd: '2026-04-30',
        includeChildren: true,
      };

      const mockJob = {
        id: 'job-999',
        data: jobData,
      } as Job;

      const mockResult = {
        invoiceId: 'inv-999',
        invoiceNumber: 'CONS-999',
        total: new Decimal('123456.78'),
        subsidiariesIncluded: 5,
      };

      mockConsolidatedBillingService.generateConsolidatedInvoice.mockResolvedValue(
        mockResult,
      );

      const result = await processor.process(mockJob);

      // Verify Decimal is converted to string
      expect(typeof result.total).toBe('string');
      expect(result.total).toBe('123456.78');
      expect(result.success).toBe(true);
    });

    it('should handle optional includeChildren parameter', async () => {
      const jobData = {
        parentAccountId: 'parent-111',
        periodStart: '2026-05-01',
        periodEnd: '2026-05-31',
        // includeChildren is not provided, should be passed as undefined
      };

      const mockJob = {
        id: 'job-111',
        data: jobData,
      } as Job;

      const mockResult = {
        invoiceId: 'inv-111',
        invoiceNumber: 'CONS-111',
        total: new Decimal(50000),
        subsidiariesIncluded: 0,
      };

      mockConsolidatedBillingService.generateConsolidatedInvoice.mockResolvedValue(
        mockResult,
      );

      await processor.process(mockJob);

      expect(
        mockConsolidatedBillingService.generateConsolidatedInvoice,
      ).toHaveBeenCalledWith({
        parentAccountId: 'parent-111',
        periodStart: new Date('2026-05-01'),
        periodEnd: new Date('2026-05-31'),
        includeChildren: undefined,
      });
    });

    it('should log processing start and completion', async () => {
      const jobData = {
        parentAccountId: 'parent-222',
        periodStart: '2026-06-01',
        periodEnd: '2026-06-30',
        includeChildren: true,
      };

      const mockJob = {
        id: 'job-222',
        data: jobData,
      } as Job;

      const mockResult = {
        invoiceId: 'inv-222',
        invoiceNumber: 'CONS-222',
        total: new Decimal(90000),
        subsidiariesIncluded: 2,
      };

      mockConsolidatedBillingService.generateConsolidatedInvoice.mockResolvedValue(
        mockResult,
      );

      await processor.process(mockJob);

      // Verify start logging
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('Processing consolidated billing job job-222'),
      );

      // Verify completion logging
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('Consolidated invoice CONS-222 generated'),
      );
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('Included 2 subsidiaries'),
      );
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.stringContaining('Total: 90000'),
      );
    });
  });
});
