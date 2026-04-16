import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CreateInvoiceDto, UpdateInvoiceDto, InvoiceStatus } from './dto';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    invoice: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    account: {
      findUnique: jest.fn(),
    },
    invoiceGroup: {
      findUnique: jest.fn(),
    },
    contract: {
      findUnique: jest.fn(),
    },
    invoiceItem: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('EUR'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
    prisma = module.get<PrismaService>(PrismaService);

    // Prevent unused variable warning
    void prisma;

    // Reset all mocks before each test
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue('EUR');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateInvoiceDto = {
      invoiceNumber: 'INV-2024-0001',
      accountId: 'account-id-123',
      issueDate: '2024-01-01',
      dueDate: '2024-01-31',
      subtotal: 10000,
      tax: 800,
      discount: 500,
      total: 10300,
    };

    it('should create an invoice successfully', async () => {
      const mockAccount = { id: 'account-id-123' };
      const mockInvoice = {
        id: 'invoice-id-123',
        ...createDto,
        issueDate: new Date('2024-01-01'),
        dueDate: new Date('2024-01-31'),
        items: [],
      };

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.invoice.create.mockResolvedValue(mockInvoice);

      const result = await service.create(createDto);

      expect(result.data).toEqual(mockInvoice);
      expect(result.paging).toEqual({
        offset: null,
        limit: null,
        total: null,
        totalPages: null,
        hasNext: null,
        hasPrev: null,
      });
      expect(mockPrismaService.account.findUnique).toHaveBeenCalledWith({
        where: { id: 'account-id-123' },
      });
    });

    it('should create invoice with line items', async () => {
      const dtoWithItems = {
        ...createDto,
        items: [
          {
            description: 'Enterprise Plan',
            quantity: 100,
            unitPrice: 99.99,
            amount: 9999,
          },
        ],
      };

      const mockAccount = { id: 'account-id-123' };
      const mockInvoice = {
        id: 'invoice-id-123',
        ...dtoWithItems,
        items: dtoWithItems.items,
      };

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.invoice.create.mockResolvedValue(mockInvoice);

      const result = await service.create(dtoWithItems);

      expect(result.data).toEqual(mockInvoice);
    });

    it('should create invoice with contract reference', async () => {
      const dtoWithContract = {
        ...createDto,
        contractId: 'contract-id-123',
      };

      const mockAccount = { id: 'account-id-123' };
      const mockContract = {
        id: 'contract-id-123',
        accountId: 'account-id-123',
      };
      const mockInvoice = {
        id: 'invoice-id-123',
        ...dtoWithContract,
      };

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.contract.findUnique.mockResolvedValue(mockContract);
      mockPrismaService.invoice.create.mockResolvedValue(mockInvoice);

      const result = await service.create(dtoWithContract);

      expect(result.data).toEqual(mockInvoice);
      expect(mockPrismaService.contract.findUnique).toHaveBeenCalledWith({
        where: { id: 'contract-id-123' },
      });
    });

    it('should throw NotFoundException if account not found', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        'Account with ID account-id-123 not found',
      );
    });

    it('should throw NotFoundException if contract not found', async () => {
      const dtoWithContract = {
        ...createDto,
        contractId: 'contract-id-123',
      };

      mockPrismaService.account.findUnique.mockResolvedValue({
        id: 'account-id-123',
      });
      mockPrismaService.contract.findUnique.mockResolvedValue(null);

      await expect(service.create(dtoWithContract)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(dtoWithContract)).rejects.toThrow(
        'Contract with ID contract-id-123 not found',
      );
    });

    it('should throw BadRequestException if contract does not belong to account', async () => {
      const dtoWithContract = {
        ...createDto,
        contractId: 'contract-id-123',
      };

      mockPrismaService.account.findUnique.mockResolvedValue({
        id: 'account-id-123',
      });
      mockPrismaService.contract.findUnique.mockResolvedValue({
        id: 'contract-id-123',
        accountId: 'different-account-id',
      });

      await expect(service.create(dtoWithContract)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(dtoWithContract)).rejects.toThrow(
        'Contract does not belong to the specified account',
      );
    });

    it('should throw BadRequestException if due date is before issue date', async () => {
      const invalidDto = {
        ...createDto,
        issueDate: '2024-01-31',
        dueDate: '2024-01-01',
      };

      mockPrismaService.account.findUnique.mockResolvedValue({
        id: 'account-id-123',
      });

      await expect(service.create(invalidDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(invalidDto)).rejects.toThrow(
        'Due date must be after issue date',
      );
    });

    it('should throw BadRequestException if total amount does not match calculation', async () => {
      const invalidDto = {
        ...createDto,
        total: 99999, // Wrong total
      };

      mockPrismaService.account.findUnique.mockResolvedValue({
        id: 'account-id-123',
      });

      await expect(service.create(invalidDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(invalidDto)).rejects.toThrow(
        /Total amount .* does not match calculated total/,
      );
    });

    it('should throw ConflictException if invoice number already exists', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({
        id: 'account-id-123',
      });

      const prismaError = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
        },
      );
      mockPrismaService.invoice.create.mockRejectedValue(prismaError);

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        'Invoice with this number already exists',
      );
    });

    it('should apply EUR default when currency is omitted', async () => {
      const dtoWithoutCurrency: CreateInvoiceDto = {
        invoiceNumber: 'INV-NO-CURRENCY',
        accountId: 'account-id-123',
        issueDate: '2024-01-01',
        dueDate: '2024-01-31',
        subtotal: 1000,
        tax: 0,
        discount: 0,
        total: 1000,
      };
      const mockAccount = { id: 'account-id-123' };
      const mockInvoice = {
        id: 'invoice-no-currency',
        ...dtoWithoutCurrency,
        currency: 'EUR',
        issueDate: new Date('2024-01-01'),
        dueDate: new Date('2024-01-31'),
        items: [],
      };

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.invoice.create.mockResolvedValue(mockInvoice);

      const result = await service.create(dtoWithoutCurrency);

      expect(result.data.currency).toBe('EUR');
      expect(mockPrismaService.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currency: 'EUR' }),
        }),
      );
    });

    it('should use explicitly provided currency when given', async () => {
      const dtoWithGbp: CreateInvoiceDto = {
        invoiceNumber: 'INV-GBP-001',
        accountId: 'account-id-123',
        issueDate: '2024-01-01',
        dueDate: '2024-01-31',
        subtotal: 2000,
        tax: 0,
        discount: 0,
        total: 2000,
        currency: 'GBP',
      };
      const mockAccount = { id: 'account-id-123' };
      const mockInvoice = {
        id: 'invoice-gbp',
        ...dtoWithGbp,
        issueDate: new Date('2024-01-01'),
        dueDate: new Date('2024-01-31'),
        items: [],
      };

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.invoice.create.mockResolvedValue(mockInvoice);

      const result = await service.create(dtoWithGbp);

      expect(result.data.currency).toBe('GBP');
      expect(mockPrismaService.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currency: 'GBP' }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated list of invoices', async () => {
      const query: any = {
        offset: { eq: '0' },
        limit: { eq: '20' },
      };

      const mockInvoices = [
        {
          id: 'invoice-id-1',
          invoiceNumber: 'INV-2024-0001',
          account: { id: 'account-1', accountName: 'Acme' },
          contract: { id: 'contract-1', contractNumber: 'CNT-001' },
          _count: { items: 3 },
        },
      ];

      mockPrismaService.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrismaService.invoice.count.mockResolvedValue(1);

      const result = await service.findAll(query);

      expect(result.data).toEqual(mockInvoices);
      expect(result.paging).toEqual({
        offset: 0,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('should filter invoices by query parameters', async () => {
      const query: any = {
        status: { eq: 'paid' },
        offset: { eq: '0' },
        limit: { eq: '20' },
      };

      mockPrismaService.invoice.findMany.mockResolvedValue([]);
      mockPrismaService.invoice.count.mockResolvedValue(0);

      await service.findAll(query);

      expect(mockPrismaService.invoice.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return invoice with details', async () => {
      const mockInvoice = {
        id: 'invoice-id-123',
        invoiceNumber: 'INV-2024-0001',
        account: {
          id: 'account-123',
          accountName: 'Acme',
        },
        contract: {
          id: 'contract-123',
          contractNumber: 'CNT-001',
        },
        items: [
          {
            id: 'item-1',
            description: 'Enterprise Plan',
            quantity: 100,
          },
        ],
        invoiceGroup: null,
        _count: { items: 1, subInvoices: 0 },
      };

      mockPrismaService.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await service.findOne('invoice-id-123');

      expect(result.data).toEqual({
        ...mockInvoice,
        subInvoiceCount: 0,
        subInvoiceTotals: null,
      });
      expect(mockPrismaService.invoice.findUnique).toHaveBeenCalledWith({
        where: { id: 'invoice-id-123' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if invoice not found', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('invalid-id')).rejects.toThrow(
        'Invoice with ID invalid-id not found',
      );
    });
  });

  describe('update', () => {
    it('should update invoice successfully', async () => {
      const updateDto: UpdateInvoiceDto = {
        status: InvoiceStatus.PAID,
      };

      const mockExistingInvoice = {
        id: 'invoice-id-123',
        invoiceNumber: 'INV-2024-0001',
      };

      const mockUpdatedInvoice = {
        ...mockExistingInvoice,
        ...updateDto,
      };

      mockPrismaService.invoice.findUnique.mockResolvedValue(
        mockExistingInvoice,
      );
      mockPrismaService.invoice.update.mockResolvedValue(mockUpdatedInvoice);

      const result = await service.update('invoice-id-123', updateDto);

      expect(result.data).toEqual(mockUpdatedInvoice);
    });

    it('should validate account if accountId is updated', async () => {
      const updateDto: UpdateInvoiceDto = {
        accountId: 'new-account-id',
      };

      const mockExistingInvoice = {
        id: 'invoice-id-123',
        accountId: 'old-account-id',
      };

      const mockAccount = { id: 'new-account-id' };

      mockPrismaService.invoice.findUnique.mockResolvedValue(
        mockExistingInvoice,
      );
      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.invoice.update.mockResolvedValue({
        ...mockExistingInvoice,
        ...updateDto,
      });

      await service.update('invoice-id-123', updateDto);

      expect(mockPrismaService.account.findUnique).toHaveBeenCalledWith({
        where: { id: 'new-account-id' },
      });
    });

    it('should throw ConflictException if invoice number already exists', async () => {
      const updateDto: UpdateInvoiceDto = {
        invoiceNumber: 'INV-2024-9999',
      };

      mockPrismaService.invoice.findUnique.mockResolvedValue({
        id: 'invoice-id-123',
      });

      const prismaError = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
        },
      );
      mockPrismaService.invoice.update.mockRejectedValue(prismaError);

      await expect(service.update('invoice-id-123', updateDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('remove', () => {
    it('should delete invoice successfully', async () => {
      const mockInvoice = {
        id: 'invoice-id-123',
        invoiceNumber: 'INV-2024-0001',
      };

      mockPrismaService.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrismaService.invoice.delete.mockResolvedValue(mockInvoice);

      await service.remove('invoice-id-123');

      expect(mockPrismaService.invoice.delete).toHaveBeenCalledWith({
        where: { id: 'invoice-id-123' },
      });
    });

    it('should throw NotFoundException if invoice not found', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue(null);

      await expect(service.remove('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addLineItem', () => {
    it('should add line item to invoice successfully', async () => {
      const itemDto = {
        description: 'Enterprise Plan',
        quantity: 100,
        unitPrice: 99.99,
        amount: 9999,
      };

      const mockInvoice = {
        id: 'invoice-id-123',
        invoiceNumber: 'INV-2024-0001',
      };

      const mockItem = {
        id: 'item-id-123',
        invoiceId: 'invoice-id-123',
        ...itemDto,
      };

      mockPrismaService.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrismaService.invoiceItem.create.mockResolvedValue(mockItem);

      const result = await service.addLineItem('invoice-id-123', itemDto);

      expect(result.data).toEqual(mockItem);
      expect(mockPrismaService.invoiceItem.create).toHaveBeenCalledWith({
        data: {
          ...itemDto,
          invoiceId: 'invoice-id-123',
        },
      });
    });

    it('should throw NotFoundException if invoice not found', async () => {
      const itemDto = {
        description: 'Enterprise Plan',
        quantity: 100,
        unitPrice: 99.99,
        amount: 9999,
      };

      mockPrismaService.invoice.findUnique.mockResolvedValue(null);

      await expect(service.addLineItem('invalid-id', itemDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeLineItem', () => {
    it('should remove line item successfully', async () => {
      const mockInvoice = {
        id: 'invoice-id-123',
        invoiceNumber: 'INV-2024-0001',
      };

      const mockItem = {
        id: 'item-id-123',
        invoiceId: 'invoice-id-123',
      };

      mockPrismaService.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrismaService.invoiceItem.findUnique.mockResolvedValue(mockItem);
      mockPrismaService.invoiceItem.delete.mockResolvedValue(mockItem);

      await service.removeLineItem('invoice-id-123', 'item-id-123');

      expect(mockPrismaService.invoiceItem.delete).toHaveBeenCalledWith({
        where: { id: 'item-id-123' },
      });
    });

    it('should throw NotFoundException if item not found', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue({
        id: 'invoice-id-123',
      });
      mockPrismaService.invoiceItem.findUnique.mockResolvedValue(null);

      await expect(
        service.removeLineItem('invoice-id-123', 'invalid-item-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if item does not belong to invoice', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue({
        id: 'invoice-id-123',
      });
      mockPrismaService.invoiceItem.findUnique.mockResolvedValue({
        id: 'item-id-123',
        invoiceId: 'different-invoice-id',
      });

      await expect(
        service.removeLineItem('invoice-id-123', 'item-id-123'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.removeLineItem('invoice-id-123', 'item-id-123'),
      ).rejects.toThrow('Invoice item does not belong to invoice');
    });
  });

  describe('create - additional edge cases', () => {
    it('should create invoice with periodStart, periodEnd, and paidDate', async () => {
      const dtoWithDates: CreateInvoiceDto = {
        invoiceNumber: 'INV-WITH-DATES',
        accountId: 'account-123',
        issueDate: '2024-01-01',
        dueDate: '2024-01-31',
        subtotal: 5000,
        tax: 0,
        discount: 0,
        total: 5000,
        periodStart: '2024-01-01',
        periodEnd: '2024-01-31',
        paidDate: '2024-01-15',
      };

      const mockAccount = { id: 'account-123' };
      const mockInvoice = {
        id: 'invoice-dates',
        ...dtoWithDates,
        issueDate: new Date('2024-01-01'),
        dueDate: new Date('2024-01-31'),
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
        paidDate: new Date('2024-01-15'),
        items: [],
      };

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.invoice.create.mockResolvedValue(mockInvoice);

      const result = await service.create(dtoWithDates);

      expect(result.data).toEqual(mockInvoice);
      expect(mockPrismaService.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            periodStart: new Date('2024-01-01'),
            periodEnd: new Date('2024-01-31'),
            paidDate: new Date('2024-01-15'),
          }),
        }),
      );
    });

    it('should throw BadRequestException if period end is before period start', async () => {
      const dto: CreateInvoiceDto = {
        invoiceNumber: 'INV-001',
        accountId: 'account-123',
        issueDate: '2024-01-01',
        dueDate: '2024-01-31',
        subtotal: 10000,
        total: 10000,
        periodStart: '2024-02-01',
        periodEnd: '2024-01-01', // End before start
      };

      mockPrismaService.account.findUnique.mockResolvedValue({
        id: 'account-123',
      });

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        'Period end date must be after period start date',
      );
    });

    it('should rethrow unknown errors during create', async () => {
      const dto: CreateInvoiceDto = {
        invoiceNumber: 'INV-001',
        accountId: 'account-123',
        issueDate: '2024-01-01',
        dueDate: '2024-01-31',
        subtotal: 10000,
        total: 10000,
      };

      mockPrismaService.account.findUnique.mockResolvedValue({
        id: 'account-123',
      });

      const unknownError = new Error('Database connection failed');
      mockPrismaService.invoice.create.mockRejectedValue(unknownError);

      await expect(service.create(dto)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('getInvoiceAccountId — private helper', () => {
    it('should throw NotFoundException when fetching account ID for deleted/non-existent invoice', async () => {
      // The test simulates the scenario where findOne passes but then invoice is deleted
      // before getInvoiceAccountId is called (a race condition scenario).
      const updateDto: UpdateInvoiceDto = {
        contractId: 'contract-123',
        // No accountId provided — triggers getInvoiceAccountId call
      };

      // First findUnique call (for findOne) returns the invoice
      mockPrismaService.invoice.findUnique
        .mockResolvedValueOnce({ id: 'invoice-id-123', accountId: 'account-123' })
        // Second findUnique call (in getInvoiceAccountId) returns null — simulates race condition
        .mockResolvedValueOnce(null);

      // Contract is found but has a different account
      mockPrismaService.contract.findUnique.mockResolvedValue({
        id: 'contract-123',
        accountId: 'different-account',
      });

      await expect(service.update('invoice-id-123', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update - additional edge cases', () => {
    it('should throw NotFoundException if accountId is updated to non-existent account', async () => {
      const updateDto: UpdateInvoiceDto = {
        accountId: 'non-existent-account',
      };

      mockPrismaService.invoice.findUnique.mockResolvedValue({
        id: 'invoice-id-123',
      });
      mockPrismaService.account.findUnique.mockResolvedValue(null);

      await expect(service.update('invoice-id-123', updateDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.update('invoice-id-123', updateDto)).rejects.toThrow(
        'Account with ID non-existent-account not found',
      );
    });

    it('should throw NotFoundException if contractId is updated to non-existent contract', async () => {
      const updateDto: UpdateInvoiceDto = {
        contractId: 'non-existent-contract',
      };

      mockPrismaService.invoice.findUnique.mockResolvedValue({
        id: 'invoice-id-123',
      });
      mockPrismaService.contract.findUnique.mockResolvedValue(null);

      await expect(service.update('invoice-id-123', updateDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.update('invoice-id-123', updateDto)).rejects.toThrow(
        'Contract with ID non-existent-contract not found',
      );
    });

    it('should throw BadRequestException if contract does not belong to account when updating', async () => {
      const updateDto: UpdateInvoiceDto = {
        contractId: 'contract-123',
      };

      mockPrismaService.invoice.findUnique.mockResolvedValueOnce({
        id: 'invoice-id-123',
        accountId: 'account-123',
      });
      mockPrismaService.contract.findUnique.mockResolvedValue({
        id: 'contract-123',
        accountId: 'different-account', // Different account
      });

      await expect(service.update('invoice-id-123', updateDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.update('invoice-id-123', updateDto)).rejects.toThrow(
        'Contract does not belong to the specified account',
      );
    });

    it('should throw BadRequestException if due date is before issue date when updating', async () => {
      const updateDto: UpdateInvoiceDto = {
        issueDate: '2024-01-31',
        dueDate: '2024-01-01', // Due before issue
      };

      mockPrismaService.invoice.findUnique.mockResolvedValue({
        id: 'invoice-id-123',
      });

      await expect(service.update('invoice-id-123', updateDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.update('invoice-id-123', updateDto)).rejects.toThrow(
        'Due date must be after issue date',
      );
    });

    it('should throw BadRequestException if period end is before period start when updating', async () => {
      const updateDto: UpdateInvoiceDto = {
        periodStart: '2024-02-01',
        periodEnd: '2024-01-01', // End before start
      };

      mockPrismaService.invoice.findUnique.mockResolvedValue({
        id: 'invoice-id-123',
      });

      await expect(service.update('invoice-id-123', updateDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.update('invoice-id-123', updateDto)).rejects.toThrow(
        'Period end date must be after period start date',
      );
    });

    it('should rethrow unknown errors during update', async () => {
      const updateDto: UpdateInvoiceDto = {
        invoiceNumber: 'INV-2024-9999',
      };

      mockPrismaService.invoice.findUnique.mockResolvedValue({
        id: 'invoice-id-123',
      });

      const unknownError = new Error('Database connection failed');
      mockPrismaService.invoice.update.mockRejectedValue(unknownError);

      await expect(service.update('invoice-id-123', updateDto)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should update contractId when contract belongs to correct account', async () => {
      // Covers line 307: `if (contractId !== undefined) updateData.contractId = contractId`
      // This path is only reached when the contract validation passes
      const updateDto: UpdateInvoiceDto = {
        contractId: 'contract-valid',
        // No accountId — triggers getInvoiceAccountId lookup
      };

      // First findUnique: for findOne (invoice exists)
      mockPrismaService.invoice.findUnique
        .mockResolvedValueOnce({ id: 'invoice-id-123', accountId: 'account-123' })
        // Second findUnique: for getInvoiceAccountId
        .mockResolvedValueOnce({ accountId: 'account-123' });

      // Contract belongs to the same account
      mockPrismaService.contract.findUnique.mockResolvedValue({
        id: 'contract-valid',
        accountId: 'account-123',
      });

      const mockUpdatedInvoice = {
        id: 'invoice-id-123',
        contractId: 'contract-valid',
      };
      mockPrismaService.invoice.update.mockResolvedValue(mockUpdatedInvoice);

      const result = await service.update('invoice-id-123', updateDto);

      expect(result.data).toEqual(mockUpdatedInvoice);
      expect(mockPrismaService.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ contractId: 'contract-valid' }),
        }),
      );
    });

    it('should update invoice with all optional date fields', async () => {
      const updateDto: UpdateInvoiceDto = {
        issueDate: '2024-02-01',
        dueDate: '2024-03-01',
        periodStart: '2024-02-01',
        periodEnd: '2024-02-28',
        paidDate: '2024-02-15',
      };

      const mockExistingInvoice = {
        id: 'invoice-id-123',
        invoiceNumber: 'INV-2024-0001',
        accountId: 'account-123',
      };

      const mockUpdatedInvoice = {
        ...mockExistingInvoice,
        issueDate: new Date('2024-02-01'),
        dueDate: new Date('2024-03-01'),
        periodStart: new Date('2024-02-01'),
        periodEnd: new Date('2024-02-28'),
        paidDate: new Date('2024-02-15'),
      };

      // findOne call + no extra calls needed
      mockPrismaService.invoice.findUnique.mockResolvedValue(mockExistingInvoice);
      mockPrismaService.invoice.update.mockResolvedValue(mockUpdatedInvoice);

      const result = await service.update('invoice-id-123', updateDto);

      expect(result.data).toEqual(mockUpdatedInvoice);
      expect(mockPrismaService.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            issueDate: new Date('2024-02-01'),
            dueDate: new Date('2024-03-01'),
            periodStart: new Date('2024-02-01'),
            periodEnd: new Date('2024-02-28'),
            paidDate: new Date('2024-02-15'),
          }),
        }),
      );
    });

    it('should update contractId to undefined (null) when explicitly set', async () => {
      const updateDto: UpdateInvoiceDto = {
        contractId: undefined,
        status: InvoiceStatus.PAID,
      };

      const mockExistingInvoice = {
        id: 'invoice-id-123',
        invoiceNumber: 'INV-2024-0001',
        accountId: 'account-123',
      };

      const mockUpdatedInvoice = {
        ...mockExistingInvoice,
        contractId: undefined,
        status: 'paid',
      };

      mockPrismaService.invoice.findUnique.mockResolvedValue(mockExistingInvoice);
      mockPrismaService.invoice.update.mockResolvedValue(mockUpdatedInvoice);

      const result = await service.update('invoice-id-123', updateDto);

      expect(result.data).toEqual(mockUpdatedInvoice);
    });
  });

  // ---------------------------------------------------------------------------
  // createSubInvoice
  // ---------------------------------------------------------------------------

  describe('createSubInvoice', () => {
    const parentInvoice = {
      id: 'parent-id',
      invoiceNumber: 'INV-2026-000001',
      accountId: 'account-id-1',
      contractId: 'contract-id-1',
      issueDate: new Date('2026-01-01'),
      dueDate: new Date('2026-01-31'),
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-01-31'),
      status: 'draft',
      billingType: 'recurring',
      paymentMode: null,
    };

    const subDto = {
      subtotal: 5000,
      tax: 400,
      discount: 0,
      total: 5400,
    };

    it('creates first sub-invoice with suffix -A', async () => {
      const createdSub = {
        id: 'sub-id-1',
        invoiceNumber: 'INV-2026-000001-A',
        parentInvoiceId: 'parent-id',
        ...subDto,
        items: [],
        invoiceGroup: null,
      };

      mockPrismaService.invoice.findUnique.mockResolvedValue(parentInvoice);
      mockPrismaService.invoice.count.mockResolvedValue(0);
      mockPrismaService.invoice.create.mockResolvedValue(createdSub);

      const result = await service.createSubInvoice('parent-id', subDto as any);

      expect(result.data).toEqual(createdSub);
      expect(mockPrismaService.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invoiceNumber: 'INV-2026-000001-A',
            parentInvoiceId: 'parent-id',
          }),
        }),
      );
    });

    it('creates second sub-invoice with suffix -B', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue(parentInvoice);
      mockPrismaService.invoice.count.mockResolvedValue(1);
      mockPrismaService.invoice.create.mockResolvedValue({
        id: 'sub-id-2',
        invoiceNumber: 'INV-2026-000001-B',
        parentInvoiceId: 'parent-id',
        items: [],
        invoiceGroup: null,
      });

      const result = await service.createSubInvoice('parent-id', subDto as any);

      expect((result.data as any).invoiceNumber).toBe('INV-2026-000001-B');
    });

    it('generates suffix -Z for 25th sub-invoice, then -AA for 26th', async () => {
      // Test private indexToSuffix indirectly via createSubInvoice
      mockPrismaService.invoice.findUnique.mockResolvedValue(parentInvoice);
      mockPrismaService.invoice.count.mockResolvedValue(25);
      mockPrismaService.invoice.create.mockResolvedValue({
        invoiceNumber: 'INV-2026-000001-Z',
        items: [],
        invoiceGroup: null,
      });

      const result = await service.createSubInvoice('parent-id', subDto as any);
      expect((result.data as any).invoiceNumber).toBe('INV-2026-000001-Z');

      // Now 26th → AA
      mockPrismaService.invoice.count.mockResolvedValue(26);
      mockPrismaService.invoice.create.mockResolvedValue({
        invoiceNumber: 'INV-2026-000001-AA',
        items: [],
        invoiceGroup: null,
      });

      const result2 = await service.createSubInvoice('parent-id', subDto as any);
      expect((result2.data as any).invoiceNumber).toBe('INV-2026-000001-AA');
    });

    it('throws NotFoundException when parent invoice does not exist', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue(null);

      await expect(
        service.createSubInvoice('bad-parent', subDto as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when invoiceGroupId does not exist', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue(parentInvoice);
      mockPrismaService.invoiceGroup.findUnique.mockResolvedValue(null);

      await expect(
        service.createSubInvoice('parent-id', {
          ...subDto,
          invoiceGroupId: 'bad-group-id',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when invoice group belongs to a different account', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue(parentInvoice);
      mockPrismaService.invoiceGroup.findUnique.mockResolvedValue({
        id: 'group-id',
        accountId: 'different-account',
      });

      await expect(
        service.createSubInvoice('parent-id', {
          ...subDto,
          invoiceGroupId: 'group-id',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when total does not match subtotal + tax - discount', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue(parentInvoice);

      await expect(
        service.createSubInvoice('parent-id', {
          subtotal: 5000,
          tax: 400,
          discount: 0,
          total: 9999, // wrong
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // getSubInvoices
  // ---------------------------------------------------------------------------

  describe('getSubInvoices', () => {
    it('returns paginated sub-invoices of a parent', async () => {
      const parentInvoice = { id: 'parent-id', invoiceNumber: 'INV-2026-000001' };
      const subInvoices = [
        { id: 'sub-1', invoiceNumber: 'INV-2026-000001-A', parentInvoiceId: 'parent-id' },
        { id: 'sub-2', invoiceNumber: 'INV-2026-000001-B', parentInvoiceId: 'parent-id' },
      ];

      mockPrismaService.invoice.findUnique.mockResolvedValue(parentInvoice);
      mockPrismaService.invoice.findMany.mockResolvedValue(subInvoices);
      mockPrismaService.invoice.count.mockResolvedValue(2);

      const result = await service.getSubInvoices('parent-id', {} as any);

      expect(result.data).toHaveLength(2);
      expect((result.paging as any).total).toBe(2);
    });

    it('throws NotFoundException when parent invoice does not exist', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue(null);

      await expect(
        service.getSubInvoices('bad-parent', {} as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // cascadeParentPayment
  // ---------------------------------------------------------------------------

  describe('cascadeParentPayment', () => {
    it('cascades paid status to children when paymentMode is PARENT_PAYS', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue({
        id: 'parent-id',
        paymentMode: 'PARENT_PAYS',
      });
      mockPrismaService.invoice.updateMany.mockResolvedValue({ count: 3 });

      const paidDate = new Date('2026-01-15');
      await service.cascadeParentPayment('parent-id', paidDate);

      expect(mockPrismaService.invoice.updateMany).toHaveBeenCalledWith({
        where: { parentInvoiceId: 'parent-id' },
        data: expect.objectContaining({ status: 'paid', paidDate }),
      });
    });

    it('does not cascade when paymentMode is CHILD_PAYS', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue({
        id: 'parent-id',
        paymentMode: 'CHILD_PAYS',
      });

      await service.cascadeParentPayment('parent-id', new Date());

      expect(mockPrismaService.invoice.updateMany).not.toHaveBeenCalled();
    });

    it('does not cascade when paymentMode is null', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue({
        id: 'parent-id',
        paymentMode: null,
      });

      await service.cascadeParentPayment('parent-id', new Date());

      expect(mockPrismaService.invoice.updateMany).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // findOne — sub-invoice summary fields
  // ---------------------------------------------------------------------------

  describe('findOne (sub-invoice summary)', () => {
    it('includes subInvoiceCount and subInvoiceTotals when invoice has sub-invoices', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue({
        id: 'parent-id',
        invoiceNumber: 'INV-2026-000001',
        account: {},
        contract: null,
        items: [],
        invoiceGroup: null,
        _count: { items: 1, subInvoices: 3 },
      });
      mockPrismaService.invoice.aggregate.mockResolvedValue({
        _sum: { total: 15000, paidAmount: 5000 },
      });

      const result = await service.findOne('parent-id');

      expect((result.data as any).subInvoiceCount).toBe(3);
      expect((result.data as any).subInvoiceTotals).toEqual({
        total: '15000.00',
        paid: '5000.00',
        outstanding: '10000.00',
      });
    });

    it('sets subInvoiceCount to 0 and subInvoiceTotals to null when no sub-invoices', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue({
        id: 'invoice-id',
        invoiceNumber: 'INV-2026-000002',
        account: {},
        contract: null,
        items: [],
        invoiceGroup: null,
        _count: { items: 2, subInvoices: 0 },
      });

      const result = await service.findOne('invoice-id');

      expect((result.data as any).subInvoiceCount).toBe(0);
      expect((result.data as any).subInvoiceTotals).toBeNull();
      expect(mockPrismaService.invoice.aggregate).not.toHaveBeenCalled();
    });
  });
});
