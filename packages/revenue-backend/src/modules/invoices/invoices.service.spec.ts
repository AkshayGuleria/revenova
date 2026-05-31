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
    $transaction: jest.fn((fn: (tx: any) => Promise<any>) =>
      fn(mockPrismaService),
    ),
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
    // Re-bind $transaction after clearAllMocks
    mockPrismaService.$transaction.mockImplementation(
      (fn: (tx: any) => Promise<any>) => fn(mockPrismaService),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // Shared fixtures for create() tests
  // ---------------------------------------------------------------------------

  const mockContractWithProducts = {
    id: 'contract-id-123',
    accountId: 'account-id-123',
    products: [
      {
        id: 'cp-1',
        contractId: 'contract-id-123',
        productId: 'product-1',
        quantity: 10,
        unitPrice: null,
        discount: null,
        product: {
          id: 'product-1',
          name: 'Enterprise Plan',
          basePrice: { toNumber: () => 99.99, valueOf: () => 99.99 },
        },
      },
    ],
  };

  describe('create', () => {
    const createDto: CreateInvoiceDto = {
      invoiceNumber: 'INV-2024-0001',
      accountId: 'account-id-123',
      contractId: 'contract-id-123',
      issueDate: '2024-01-01',
      dueDate: '2024-01-31',
    };

    it('should create an invoice successfully with auto-generated items', async () => {
      const mockAccount = { id: 'account-id-123' };
      const mockInvoice = {
        id: 'invoice-id-123',
        invoiceNumber: 'INV-2024-0001',
        subtotal: 999.9,
        tax: 0,
        discount: 0,
        total: 999.9,
        issueDate: new Date('2024-01-01'),
        dueDate: new Date('2024-01-31'),
        items: [
          {
            id: 'item-1',
            description: 'Enterprise Plan',
            quantity: 10,
            unitPrice: 99.99,
            amount: 999.9,
            contractProductId: 'cp-1',
          },
        ],
      };

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.contract.findUnique.mockResolvedValue(
        mockContractWithProducts,
      );
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
      expect(mockPrismaService.contract.findUnique).toHaveBeenCalledWith({
        where: { id: 'contract-id-123' },
        include: {
          products: {
            include: { product: true },
          },
        },
      });
    });

    it('should auto-generate items from contract products', async () => {
      const mockAccount = { id: 'account-id-123' };
      const mockInvoice = {
        id: 'invoice-id-123',
        items: [],
      };

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.contract.findUnique.mockResolvedValue(
        mockContractWithProducts,
      );
      mockPrismaService.invoice.create.mockResolvedValue(mockInvoice);

      await service.create(createDto);

      expect(mockPrismaService.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: expect.any(Number),
            total: expect.any(Number),
            items: {
              create: expect.arrayContaining([
                expect.objectContaining({
                  description: 'Enterprise Plan',
                  quantity: 10,
                  unitPrice: 99.99,
                  contractProductId: 'cp-1',
                }),
              ]),
            },
          }),
        }),
      );
    });

    it('should compute subtotal and total correctly', async () => {
      // quantity=10, unitPrice=99.99 (from basePrice), discount=0 → amount=999.9
      const mockAccount = { id: 'account-id-123' };
      const mockInvoice = { id: 'invoice-id-123', items: [] };

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.contract.findUnique.mockResolvedValue(
        mockContractWithProducts,
      );
      mockPrismaService.invoice.create.mockResolvedValue(mockInvoice);

      await service.create({ ...createDto, tax: 100, discount: 50 });

      expect(mockPrismaService.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 999.9,
            tax: 100,
            discount: 50,
            total: 1049.9, // 999.9 + 100 - 50
          }),
        }),
      );
    });

    it('should fall back to 0 when basePrice is null (no unitPrice, no basePrice)', async () => {
      const contractWithNullBasePrice = {
        ...mockContractWithProducts,
        products: [
          {
            ...mockContractWithProducts.products[0],
            unitPrice: null,
            discount: null,
            product: {
              id: 'product-1',
              name: 'Free Plan',
              basePrice: null, // triggers ?? 0 fallback
            },
          },
        ],
      };
      const mockAccount = { id: 'account-id-123' };
      const mockInvoice = { id: 'invoice-free', items: [] };

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.contract.findUnique.mockResolvedValue(
        contractWithNullBasePrice,
      );
      mockPrismaService.invoice.create.mockResolvedValue(mockInvoice);

      await service.create(createDto);

      // unitPrice = 0 (null basePrice falls back to 0), quantity=10 → subtotal=0
      expect(mockPrismaService.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 0,
            total: 0,
          }),
        }),
      );
    });

    it('should apply product-level discount when contractProduct has a non-null discount', async () => {
      const contractWithDiscount = {
        ...mockContractWithProducts,
        products: [
          {
            ...mockContractWithProducts.products[0],
            unitPrice: null,
            discount: { toNumber: () => 0.1 }, // 10% discount
          },
        ],
      };
      const mockAccount = { id: 'account-id-123' };
      const mockInvoice = { id: 'invoice-discounted', items: [] };

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.contract.findUnique.mockResolvedValue(
        contractWithDiscount,
      );
      mockPrismaService.invoice.create.mockResolvedValue(mockInvoice);

      await service.create(createDto);

      // unitPrice=99.99, quantity=10, discount=0.1 → amount = 99.99 * 10 * 0.9 = 899.91
      expect(mockPrismaService.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: expect.closeTo(899.91, 1),
          }),
        }),
      );
    });

    it('should use contractProduct.unitPrice override when set', async () => {
      const contractWithPriceOverride = {
        ...mockContractWithProducts,
        products: [
          {
            ...mockContractWithProducts.products[0],
            unitPrice: { toNumber: () => 150, valueOf: () => 150 },
            // Treat unitPrice as Decimal — service uses Number(cp.unitPrice)
          },
        ],
      };

      const mockAccount = { id: 'account-id-123' };
      const mockInvoice = { id: 'invoice-id-123', items: [] };

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.contract.findUnique.mockResolvedValue(
        contractWithPriceOverride,
      );
      mockPrismaService.invoice.create.mockResolvedValue(mockInvoice);

      await service.create(createDto);

      expect(mockPrismaService.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 1500, // 150 * 10
          }),
        }),
      );
    });

    it('should throw NotFoundException when contract not found', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({
        id: 'account-id-123',
      });
      mockPrismaService.contract.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        'Contract with ID contract-id-123 not found',
      );
    });

    it('should throw BadRequestException when contract has no products', async () => {
      const contractWithNoProducts = {
        id: 'contract-id-123',
        accountId: 'account-id-123',
        products: [],
      };

      mockPrismaService.account.findUnique.mockResolvedValue({
        id: 'account-id-123',
      });
      mockPrismaService.contract.findUnique.mockResolvedValue(
        contractWithNoProducts,
      );

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        /has no products/,
      );
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

    it('should throw BadRequestException if contractId is missing at service layer', async () => {
      // CreateInvoiceDto requires contractId via class-validator but the service
      // also guards against a falsy value in case it's bypassed.
      const dtoWithoutContract = {
        invoiceNumber: 'INV-NO-CONTRACT',
        accountId: 'account-id-123',
        issueDate: '2024-01-01',
        dueDate: '2024-01-31',
        // contractId intentionally omitted
      } as CreateInvoiceDto;

      await expect(service.create(dtoWithoutContract)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(dtoWithoutContract)).rejects.toThrow(
        'contractId is required to create an invoice',
      );
    });

    it('should throw BadRequestException if contract does not belong to account', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({
        id: 'account-id-123',
      });
      mockPrismaService.contract.findUnique.mockResolvedValue({
        id: 'contract-id-123',
        accountId: 'different-account-id',
        products: [{ id: 'cp-1' }],
      });

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
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
      mockPrismaService.contract.findUnique.mockResolvedValue(
        mockContractWithProducts,
      );

      await expect(service.create(invalidDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(invalidDto)).rejects.toThrow(
        'Due date must be after issue date',
      );
    });

    it('should throw ConflictException if invoice number already exists', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({
        id: 'account-id-123',
      });
      mockPrismaService.contract.findUnique.mockResolvedValue(
        mockContractWithProducts,
      );

      const prismaError = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
        },
      );
      mockPrismaService.$transaction.mockRejectedValue(prismaError);

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
        contractId: 'contract-id-123',
        issueDate: '2024-01-01',
        dueDate: '2024-01-31',
      };
      const mockAccount = { id: 'account-id-123' };
      const mockInvoice = {
        id: 'invoice-no-currency',
        currency: 'EUR',
        issueDate: new Date('2024-01-01'),
        dueDate: new Date('2024-01-31'),
        items: [],
      };

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.contract.findUnique.mockResolvedValue(
        mockContractWithProducts,
      );
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
        contractId: 'contract-id-123',
        issueDate: '2024-01-01',
        dueDate: '2024-01-31',
        currency: 'GBP',
      };
      const mockAccount = { id: 'account-id-123' };
      const mockInvoice = {
        id: 'invoice-gbp',
        currency: 'GBP',
        issueDate: new Date('2024-01-01'),
        dueDate: new Date('2024-01-31'),
        items: [],
      };

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.contract.findUnique.mockResolvedValue(
        mockContractWithProducts,
      );
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
    const baseDto: CreateInvoiceDto = {
      invoiceNumber: 'INV-EDGE-001',
      accountId: 'account-123',
      contractId: 'contract-id-123',
      issueDate: '2024-01-01',
      dueDate: '2024-01-31',
    };

    const mockContractForEdge = {
      id: 'contract-id-123',
      accountId: 'account-123',
      products: [
        {
          id: 'cp-1',
          contractId: 'contract-id-123',
          productId: 'product-1',
          quantity: 5,
          unitPrice: null,
          discount: null,
          product: {
            id: 'product-1',
            name: 'Basic Plan',
            basePrice: { toNumber: () => 1000, valueOf: () => 1000 },
          },
        },
      ],
    };

    it('should create invoice with periodStart, periodEnd, and paidDate', async () => {
      const dtoWithDates: CreateInvoiceDto = {
        ...baseDto,
        periodStart: '2024-01-01',
        periodEnd: '2024-01-31',
        paidDate: '2024-01-15',
      };

      const mockAccount = { id: 'account-123' };
      const mockInvoice = {
        id: 'invoice-dates',
        ...dtoWithDates,
        subtotal: 5000,
        total: 5000,
        issueDate: new Date('2024-01-01'),
        dueDate: new Date('2024-01-31'),
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-31'),
        paidDate: new Date('2024-01-15'),
        items: [],
      };

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.contract.findUnique.mockResolvedValue(
        mockContractForEdge,
      );
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
        ...baseDto,
        periodStart: '2024-02-01',
        periodEnd: '2024-01-01',
      };

      mockPrismaService.account.findUnique.mockResolvedValue({
        id: 'account-123',
      });
      mockPrismaService.contract.findUnique.mockResolvedValue(
        mockContractForEdge,
      );

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        'Period end date must be after period start date',
      );
    });

    it('should rethrow unknown errors during create', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({
        id: 'account-123',
      });
      mockPrismaService.contract.findUnique.mockResolvedValue(
        mockContractForEdge,
      );

      const unknownError = new Error('Database connection failed');
      mockPrismaService.$transaction.mockRejectedValueOnce(unknownError);

      await expect(service.create(baseDto)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('getInvoiceAccountId — private helper', () => {
    it('should throw NotFoundException when fetching account ID for deleted/non-existent invoice', async () => {
      const updateDto: UpdateInvoiceDto = {
        contractId: 'contract-123',
      };

      mockPrismaService.invoice.findUnique
        .mockResolvedValueOnce({
          id: 'invoice-id-123',
          accountId: 'account-123',
        })
        .mockResolvedValueOnce(null);

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
        accountId: 'different-account',
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
        dueDate: '2024-01-01',
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
        periodEnd: '2024-01-01',
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
      const updateDto: UpdateInvoiceDto = {
        contractId: 'contract-valid',
      };

      mockPrismaService.invoice.findUnique
        .mockResolvedValueOnce({
          id: 'invoice-id-123',
          accountId: 'account-123',
        })
        .mockResolvedValueOnce({ accountId: 'account-123' });

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

      mockPrismaService.invoice.findUnique.mockResolvedValue(
        mockExistingInvoice,
      );
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

      mockPrismaService.invoice.findUnique.mockResolvedValue(
        mockExistingInvoice,
      );
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
      mockPrismaService.invoice.findUnique.mockResolvedValue(parentInvoice);
      mockPrismaService.invoice.count.mockResolvedValue(25);
      mockPrismaService.invoice.create.mockResolvedValue({
        invoiceNumber: 'INV-2026-000001-Z',
        items: [],
        invoiceGroup: null,
      });

      const result = await service.createSubInvoice('parent-id', subDto as any);
      expect((result.data as any).invoiceNumber).toBe('INV-2026-000001-Z');

      mockPrismaService.invoice.count.mockResolvedValue(26);
      mockPrismaService.invoice.create.mockResolvedValue({
        invoiceNumber: 'INV-2026-000001-AA',
        items: [],
        invoiceGroup: null,
      });

      const result2 = await service.createSubInvoice(
        'parent-id',
        subDto as any,
      );
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
          total: 9999,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException on P2002 when sub-invoice number already exists', async () => {
      const { PrismaClientKnownRequestError } = jest.requireActual(
        '@prisma/client/runtime/library',
      ) as {
        PrismaClientKnownRequestError: typeof import('@prisma/client/runtime/library').PrismaClientKnownRequestError;
      };
      const prismaError = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '5.0.0' },
      );

      mockPrismaService.invoice.findUnique.mockResolvedValue(parentInvoice);
      mockPrismaService.invoice.count.mockResolvedValue(0);
      mockPrismaService.invoice.create.mockRejectedValue(prismaError);

      await expect(
        service.createSubInvoice('parent-id', subDto as any),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.createSubInvoice('parent-id', subDto as any),
      ).rejects.toThrow('Sub-invoice with this number already exists');
    });

    it('rethrows unknown errors during createSubInvoice', async () => {
      const unknownError = new Error('Unexpected DB failure');
      mockPrismaService.invoice.findUnique.mockResolvedValue(parentInvoice);
      mockPrismaService.invoice.count.mockResolvedValue(0);
      mockPrismaService.invoice.create.mockRejectedValue(unknownError);

      await expect(
        service.createSubInvoice('parent-id', subDto as any),
      ).rejects.toThrow('Unexpected DB failure');
    });

    it('omits periodStart and periodEnd when parent has none and DTO has none', async () => {
      const parentWithNoPeriod = {
        ...parentInvoice,
        periodStart: null,
        periodEnd: null,
      };
      const createdSub = {
        id: 'sub-no-period',
        invoiceNumber: 'INV-2026-000001-A',
        parentInvoiceId: 'parent-id',
        periodStart: undefined,
        periodEnd: undefined,
        items: [],
        invoiceGroup: null,
      };

      mockPrismaService.invoice.findUnique.mockResolvedValue(
        parentWithNoPeriod,
      );
      mockPrismaService.invoice.count.mockResolvedValue(0);
      mockPrismaService.invoice.create.mockResolvedValue(createdSub);

      await service.createSubInvoice('parent-id', subDto as any);

      expect(mockPrismaService.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            periodStart: undefined,
            periodEnd: undefined,
          }),
        }),
      );
    });

    it('uses default 0 for tax and discount when omitted in DTO', async () => {
      const dtoWithoutTaxDiscount = {
        subtotal: 5000,
        total: 5000,
        // tax and discount omitted — triggers ?? 0 branches at line 355, 389, 390
      };
      const createdSub = {
        id: 'sub-no-tax',
        invoiceNumber: 'INV-2026-000001-A',
        parentInvoiceId: 'parent-id',
        tax: 0,
        discount: 0,
        items: [],
        invoiceGroup: null,
      };

      mockPrismaService.invoice.findUnique.mockResolvedValue(parentInvoice);
      mockPrismaService.invoice.count.mockResolvedValue(0);
      mockPrismaService.invoice.create.mockResolvedValue(createdSub);

      await service.createSubInvoice('parent-id', dtoWithoutTaxDiscount as any);

      expect(mockPrismaService.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tax: 0,
            discount: 0,
          }),
        }),
      );
    });

    it('inherits periodStart and periodEnd from parent when omitted in DTO', async () => {
      const createdSub = {
        id: 'sub-inherit',
        invoiceNumber: 'INV-2026-000001-A',
        parentInvoiceId: 'parent-id',
        periodStart: parentInvoice.periodStart,
        periodEnd: parentInvoice.periodEnd,
        items: [],
        invoiceGroup: null,
      };

      mockPrismaService.invoice.findUnique.mockResolvedValue(parentInvoice);
      mockPrismaService.invoice.count.mockResolvedValue(0);
      mockPrismaService.invoice.create.mockResolvedValue(createdSub);

      await service.createSubInvoice('parent-id', subDto as any);

      expect(mockPrismaService.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            periodStart: parentInvoice.periodStart,
            periodEnd: parentInvoice.periodEnd,
          }),
        }),
      );
    });

    it('uses explicitly provided periodStart and periodEnd from DTO', async () => {
      const dtoWithPeriod = {
        ...subDto,
        periodStart: '2026-02-01',
        periodEnd: '2026-02-28',
      };
      const createdSub = {
        id: 'sub-explicit-period',
        invoiceNumber: 'INV-2026-000001-A',
        parentInvoiceId: 'parent-id',
        periodStart: new Date('2026-02-01'),
        periodEnd: new Date('2026-02-28'),
        items: [],
        invoiceGroup: null,
      };

      mockPrismaService.invoice.findUnique.mockResolvedValue(parentInvoice);
      mockPrismaService.invoice.count.mockResolvedValue(0);
      mockPrismaService.invoice.create.mockResolvedValue(createdSub);

      await service.createSubInvoice('parent-id', dtoWithPeriod as any);

      expect(mockPrismaService.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            periodStart: new Date('2026-02-01'),
            periodEnd: new Date('2026-02-28'),
          }),
        }),
      );
    });

    it('includes line items when items array is provided in DTO', async () => {
      const dtoWithItems = {
        ...subDto,
        items: [
          {
            description: 'Support fee',
            quantity: 1,
            unitPrice: 500,
            amount: 500,
          },
        ],
      };
      const createdSub = {
        id: 'sub-with-items',
        invoiceNumber: 'INV-2026-000001-A',
        parentInvoiceId: 'parent-id',
        items: [
          {
            id: 'item-1',
            description: 'Support fee',
            quantity: 1,
            unitPrice: 500,
            amount: 500,
          },
        ],
        invoiceGroup: null,
      };

      mockPrismaService.invoice.findUnique.mockResolvedValue(parentInvoice);
      mockPrismaService.invoice.count.mockResolvedValue(0);
      mockPrismaService.invoice.create.mockResolvedValue(createdSub);

      await service.createSubInvoice('parent-id', dtoWithItems as any);

      expect(mockPrismaService.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            items: { create: dtoWithItems.items },
          }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getSubInvoices
  // ---------------------------------------------------------------------------

  describe('getSubInvoices', () => {
    it('returns paginated sub-invoices of a parent', async () => {
      const parentInvoice = {
        id: 'parent-id',
        invoiceNumber: 'INV-2026-000001',
      };
      const subInvoices = [
        {
          id: 'sub-1',
          invoiceNumber: 'INV-2026-000001-A',
          parentInvoiceId: 'parent-id',
        },
        {
          id: 'sub-2',
          invoiceNumber: 'INV-2026-000001-B',
          parentInvoiceId: 'parent-id',
        },
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

    it('handles null aggregate sums gracefully (treats null as 0)', async () => {
      mockPrismaService.invoice.findUnique.mockResolvedValue({
        id: 'parent-id',
        invoiceNumber: 'INV-2026-000001',
        account: {},
        contract: null,
        items: [],
        invoiceGroup: null,
        _count: { items: 0, subInvoices: 2 },
      });
      // Prisma returns null sums when no rows matched
      mockPrismaService.invoice.aggregate.mockResolvedValue({
        _sum: { total: null, paidAmount: null },
      });

      const result = await service.findOne('parent-id');

      expect((result.data as any).subInvoiceTotals).toEqual({
        total: '0.00',
        paid: '0.00',
        outstanding: '0.00',
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
