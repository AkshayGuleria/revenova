import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  const mockPrismaService = {
    contract: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    account: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // getMrr
  // ---------------------------------------------------------------------------
  describe('getMrr', () => {
    it('should return 0 mrr when there are no active contracts', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([]);

      const result = await service.getMrr('2026-05-31');

      expect(result.data).toMatchObject({
        mrr: 0,
        activeContracts: 0,
        asOf: '2026-05-31',
      });
      expect(result.paging).toEqual(
        expect.objectContaining({ offset: null, limit: null, total: null }),
      );
    });

    it('should divide annual contract value by 12', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([
        { contractValue: 120000, billingFrequency: 'annual' },
      ]);

      const result = await service.getMrr('2026-05-31');

      expect((result.data as any).mrr).toBe(10000);
    });

    it('should divide quarterly contract value by 3', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([
        { contractValue: 30000, billingFrequency: 'quarterly' },
      ]);

      const result = await service.getMrr('2026-05-31');

      expect((result.data as any).mrr).toBe(10000);
    });

    it('should keep monthly contract value as-is', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([
        { contractValue: 5000, billingFrequency: 'monthly' },
      ]);

      const result = await service.getMrr('2026-05-31');

      expect((result.data as any).mrr).toBe(5000);
    });

    it('should aggregate contracts with mixed billing frequencies', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([
        { contractValue: 12000, billingFrequency: 'annual' },   // → 1000 / month
        { contractValue: 9000, billingFrequency: 'quarterly' },  // → 3000 / month
        { contractValue: 500, billingFrequency: 'monthly' },     // → 500 / month
      ]);

      const result = await service.getMrr('2026-05-31');

      expect((result.data as any).mrr).toBe(4500);
      expect((result.data as any).activeContracts).toBe(3);
    });

    it('should default billingFrequency to annual when unrecognised', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([
        { contractValue: 24000, billingFrequency: 'unknown' },
      ]);

      const result = await service.getMrr('2026-05-31');

      expect((result.data as any).mrr).toBe(2000);
    });

    it('should default asOf to today when not provided', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([]);

      const result = await service.getMrr();
      const today = new Date().toISOString().split('T')[0];

      expect((result.data as any).asOf).toBe(today);
    });

    it('should query contracts within the asOf window', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([]);

      await service.getMrr('2026-03-15');

      expect(mockPrismaService.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'active',
            startDate: { lte: new Date('2026-03-15') },
            endDate: { gte: new Date('2026-03-15') },
          }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getArr
  // ---------------------------------------------------------------------------
  describe('getArr', () => {
    it('should return ARR as MRR * 12', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([
        { contractValue: 120000, billingFrequency: 'annual' }, // mrr = 10000
      ]);

      const result = await service.getArr('2026-05-31');

      expect((result.data as any).arr).toBe(120000);
      expect((result.data as any).mrr).toBe(10000);
    });

    it('should return 0 arr when there are no active contracts', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([]);

      const result = await service.getArr('2026-05-31');

      expect((result.data as any).arr).toBe(0);
      expect((result.data as any).mrr).toBe(0);
    });

    it('should carry through activeContracts count', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([
        { contractValue: 60000, billingFrequency: 'annual' },
        { contractValue: 60000, billingFrequency: 'annual' },
      ]);

      const result = await service.getArr('2026-05-31');

      expect((result.data as any).activeContracts).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // getSummary
  // ---------------------------------------------------------------------------
  describe('getSummary', () => {
    it('should return combined summary with mrr, arr, counts, and currency', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([
        { contractValue: 120000, billingFrequency: 'annual' }, // mrr = 10000
      ]);
      mockPrismaService.contract.count.mockResolvedValue(5);
      mockPrismaService.account.count.mockResolvedValue(3);

      const result = await service.getSummary('2026-05-31');
      const data = result.data as any;

      expect(data.mrr).toBe(10000);
      expect(data.arr).toBe(120000);
      expect(data.activeContracts).toBe(5);
      expect(data.totalAccounts).toBe(3);
      expect(data.currency).toBe('EUR');
      expect(data.asOf).toBe('2026-05-31');
    });

    it('should return null paging for summary', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([]);
      mockPrismaService.contract.count.mockResolvedValue(0);
      mockPrismaService.account.count.mockResolvedValue(0);

      const result = await service.getSummary('2026-05-31');

      expect(result.paging).toEqual(
        expect.objectContaining({
          offset: null,
          limit: null,
          total: null,
          totalPages: null,
          hasNext: null,
          hasPrev: null,
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getChurn
  // ---------------------------------------------------------------------------
  describe('getChurn', () => {
    it('should count churned contracts and sum annualised values', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([
        {
          contractValue: 120000,
          billingFrequency: 'annual',
          accountId: 'a1',
          contractNumber: 'C-001',
        },
        {
          contractValue: 3000,
          billingFrequency: 'monthly',
          accountId: 'a2',
          contractNumber: 'C-002',
        },
      ]);

      const result = await service.getChurn('2026-01-01', '2026-05-31');
      const data = result.data as any;

      // annual: 120000, monthly: 3000 * 12 = 36000 → total = 156000
      expect(data.churnedContracts).toBe(2);
      expect(data.churnedArr).toBe(156000);
      expect(data.from).toBe('2026-01-01');
      expect(data.to).toBe('2026-05-31');
    });

    it('should annualise quarterly churn correctly', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([
        {
          contractValue: 30000,
          billingFrequency: 'quarterly',
          accountId: 'a1',
          contractNumber: 'C-003',
        },
      ]);

      const result = await service.getChurn('2026-01-01', '2026-05-31');

      // quarterly: 30000 * 4 = 120000
      expect((result.data as any).churnedArr).toBe(120000);
    });

    it('should return 0 when no churned contracts', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([]);

      const result = await service.getChurn('2026-01-01', '2026-05-31');

      expect((result.data as any).churnedContracts).toBe(0);
      expect((result.data as any).churnedArr).toBe(0);
    });

    it('should filter by expired and cancelled status', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([]);

      await service.getChurn('2026-01-01', '2026-05-31');

      expect(mockPrismaService.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['expired', 'cancelled'] },
          }),
        }),
      );
    });

    it('should throw BadRequestException when from is after to', async () => {
      await expect(
        service.getChurn('2026-06-01', '2026-01-01'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // getBookings
  // ---------------------------------------------------------------------------
  describe('getBookings', () => {
    it('should count new contracts and sum total booked value', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([
        {
          contractValue: 50000,
          billingFrequency: 'annual',
          contractNumber: 'C-100',
          accountId: 'a1',
        },
        {
          contractValue: 25000,
          billingFrequency: 'annual',
          contractNumber: 'C-101',
          accountId: 'a2',
        },
      ]);

      const result = await service.getBookings('2026-01-01', '2026-05-31');
      const data = result.data as any;

      expect(data.newContracts).toBe(2);
      expect(data.totalBookings).toBe(75000);
      expect(data.from).toBe('2026-01-01');
      expect(data.to).toBe('2026-05-31');
    });

    it('should return 0 when no new contracts in range', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([]);

      const result = await service.getBookings('2026-01-01', '2026-05-31');

      expect((result.data as any).newContracts).toBe(0);
      expect((result.data as any).totalBookings).toBe(0);
    });

    it('should query by createdAt date range', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([]);

      await service.getBookings('2026-01-01', '2026-05-31');

      expect(mockPrismaService.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-05-31'),
            },
          }),
        }),
      );
    });

    it('should throw BadRequestException when from is after to', async () => {
      await expect(
        service.getBookings('2026-06-01', '2026-01-01'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should sum fractional contract values correctly', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([
        {
          contractValue: 10000.5,
          billingFrequency: 'annual',
          contractNumber: 'C-200',
          accountId: 'a1',
        },
        {
          contractValue: 999.99,
          billingFrequency: 'annual',
          contractNumber: 'C-201',
          accountId: 'a2',
        },
      ]);

      const result = await service.getBookings('2026-01-01', '2026-05-31');

      expect((result.data as any).totalBookings).toBe(11000.49);
    });
  });
});
