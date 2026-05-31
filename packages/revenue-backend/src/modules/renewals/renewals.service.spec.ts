import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RenewalsService } from './renewals.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('RenewalsService', () => {
  let service: RenewalsService;

  const mockPrismaService = {
    contract: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RenewalsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<RenewalsService>(RenewalsService);
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // getUpcoming
  // ---------------------------------------------------------------------------

  describe('getUpcoming', () => {
    it('returns contracts expiring within 90 days with daysUntilExpiry', async () => {
      const today = new Date();
      const inSixtyDays = new Date(today);
      inSixtyDays.setDate(inSixtyDays.getDate() + 60);

      const mockContract = {
        id: 'contract-1',
        contractNumber: 'CNT-001',
        status: 'active',
        autoRenew: true,
        endDate: inSixtyDays,
        accountId: 'account-1',
        account: { id: 'account-1', accountName: 'Acme Corp' },
      };

      mockPrismaService.contract.findMany.mockResolvedValue([mockContract]);
      mockPrismaService.contract.count.mockResolvedValue(1);

      const result = await service.getUpcoming(90, 0, 20);

      expect(result.data).toHaveLength(1);
      const item = (result.data as any[])[0];
      expect(item.daysUntilExpiry).toBeGreaterThanOrEqual(59);
      expect(item.daysUntilExpiry).toBeLessThanOrEqual(61);
      expect(item.contractNumber).toBe('CNT-001');
      expect(result.paging.total).toBe(1);
      expect(result.paging.offset).toBe(0);
      expect(result.paging.limit).toBe(20);

      expect(mockPrismaService.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'active' }),
          skip: 0,
          take: 20,
        }),
      );
    });

    it('respects custom days, offset, and limit parameters', async () => {
      const today = new Date();
      const inTwentyDays = new Date(today);
      inTwentyDays.setDate(inTwentyDays.getDate() + 20);

      const mockContract = {
        id: 'contract-2',
        contractNumber: 'CNT-002',
        status: 'active',
        autoRenew: false,
        endDate: inTwentyDays,
        accountId: 'account-2',
        account: { id: 'account-2', accountName: 'Beta Ltd' },
      };

      mockPrismaService.contract.findMany.mockResolvedValue([mockContract]);
      mockPrismaService.contract.count.mockResolvedValue(5);

      const result = await service.getUpcoming(30, 10, 5);

      expect(result.paging.offset).toBe(10);
      expect(result.paging.limit).toBe(5);
      expect(result.paging.total).toBe(5);

      expect(mockPrismaService.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });

    it('returns empty list when no contracts are expiring', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([]);
      mockPrismaService.contract.count.mockResolvedValue(0);

      const result = await service.getUpcoming(90, 0, 20);

      expect(result.data).toHaveLength(0);
      expect(result.paging.total).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getOverdue
  // ---------------------------------------------------------------------------

  describe('getOverdue', () => {
    it('returns active contracts past end date with daysOverdue', async () => {
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const mockContract = {
        id: 'contract-3',
        contractNumber: 'CNT-003',
        status: 'active',
        autoRenew: false,
        endDate: thirtyDaysAgo,
        accountId: 'account-3',
        account: { id: 'account-3', accountName: 'Gamma Inc' },
      };

      mockPrismaService.contract.findMany.mockResolvedValue([mockContract]);
      mockPrismaService.contract.count.mockResolvedValue(1);

      const result = await service.getOverdue(0, 20);

      expect(result.data).toHaveLength(1);
      const item = (result.data as any[])[0];
      expect(item.daysOverdue).toBeGreaterThanOrEqual(29);
      expect(item.daysOverdue).toBeLessThanOrEqual(31);
      expect(item.contractNumber).toBe('CNT-003');
      expect(result.paging.total).toBe(1);

      expect(mockPrismaService.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'active',
            endDate: expect.objectContaining({ lt: expect.any(Date) }),
          }),
        }),
      );
    });

    it('returns empty list when no contracts are overdue', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([]);
      mockPrismaService.contract.count.mockResolvedValue(0);

      const result = await service.getOverdue(0, 20);

      expect(result.data).toHaveLength(0);
      expect(result.paging.total).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getStatus
  // ---------------------------------------------------------------------------

  describe('getStatus', () => {
    it('returns expiring_soon for contract with <= 90 days remaining', async () => {
      const today = new Date();
      const inFortyFiveDays = new Date(today);
      inFortyFiveDays.setDate(inFortyFiveDays.getDate() + 45);

      mockPrismaService.contract.findUnique.mockResolvedValue({
        id: 'contract-4',
        contractNumber: 'CNT-004',
        status: 'active',
        autoRenew: true,
        endDate: inFortyFiveDays,
        accountId: 'account-4',
        account: { id: 'account-4', accountName: 'Delta Co' },
      });

      const result = await service.getStatus('contract-4');
      const data = result.data as any;

      expect(data.renewalStatus).toBe('expiring_soon');
      expect(data.daysUntilExpiry).toBeGreaterThan(0);
      expect(data.daysUntilExpiry).toBeLessThanOrEqual(90);
      expect(data.contractId).toBe('contract-4');
      expect(data.autoRenew).toBe(true);
    });

    it('returns overdue for active contract with endDate in the past', async () => {
      const today = new Date();
      const tenDaysAgo = new Date(today);
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      mockPrismaService.contract.findUnique.mockResolvedValue({
        id: 'contract-5',
        contractNumber: 'CNT-005',
        status: 'active',
        autoRenew: false,
        endDate: tenDaysAgo,
        accountId: 'account-5',
        account: { id: 'account-5', accountName: 'Epsilon Ltd' },
      });

      const result = await service.getStatus('contract-5');
      const data = result.data as any;

      expect(data.renewalStatus).toBe('overdue');
      expect(data.daysUntilExpiry).toBeLessThan(0);
    });

    it('returns active for contract with more than 90 days remaining', async () => {
      const today = new Date();
      const inOneHundredDays = new Date(today);
      inOneHundredDays.setDate(inOneHundredDays.getDate() + 120);

      mockPrismaService.contract.findUnique.mockResolvedValue({
        id: 'contract-6',
        contractNumber: 'CNT-006',
        status: 'active',
        autoRenew: true,
        endDate: inOneHundredDays,
        accountId: 'account-6',
        account: { id: 'account-6', accountName: 'Zeta Corp' },
      });

      const result = await service.getStatus('contract-6');
      const data = result.data as any;

      expect(data.renewalStatus).toBe('active');
      expect(data.daysUntilExpiry).toBeGreaterThan(90);
    });

    it('returns expired for contract with status expired', async () => {
      const today = new Date();
      const lastYear = new Date(today);
      lastYear.setFullYear(lastYear.getFullYear() - 1);

      mockPrismaService.contract.findUnique.mockResolvedValue({
        id: 'contract-7',
        contractNumber: 'CNT-007',
        status: 'expired',
        autoRenew: false,
        endDate: lastYear,
        accountId: 'account-7',
        account: { id: 'account-7', accountName: 'Eta Inc' },
      });

      const result = await service.getStatus('contract-7');
      const data = result.data as any;

      expect(data.renewalStatus).toBe('expired');
    });

    it('returns expired for contract with status cancelled', async () => {
      const today = new Date();
      const lastMonth = new Date(today);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      mockPrismaService.contract.findUnique.mockResolvedValue({
        id: 'contract-8',
        contractNumber: 'CNT-008',
        status: 'cancelled',
        autoRenew: false,
        endDate: lastMonth,
        accountId: 'account-8',
        account: { id: 'account-8', accountName: 'Theta Ltd' },
      });

      const result = await service.getStatus('contract-8');
      const data = result.data as any;

      expect(data.renewalStatus).toBe('expired');
    });

    it('throws NotFoundException for unknown contractId', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue(null);

      await expect(service.getStatus('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('includes accountName in status response', async () => {
      const today = new Date();
      const inThirtyDays = new Date(today);
      inThirtyDays.setDate(inThirtyDays.getDate() + 30);

      mockPrismaService.contract.findUnique.mockResolvedValue({
        id: 'contract-9',
        contractNumber: 'CNT-009',
        status: 'active',
        autoRenew: true,
        endDate: inThirtyDays,
        accountId: 'account-9',
        account: { id: 'account-9', accountName: 'Iota Corp' },
      });

      const result = await service.getStatus('contract-9');
      const data = result.data as any;

      expect(data.accountName).toBe('Iota Corp');
      expect(data.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // ---------------------------------------------------------------------------
  // renew
  // ---------------------------------------------------------------------------

  describe('renew', () => {
    it('extends endDate by 1 year for an active contract', async () => {
      const originalEnd = new Date('2026-05-31');
      const expectedNewEnd = new Date('2027-05-31');

      const existingContract = {
        id: 'contract-10',
        contractNumber: 'CNT-010',
        status: 'active',
        autoRenew: true,
        endDate: originalEnd,
        accountId: 'account-10',
      };

      const updatedContract = {
        ...existingContract,
        endDate: expectedNewEnd,
        account: { id: 'account-10', accountName: 'Kappa Inc' },
      };

      mockPrismaService.contract.findUnique.mockResolvedValue(existingContract);
      mockPrismaService.contract.update.mockResolvedValue(updatedContract);

      const result = await service.renew('contract-10');
      const data = result.data as any;

      expect(data.endDate).toEqual(expectedNewEnd);
      expect(mockPrismaService.contract.update).toHaveBeenCalledWith({
        where: { id: 'contract-10' },
        data: { endDate: expectedNewEnd },
        include: { account: { select: { id: true, accountName: true } } },
      });
    });

    it('throws BadRequestException for non-active contract', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue({
        id: 'contract-11',
        contractNumber: 'CNT-011',
        status: 'expired',
        endDate: new Date('2025-01-01'),
        accountId: 'account-11',
      });

      await expect(service.renew('contract-11')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for cancelled contract', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue({
        id: 'contract-12',
        contractNumber: 'CNT-012',
        status: 'cancelled',
        endDate: new Date('2025-06-01'),
        accountId: 'account-12',
      });

      await expect(service.renew('contract-12')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException for unknown contractId', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue(null);

      await expect(service.renew('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('preserves all existing contract fields when renewing', async () => {
      const originalEnd = new Date('2026-12-31');

      const existingContract = {
        id: 'contract-13',
        contractNumber: 'CNT-013',
        status: 'active',
        autoRenew: false,
        totalValue: 50000,
        endDate: originalEnd,
        accountId: 'account-13',
      };

      const updatedContract = {
        ...existingContract,
        endDate: new Date('2027-12-31'),
        account: { id: 'account-13', accountName: 'Lambda Ltd' },
      };

      mockPrismaService.contract.findUnique.mockResolvedValue(existingContract);
      mockPrismaService.contract.update.mockResolvedValue(updatedContract);

      const result = await service.renew('contract-13');
      const data = result.data as any;

      // Only endDate should change
      expect(data.contractNumber).toBe('CNT-013');
      expect(data.autoRenew).toBe(false);
      expect(data.totalValue).toBe(50000);
    });
  });
});
