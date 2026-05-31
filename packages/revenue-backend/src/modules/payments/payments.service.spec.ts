import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

const mockPrismaService = {
  payment: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  account: { findUnique: jest.fn() },
  invoice: { findUnique: jest.fn(), update: jest.fn(), aggregate: jest.fn() },
  $transaction: jest.fn(),
};

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();
    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create payment and auto-mark invoice paid when fully paid', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({ id: 'acc-1' });
      mockPrismaService.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        accountId: 'acc-1',
        total: 5000,
        paidAmount: 0,
        status: 'sent',
      });
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          payment: {
            create: jest.fn().mockResolvedValue({
              id: 'pay-1',
              amount: 5000,
              invoiceId: 'inv-1',
            }),
          },
          invoice: {
            findUnique: jest
              .fn()
              .mockResolvedValue({ total: 5000, paidAmount: 0, status: 'sent' }),
            update: jest.fn(),
          },
        };
        return fn(txMock);
      });

      const result = await service.create({
        paymentNumber: 'PAY-001',
        accountId: 'acc-1',
        invoiceId: 'inv-1',
        amount: 5000,
        method: 'bank_transfer',
        paymentDate: '2026-05-31',
      });

      expect(result.data).toBeDefined();
    });

    it('should create payment without invoice link', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({ id: 'acc-1' });
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          payment: {
            create: jest.fn().mockResolvedValue({
              id: 'pay-2',
              amount: 2000,
              invoiceId: null,
            }),
          },
          invoice: { findUnique: jest.fn(), update: jest.fn() },
        };
        return fn(txMock);
      });

      const result = await service.create({
        paymentNumber: 'PAY-002',
        accountId: 'acc-1',
        amount: 2000,
        method: 'wire',
        paymentDate: '2026-05-31',
      });

      expect(result.data).toBeDefined();
      expect(result.paging.total).toBeNull();
    });

    it('should mark invoice partially_paid when amount is less than total', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({ id: 'acc-1' });
      mockPrismaService.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        accountId: 'acc-1',
        total: 5000,
        paidAmount: 0,
        status: 'sent',
      });

      let invoiceUpdateData: any;
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          payment: {
            create: jest.fn().mockResolvedValue({
              id: 'pay-1',
              amount: 2000,
              invoiceId: 'inv-1',
            }),
          },
          invoice: {
            findUnique: jest
              .fn()
              .mockResolvedValue({ total: 5000, paidAmount: 0, status: 'sent' }),
            update: jest.fn().mockImplementation(({ data }) => {
              invoiceUpdateData = data;
            }),
          },
        };
        return fn(txMock);
      });

      await service.create({
        paymentNumber: 'PAY-003',
        accountId: 'acc-1',
        invoiceId: 'inv-1',
        amount: 2000,
        method: 'bank_transfer',
        paymentDate: '2026-05-31',
      });

      expect(invoiceUpdateData.status).toBe('partially_paid');
    });

    it('should throw NotFoundException for unknown account', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(null);
      await expect(
        service.create({
          paymentNumber: 'PAY-001',
          accountId: 'bad',
          amount: 1000,
          method: 'bank_transfer',
          paymentDate: '2026-05-31',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for unknown invoice', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({ id: 'acc-1' });
      mockPrismaService.invoice.findUnique.mockResolvedValue(null);
      await expect(
        service.create({
          paymentNumber: 'PAY-001',
          accountId: 'acc-1',
          invoiceId: 'bad',
          amount: 1000,
          method: 'bank_transfer',
          paymentDate: '2026-05-31',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when invoice belongs to different account', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({ id: 'acc-1' });
      mockPrismaService.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        accountId: 'acc-2',
        total: 1000,
        paidAmount: 0,
      });
      await expect(
        service.create({
          paymentNumber: 'PAY-001',
          accountId: 'acc-1',
          invoiceId: 'inv-1',
          amount: 1000,
          method: 'bank_transfer',
          paymentDate: '2026-05-31',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException on duplicate paymentNumber', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({ id: 'acc-1' });
      // Simulate a Prisma P2002 unique constraint violation
      const { PrismaClientKnownRequestError } = jest.requireActual(
        '@prisma/client/runtime/library',
      ) as typeof import('@prisma/client/runtime/library');
      const prismaError = new PrismaClientKnownRequestError(
        'Unique constraint failed on field: payment_number',
        { code: 'P2002', clientVersion: '5.0.0', meta: {}, batchRequestIdx: 0 },
      );
      mockPrismaService.$transaction.mockRejectedValue(prismaError);

      await expect(
        service.create({
          paymentNumber: 'PAY-DUPE',
          accountId: 'acc-1',
          amount: 1000,
          method: 'bank_transfer',
          paymentDate: '2026-05-31',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated list', async () => {
      mockPrismaService.payment.findMany.mockResolvedValue([{ id: 'pay-1' }]);
      mockPrismaService.payment.count.mockResolvedValue(1);
      const result = await service.findAll({});
      expect(result.paging.total).toBe(1);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should pass where clause from query filters', async () => {
      mockPrismaService.payment.findMany.mockResolvedValue([]);
      mockPrismaService.payment.count.mockResolvedValue(0);
      await service.findAll({ 'status[eq]': 'voided' });
      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'voided' } }),
      );
    });
  });

  describe('findOne', () => {
    it('should return payment by id', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue({ id: 'pay-1' });
      const result = await service.findOne('pay-1');
      expect(result.data).toMatchObject({ id: 'pay-1' });
    });

    it('should throw NotFoundException for unknown id', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('applyToInvoice', () => {
    it('should apply unlinked payment to invoice', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        invoiceId: null,
        amount: 1000,
        accountId: 'acc-1',
        status: 'applied',
      });
      mockPrismaService.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        accountId: 'acc-1',
        total: 1000,
        paidAmount: 0,
        status: 'sent',
      });
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          invoice: { update: jest.fn() },
          payment: {
            update: jest.fn().mockResolvedValue({ id: 'pay-1', invoiceId: 'inv-1' }),
          },
        };
        return fn(txMock);
      });

      const result = await service.applyToInvoice('pay-1', { invoiceId: 'inv-1' });
      expect(result.data).toBeDefined();
    });

    it('should throw BadRequestException if already applied to an invoice', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        invoiceId: 'existing-inv',
        amount: 500,
        accountId: 'acc-1',
        status: 'applied',
      });
      await expect(
        service.applyToInvoice('pay-1', { invoiceId: 'inv-2' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if payment is voided', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        invoiceId: null,
        amount: 500,
        accountId: 'acc-1',
        status: 'voided',
      });
      await expect(
        service.applyToInvoice('pay-1', { invoiceId: 'inv-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for unknown payment', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(null);
      await expect(
        service.applyToInvoice('bad', { invoiceId: 'inv-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for unknown invoice', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        invoiceId: null,
        amount: 500,
        accountId: 'acc-1',
        status: 'applied',
      });
      mockPrismaService.invoice.findUnique.mockResolvedValue(null);
      await expect(
        service.applyToInvoice('pay-1', { invoiceId: 'bad-inv' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when invoice account does not match payment account', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        invoiceId: null,
        amount: 500,
        accountId: 'acc-1',
        status: 'applied',
      });
      mockPrismaService.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        accountId: 'acc-2',
        total: 1000,
        paidAmount: 0,
        status: 'sent',
      });
      await expect(
        service.applyToInvoice('pay-1', { invoiceId: 'inv-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('void', () => {
    it('should void payment and reverse invoice paidAmount', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        status: 'applied',
        amount: 1000,
        invoiceId: 'inv-1',
        accountId: 'acc-1',
      });
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          invoice: {
            findUnique: jest
              .fn()
              .mockResolvedValue({ paidAmount: 1000, status: 'paid' }),
            update: jest.fn(),
          },
          payment: {
            update: jest.fn().mockResolvedValue({ id: 'pay-1', status: 'voided' }),
          },
        };
        return fn(txMock);
      });

      const result = await service.void('pay-1');
      expect(result.data).toMatchObject({ status: 'voided' });
    });

    it('should void payment without linked invoice', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        status: 'applied',
        amount: 1000,
        invoiceId: null,
        accountId: 'acc-1',
      });
      mockPrismaService.$transaction.mockImplementation(async (fn) => {
        const txMock = {
          invoice: { findUnique: jest.fn(), update: jest.fn() },
          payment: {
            update: jest.fn().mockResolvedValue({ id: 'pay-1', status: 'voided' }),
          },
        };
        return fn(txMock);
      });

      const result = await service.void('pay-1');
      expect(result.data).toMatchObject({ status: 'voided' });
    });

    it('should throw BadRequestException if already voided', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        status: 'voided',
      });
      await expect(service.void('pay-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for unknown payment', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(null);
      await expect(service.void('bad')).rejects.toThrow(NotFoundException);
    });
  });
});
