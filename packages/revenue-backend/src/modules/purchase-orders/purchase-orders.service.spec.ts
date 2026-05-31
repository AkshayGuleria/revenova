import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

const mockPrismaService = {
  purchaseOrder: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  account: { findUnique: jest.fn() },
  contract: { findUnique: jest.fn() },
};

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PurchaseOrdersService>(PurchaseOrdersService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create PO with pending_approval status', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({ id: 'acc-1' });
      mockPrismaService.purchaseOrder.create.mockResolvedValue({
        id: 'po-1',
        poNumber: 'PO-001',
        status: 'pending_approval',
        amount: 50000,
        account: { id: 'acc-1', accountName: 'ACME Corp' },
        contract: null,
      });

      const result = await service.create({
        poNumber: 'PO-001',
        accountId: 'acc-1',
        amount: 50000,
        issueDate: '2026-01-15',
      });

      expect(result.data).toMatchObject({ status: 'pending_approval' });
      expect(mockPrismaService.purchaseOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'pending_approval' }),
        }),
      );
      expect(result.paging).toMatchObject({
        offset: null,
        limit: null,
        total: null,
      });
    });

    it('should throw NotFoundException for unknown account', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          poNumber: 'PO-001',
          accountId: 'bad-acc',
          amount: 1000,
          issueDate: '2026-01-15',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for unknown contract', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({ id: 'acc-1' });
      mockPrismaService.contract.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          poNumber: 'PO-001',
          accountId: 'acc-1',
          contractId: 'bad-contract',
          amount: 1000,
          issueDate: '2026-01-15',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for duplicate poNumber', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({ id: 'acc-1' });
      mockPrismaService.purchaseOrder.create.mockRejectedValue(
        new PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '5.0.0',
        }),
      );

      await expect(
        service.create({
          poNumber: 'PO-DUP',
          accountId: 'acc-1',
          amount: 1000,
          issueDate: '2026-01-15',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should default currency to EUR when not provided', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({ id: 'acc-1' });
      mockPrismaService.purchaseOrder.create.mockResolvedValue({
        id: 'po-1',
        poNumber: 'PO-001',
        status: 'pending_approval',
        currency: 'EUR',
        amount: 50000,
        account: { id: 'acc-1', accountName: 'ACME' },
        contract: null,
      });

      await service.create({
        poNumber: 'PO-001',
        accountId: 'acc-1',
        amount: 50000,
        issueDate: '2026-01-15',
      });

      expect(mockPrismaService.purchaseOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currency: 'EUR' }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated list with default pagination', async () => {
      mockPrismaService.purchaseOrder.findMany.mockResolvedValue([
        { id: 'po-1' },
        { id: 'po-2' },
      ]);
      mockPrismaService.purchaseOrder.count.mockResolvedValue(2);

      const result = await service.findAll({});

      expect(result.paging.total).toBe(2);
      expect(result.paging.offset).toBe(0);
      expect(result.paging.limit).toBe(20);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should apply offset and limit from query params', async () => {
      mockPrismaService.purchaseOrder.findMany.mockResolvedValue([{ id: 'po-3' }]);
      mockPrismaService.purchaseOrder.count.mockResolvedValue(10);

      const result = await service.findAll({ 'offset[eq]': '20', 'limit[eq]': '5' });

      expect(result.paging.offset).toBe(20);
      expect(result.paging.limit).toBe(5);
      expect(mockPrismaService.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 5 }),
      );
    });

    it('should pass where filters to prisma', async () => {
      mockPrismaService.purchaseOrder.findMany.mockResolvedValue([]);
      mockPrismaService.purchaseOrder.count.mockResolvedValue(0);

      await service.findAll({ 'status[eq]': 'approved' });

      expect(mockPrismaService.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'approved' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return PO by id', async () => {
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        poNumber: 'PO-001',
        status: 'pending_approval',
      });

      const result = await service.findOne('po-1');

      expect(result.data).toMatchObject({ id: 'po-1' });
      expect(result.paging.total).toBeNull();
    });

    it('should throw NotFoundException for unknown id', async () => {
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue(null);

      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a pending PO', async () => {
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'pending_approval',
      });
      mockPrismaService.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        status: 'pending_approval',
        amount: 60000,
      });

      const result = await service.update('po-1', { amount: 60000 });

      expect(result.data).toMatchObject({ amount: 60000 });
    });

    it('should throw NotFoundException if PO not found', async () => {
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue(null);

      await expect(service.update('bad-id', { amount: 1000 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if PO is not pending', async () => {
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'approved',
      });

      await expect(service.update('po-1', { amount: 1000 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('approve', () => {
    it('should approve a pending PO', async () => {
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'pending_approval',
      });
      mockPrismaService.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        status: 'approved',
        approvedAt: new Date(),
      });

      const result = await service.approve('po-1', 'user-123');

      expect(result.data).toMatchObject({ status: 'approved' });
      expect(mockPrismaService.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'approved',
            approvedById: 'user-123',
          }),
        }),
      );
    });

    it('should throw NotFoundException if PO not found', async () => {
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue(null);

      await expect(service.approve('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if PO is not pending', async () => {
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'approved',
      });

      await expect(service.approve('po-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('reject', () => {
    it('should reject a pending PO with reason', async () => {
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'pending_approval',
      });
      mockPrismaService.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        status: 'rejected',
        rejectionReason: 'Budget not available',
      });

      const result = await service.reject(
        'po-1',
        { rejectionReason: 'Budget not available' },
        'manager-456',
      );

      expect(result.data).toMatchObject({ status: 'rejected' });
      expect(mockPrismaService.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'rejected',
            rejectionReason: 'Budget not available',
            rejectedById: 'manager-456',
          }),
        }),
      );
    });

    it('should throw NotFoundException if PO not found', async () => {
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue(null);

      await expect(
        service.reject('bad-id', { rejectionReason: 'No budget' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if PO is not pending', async () => {
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'rejected',
      });

      await expect(
        service.reject('po-1', { rejectionReason: 'reason again' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('should cancel a pending PO', async () => {
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'pending_approval',
      });
      mockPrismaService.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        status: 'cancelled',
      });

      const result = await service.cancel('po-1');

      expect(result.data).toMatchObject({ status: 'cancelled' });
    });

    it('should cancel an approved PO', async () => {
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'approved',
      });
      mockPrismaService.purchaseOrder.update.mockResolvedValue({
        id: 'po-1',
        status: 'cancelled',
      });

      const result = await service.cancel('po-1');

      expect(result.data).toMatchObject({ status: 'cancelled' });
    });

    it('should throw NotFoundException if PO not found', async () => {
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue(null);

      await expect(service.cancel('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if PO is already cancelled', async () => {
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'cancelled',
      });

      await expect(service.cancel('po-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if PO is fulfilled', async () => {
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'fulfilled',
      });

      await expect(service.cancel('po-1')).rejects.toThrow(BadRequestException);
    });
  });
});
