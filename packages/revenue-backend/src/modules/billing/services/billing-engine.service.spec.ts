import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import {
  BillingEngineService,
  BillableProduct,
} from './billing-engine.service';
import { SeatCalculatorService } from './seat-calculator.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { TaxRatesService } from '../../tax-rates/tax-rates.service';
import { NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

const mockAuditLogService = { log: jest.fn() };
const mockTaxRates = { findApplicableRate: jest.fn() };

describe('BillingEngineService', () => {
  let service: BillingEngineService;
  let prismaService: PrismaService;
  let seatCalculator: SeatCalculatorService;

  const mockPrismaService = {
    contract: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    invoice: {
      create: jest.fn(),
      count: jest.fn(),
    },
    invoiceItem: {
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockSeatCalculator = {
    calculateSeatPricing: jest.fn(),
    calculateProration: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingEngineService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: SeatCalculatorService,
          useValue: mockSeatCalculator,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
        {
          provide: TaxRatesService,
          useValue: mockTaxRates,
        },
      ],
    }).compile();

    service = module.get<BillingEngineService>(BillingEngineService);
    prismaService = module.get<PrismaService>(PrismaService);
    seatCalculator = module.get<SeatCalculatorService>(SeatCalculatorService);

    // Prevent unused variable warnings
    void prismaService;
    void seatCalculator;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockPrismaService.invoiceItem.findMany.mockReset();
    mockPrismaService.invoiceItem.findMany.mockResolvedValue([]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateInvoiceFromContract', () => {
    const mockContract = {
      id: 'contract-123',
      contractNumber: 'CNT-2026-0001',
      accountId: 'account-123',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      contractValue: new Decimal(120000),
      billingFrequency: 'quarterly',
      seatCount: 50,
      committedSeats: 50,
      seatPrice: new Decimal(600),
      status: 'active',
      account: {
        id: 'account-123',
        accountName: 'Acme Corp',
        currency: 'USD',
        paymentTermsDays: 30,
      },
    };

    const mockInvoice = {
      id: 'invoice-123',
      invoiceNumber: 'INV-2026-000001',
      total: new Decimal(30000),
    };

    it('should throw NotFoundException if contract not found', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue(null);

      await expect(
        service.generateInvoiceFromContract({ contractId: 'invalid-id' }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.contract.findUnique).toHaveBeenCalledWith({
        where: { id: 'invalid-id' },
        include: {
          account: true,
          products: { include: { product: true } },
        },
      });
    });

    it('should throw error if contract is not active', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue({
        ...mockContract,
        status: 'expired',
      });

      await expect(
        service.generateInvoiceFromContract({ contractId: 'contract-123' }),
      ).rejects.toThrow('Contract contract-123 is not active');
    });

    it('records an audit entry for the generated invoice, inside the transaction', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue(mockContract);
      mockPrismaService.invoice.count.mockResolvedValue(0);
      mockSeatCalculator.calculateSeatPricing.mockReturnValue({
        seatCount: 50,
        pricePerSeat: new Decimal(600),
        subtotal: new Decimal(30000),
      });

      const tx = {
        invoice: { create: jest.fn().mockResolvedValue(mockInvoice) },
        invoiceItem: { createMany: jest.fn() },
      };
      mockPrismaService.$transaction.mockImplementation(async (callback) =>
        callback(tx),
      );

      await service.generateInvoiceFromContract({ contractId: 'contract-123' });

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'invoice',
          entityId: 'invoice-123',
          action: 'created',
        }),
        tx,
      );
    });

    it('refuses to bill an account on credit hold (P0-8)', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue({
        ...mockContract,
        account: { ...mockContract.account, creditHold: true },
      });

      await expect(
        service.generateInvoiceFromContract({ contractId: 'contract-123' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should generate invoice with seat-based pricing', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue(mockContract);
      mockPrismaService.invoice.count.mockResolvedValue(0);

      mockSeatCalculator.calculateSeatPricing.mockReturnValue({
        seatCount: 50,
        pricePerSeat: new Decimal(600),
        subtotal: new Decimal(30000),
      });

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          invoice: {
            create: jest.fn().mockResolvedValue(mockInvoice),
          },
          invoiceItem: {
            createMany: jest.fn(),
          },
        });
      });

      const result = await service.generateInvoiceFromContract({
        contractId: 'contract-123',
      });

      expect(result.invoiceId).toBe('invoice-123');
      expect(result.invoiceNumber).toBe('INV-2026-000001');
      expect(result.total.toString()).toBe('30000');
      expect(mockSeatCalculator.calculateSeatPricing).toHaveBeenCalledWith(
        50,
        mockContract.seatPrice,
        null,
      );
    });

    it('should generate invoice with fixed contract value', async () => {
      const fixedContract = {
        ...mockContract,
        seatCount: null,
        seatPrice: null,
        billingFrequency: 'annual',
      };

      mockPrismaService.contract.findUnique.mockResolvedValue(fixedContract);
      mockPrismaService.invoice.count.mockResolvedValue(0);

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          invoice: {
            create: jest.fn().mockResolvedValue({
              ...mockInvoice,
              total: new Decimal(120000),
            }),
          },
          invoiceItem: {
            createMany: jest.fn(),
          },
        });
      });

      const result = await service.generateInvoiceFromContract({
        contractId: 'contract-123',
      });

      expect(result.total.toString()).toBe('120000');
      expect(mockSeatCalculator.calculateSeatPricing).not.toHaveBeenCalled();
    });

    it('should generate invoice number with correct format', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue(mockContract);
      mockPrismaService.invoice.count.mockResolvedValue(42);

      mockSeatCalculator.calculateSeatPricing.mockReturnValue({
        seatCount: 50,
        pricePerSeat: new Decimal(600),
        subtotal: new Decimal(30000),
      });

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const year = new Date().getFullYear();
        return callback({
          invoice: {
            create: jest.fn().mockResolvedValue({
              ...mockInvoice,
              invoiceNumber: `INV-${year}-000043`,
            }),
          },
          invoiceItem: {
            createMany: jest.fn(),
          },
        });
      });

      const result = await service.generateInvoiceFromContract({
        contractId: 'contract-123',
      });

      const year = new Date().getFullYear();
      expect(result.invoiceNumber).toBe(`INV-${year}-000043`);
    });

    it('should calculate due date based on payment terms', async () => {
      const contractWith60Days = {
        ...mockContract,
        account: {
          ...mockContract.account,
          paymentTermsDays: 60,
        },
      };

      mockPrismaService.contract.findUnique.mockResolvedValue(
        contractWith60Days,
      );
      mockPrismaService.invoice.count.mockResolvedValue(0);

      mockSeatCalculator.calculateSeatPricing.mockReturnValue({
        seatCount: 50,
        pricePerSeat: new Decimal(600),
        subtotal: new Decimal(30000),
      });

      let capturedDueDate: Date;
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          invoice: {
            create: jest.fn().mockImplementation((data) => {
              capturedDueDate = data.data.dueDate;
              return Promise.resolve(mockInvoice);
            }),
          },
          invoiceItem: {
            createMany: jest.fn(),
          },
        });
      });

      await service.generateInvoiceFromContract({
        contractId: 'contract-123',
      });

      // Due date should be 60 days after issue date
      const issueDate = new Date();
      const expectedDueDate = new Date(issueDate);
      expectedDueDate.setDate(expectedDueDate.getDate() + 60);

      // Allow 1 day margin for test execution time
      const diff = Math.abs(
        capturedDueDate!.getTime() - expectedDueDate.getTime(),
      );
      expect(diff).toBeLessThan(86400000); // 1 day in milliseconds
    });

    it('should use custom period dates if provided', async () => {
      const periodStart = new Date('2026-01-01');
      const periodEnd = new Date('2026-03-31');

      mockPrismaService.contract.findUnique.mockResolvedValue(mockContract);
      mockPrismaService.invoice.count.mockResolvedValue(0);

      mockSeatCalculator.calculateSeatPricing.mockReturnValue({
        seatCount: 50,
        pricePerSeat: new Decimal(600),
        subtotal: new Decimal(30000),
      });

      let capturedPeriodStart: Date;
      let capturedPeriodEnd: Date;
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          invoice: {
            create: jest.fn().mockImplementation((data) => {
              capturedPeriodStart = data.data.periodStart;
              capturedPeriodEnd = data.data.periodEnd;
              return Promise.resolve(mockInvoice);
            }),
          },
          invoiceItem: {
            createMany: jest.fn(),
          },
        });
      });

      await service.generateInvoiceFromContract({
        contractId: 'contract-123',
        periodStart,
        periodEnd,
      });

      expect(capturedPeriodStart).toEqual(periodStart);
      expect(capturedPeriodEnd).toEqual(periodEnd);
    });

    it('should create invoice items with correct line descriptions', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue(mockContract);
      mockPrismaService.invoice.count.mockResolvedValue(0);

      mockSeatCalculator.calculateSeatPricing.mockReturnValue({
        seatCount: 50,
        pricePerSeat: new Decimal(600),
        subtotal: new Decimal(30000),
      });

      let capturedLineItems: any[];
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          invoice: {
            create: jest.fn().mockResolvedValue(mockInvoice),
          },
          invoiceItem: {
            createMany: jest.fn().mockImplementation((data) => {
              capturedLineItems = data.data;
              return Promise.resolve();
            }),
            findMany: jest.fn().mockResolvedValue([]),
          },
          $queryRaw: jest.fn().mockResolvedValue([]),
        });
      });

      await service.generateInvoiceFromContract({
        contractId: 'contract-123',
      });

      expect(capturedLineItems).toHaveLength(1);
      expect(capturedLineItems[0].description).toBe(
        'Quarterly Subscription - 50 seats',
      );
      expect(capturedLineItems[0].quantity.toString()).toBe('50');
      expect(capturedLineItems[0].unitPrice.toString()).toBe('600');
      expect(capturedLineItems[0].amount.toString()).toBe('30000');
    });

    it('should handle monthly billing frequency', async () => {
      const monthlyContract = {
        ...mockContract,
        billingFrequency: 'monthly',
        seatCount: null,
        seatPrice: null,
      };

      mockPrismaService.contract.findUnique.mockResolvedValue(monthlyContract);
      mockPrismaService.invoice.count.mockResolvedValue(0);

      let capturedLineItems: any[];
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          invoice: {
            create: jest.fn().mockResolvedValue(mockInvoice),
          },
          invoiceItem: {
            createMany: jest.fn().mockImplementation((data) => {
              capturedLineItems = data.data;
              return Promise.resolve();
            }),
            findMany: jest.fn().mockResolvedValue([]),
          },
          $queryRaw: jest.fn().mockResolvedValue([]),
        });
      });

      await service.generateInvoiceFromContract({
        contractId: 'contract-123',
      });

      // Monthly = contractValue / 12
      const expectedAmount = new Decimal(120000).div(12);
      expect(capturedLineItems[0].amount.toString()).toBe(
        expectedAmount.toString(),
      );
      expect(capturedLineItems[0].description).toBe('Monthly Subscription');
    });

    it('should handle quarterly billing frequency (value-based, not seat-based)', async () => {
      const quarterlyContract = {
        ...mockContract,
        billingFrequency: 'quarterly',
        seatCount: null,
        seatPrice: null,
      };

      mockPrismaService.contract.findUnique.mockResolvedValue(
        quarterlyContract,
      );
      mockPrismaService.invoice.count.mockResolvedValue(0);

      let capturedLineItems: any[];
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          invoice: {
            create: jest.fn().mockResolvedValue(mockInvoice),
          },
          invoiceItem: {
            createMany: jest.fn().mockImplementation((data) => {
              capturedLineItems = data.data;
              return Promise.resolve();
            }),
            findMany: jest.fn().mockResolvedValue([]),
          },
          $queryRaw: jest.fn().mockResolvedValue([]),
        });
      });

      await service.generateInvoiceFromContract({
        contractId: 'contract-123',
      });

      // Quarterly = contractValue / 4
      const expectedAmount = new Decimal(120000).div(4);
      expect(capturedLineItems[0].amount.toString()).toBe(
        expectedAmount.toString(),
      );
      expect(capturedLineItems[0].description).toBe('Quarterly Subscription');
    });

    it('should use default (monthly) billing period for unknown frequency', async () => {
      const unknownFreqContract = {
        ...mockContract,
        billingFrequency: 'biweekly', // unknown frequency
        seatCount: null,
        seatPrice: null,
      };

      mockPrismaService.contract.findUnique.mockResolvedValue(
        unknownFreqContract,
      );
      mockPrismaService.invoice.count.mockResolvedValue(0);

      let capturedLineItems: any[];
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          invoice: {
            create: jest.fn().mockResolvedValue(mockInvoice),
          },
          invoiceItem: {
            createMany: jest.fn().mockImplementation((data) => {
              capturedLineItems = data.data;
              return Promise.resolve();
            }),
            findMany: jest.fn().mockResolvedValue([]),
          },
          $queryRaw: jest.fn().mockResolvedValue([]),
        });
      });

      await service.generateInvoiceFromContract({
        contractId: 'contract-123',
      });

      // Unknown frequency defaults to monthly = contractValue / 12
      const expectedAmount = new Decimal(120000).div(12);
      expect(capturedLineItems[0].amount.toString()).toBe(
        expectedAmount.toString(),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 3.5: shouldBillProduct / getSetupFee / isFirstBillingPeriod
  // ──────────────────────────────────────────────────────────────────────────

  describe('isFirstBillingPeriod', () => {
    it('should return true when period start is same month as contract start', () => {
      const contractStart = new Date('2026-01-15');
      const periodStart = new Date('2026-01-01');
      expect(service.isFirstBillingPeriod(contractStart, periodStart)).toBe(
        true,
      );
    });

    it('should return false when period start is a later month', () => {
      const contractStart = new Date('2026-01-15');
      const periodStart = new Date('2026-02-01');
      expect(service.isFirstBillingPeriod(contractStart, periodStart)).toBe(
        false,
      );
    });

    it('should return false when period start is a different year', () => {
      const contractStart = new Date('2025-01-01');
      const periodStart = new Date('2026-01-01');
      expect(service.isFirstBillingPeriod(contractStart, periodStart)).toBe(
        false,
      );
    });
  });

  describe('shouldBillProduct', () => {
    const contractStart = new Date('2026-01-01');

    it('should return true when product is null (backward compat — default recurring)', () => {
      const periodStart = new Date('2026-01-01');
      expect(service.shouldBillProduct(null, contractStart, periodStart)).toBe(
        true,
      );
    });

    it('should return false for usage_based products (Phase 6)', () => {
      const product: BillableProduct = {
        chargeType: 'usage_based',
        setupFee: null,
        trialPeriodDays: null,
      };
      const periodStart = new Date('2026-01-01');
      expect(
        service.shouldBillProduct(product, contractStart, periodStart),
      ).toBe(false);
    });

    it('should return true for recurring products on every period', () => {
      const product: BillableProduct = {
        chargeType: 'recurring',
        setupFee: null,
        trialPeriodDays: null,
      };
      expect(
        service.shouldBillProduct(
          product,
          contractStart,
          new Date('2026-01-01'),
        ),
      ).toBe(true);
      expect(
        service.shouldBillProduct(
          product,
          contractStart,
          new Date('2026-02-01'),
        ),
      ).toBe(true);
      expect(
        service.shouldBillProduct(
          product,
          contractStart,
          new Date('2026-06-01'),
        ),
      ).toBe(true);
    });

    it('should return true for one_time product on first period', () => {
      const product: BillableProduct = {
        chargeType: 'one_time',
        setupFee: null,
        trialPeriodDays: null,
      };
      const periodStart = new Date('2026-01-15');
      expect(
        service.shouldBillProduct(product, contractStart, periodStart),
      ).toBe(true);
    });

    it('should return false for one_time product on second period', () => {
      const product: BillableProduct = {
        chargeType: 'one_time',
        setupFee: null,
        trialPeriodDays: null,
      };
      const periodStart = new Date('2026-02-01');
      expect(
        service.shouldBillProduct(product, contractStart, periodStart),
      ).toBe(false);
    });

    it('should return false during trial period', () => {
      const product: BillableProduct = {
        chargeType: 'recurring',
        setupFee: null,
        trialPeriodDays: 14,
      };
      // contractStart = Jan 1, trial ends Jan 15
      const periodDuringTrial = new Date('2026-01-10');
      expect(
        service.shouldBillProduct(product, contractStart, periodDuringTrial),
      ).toBe(false);
    });

    it('should return true after trial period ends', () => {
      const product: BillableProduct = {
        chargeType: 'recurring',
        setupFee: null,
        trialPeriodDays: 14,
      };
      // contractStart = Jan 1, trial ends Jan 15
      const periodAfterTrial = new Date('2026-01-16');
      expect(
        service.shouldBillProduct(product, contractStart, periodAfterTrial),
      ).toBe(true);
    });

    it('should skip even one_time products during trial period', () => {
      const product: BillableProduct = {
        chargeType: 'one_time',
        setupFee: null,
        trialPeriodDays: 30,
      };
      // contractStart = Jan 1, trial ends Jan 31
      const periodDuringTrial = new Date('2026-01-15');
      expect(
        service.shouldBillProduct(product, contractStart, periodDuringTrial),
      ).toBe(false);
    });
  });

  describe('getSetupFee', () => {
    it('should return 0 when product is null', () => {
      const fee = service.getSetupFee(null);
      expect(fee.toString()).toBe('0');
    });

    it('should return 0 when product has no setup fee', () => {
      const product: BillableProduct = {
        chargeType: 'recurring',
        setupFee: null,
        trialPeriodDays: null,
      };
      const fee = service.getSetupFee(product);
      expect(fee.toString()).toBe('0');
    });

    it('should return setup fee on first billing period', () => {
      const product: BillableProduct = {
        chargeType: 'recurring',
        setupFee: new Decimal(500),
        trialPeriodDays: null,
      };
      const fee = service.getSetupFee(product);
      expect(fee.toString()).toBe('500');
    });

    it('is not gated on calendar month (exactly-once is enforced against prior invoices)', () => {
      const product: BillableProduct = {
        chargeType: 'recurring',
        setupFee: new Decimal(500),
        trialPeriodDays: null,
      };
      // 31 Jan start first billed in Feb must still carry the fee
      const fee = service.getSetupFee(product);
      expect(fee.toString()).toBe('500');
    });
  });

  describe('generateInvoiceFromContract — setup fee path', () => {
    const mockContractWithSetupFee = {
      id: 'contract-123',
      contractNumber: 'CNT-2026-0001',
      accountId: 'account-123',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      contractValue: new Decimal(120000),
      billingFrequency: 'monthly',
      seatCount: null,
      seatPrice: null,
      status: 'active',
      account: {
        id: 'account-123',
        accountName: 'Acme Corp',
        currency: 'USD',
        paymentTermsDays: 30,
      },
    };

    it('should include setup fee line item when getSetupFee returns positive value', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue(
        mockContractWithSetupFee,
      );
      mockPrismaService.invoice.count.mockResolvedValue(0);

      // Spy on getSetupFee to return a non-zero setup fee
      jest.spyOn(service, 'getSetupFee').mockReturnValue(new Decimal(500));

      let capturedLineItems: any[];
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          invoice: {
            create: jest.fn().mockResolvedValue({
              id: 'invoice-setup',
              invoiceNumber: 'INV-2026-000001',
              total: new Decimal(10500),
            }),
          },
          invoiceItem: {
            createMany: jest.fn().mockImplementation((data) => {
              capturedLineItems = data.data;
              return Promise.resolve();
            }),
            findMany: jest.fn().mockResolvedValue([]),
          },
          $queryRaw: jest.fn().mockResolvedValue([]),
        });
      });

      await service.generateInvoiceFromContract({ contractId: 'contract-123' });

      // Should have 2 line items: subscription + setup fee
      expect(capturedLineItems).toHaveLength(2);
      expect(capturedLineItems[1].description).toBe('Setup Fee (one-time)');
      expect(capturedLineItems[1].amount.toString()).toBe('500');
    });

    it('should throw error when shouldBillProduct returns false', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue(
        mockContractWithSetupFee,
      );
      mockPrismaService.invoice.count.mockResolvedValue(0);

      // Spy on shouldBillProduct to return false
      jest.spyOn(service, 'shouldBillProduct').mockReturnValue(false);

      await expect(
        service.generateInvoiceFromContract({ contractId: 'contract-123' }),
      ).rejects.toThrow('Product billing skipped for period');
    });
  });

  describe('setup fee exactly-once (review finding 2)', () => {
    const contract = {
      id: 'contract-123',
      accountId: 'account-123',
      startDate: new Date('2026-01-31'),
      endDate: new Date('2026-12-31'),
      contractValue: new Decimal(1200),
      billingFrequency: 'monthly',
      seatCount: null,
      seatPrice: null,
      status: 'active',
      products: [
        {
          product: {
            name: 'Platform',
            basePrice: new Decimal(100),
            chargeType: 'recurring',
            setupFee: new Decimal(500),
            trialPeriodDays: null,
            volumeTiers: null,
          },
          quantity: 1,
          unitPrice: null,
          discount: null,
        },
      ],
      account: {
        id: 'account-123',
        currency: 'USD',
        paymentTermsDays: 30,
        creditHold: false,
      },
    };

    const run = async (priorSetup: { description: string }[]) => {
      mockPrismaService.contract.findUnique.mockResolvedValue(contract);
      mockPrismaService.invoice.count.mockResolvedValue(0);
      const findMany = jest.fn().mockResolvedValue(priorSetup);
      const createMany = jest.fn();
      const tx = {
        invoice: {
          create: jest.fn().mockResolvedValue({
            id: 'inv',
            invoiceNumber: 'INV-1',
            total: new Decimal(0),
          }),
        },
        invoiceItem: { createMany, findMany },
        $queryRaw: jest.fn().mockResolvedValue([]),
      };
      mockPrismaService.$transaction.mockImplementation(async (cb) => cb(tx));
      await service.generateInvoiceFromContract({
        contractId: 'contract-123',
        periodStart: new Date('2026-02-01'),
        periodEnd: new Date('2026-03-01'),
      });
      return { tx, items: createMany.mock.calls[0][0].data as any[] };
    };

    it('charges the fee on a first invoice outside the start month', async () => {
      const { items } = await run([]);
      expect(items.map((i) => i.description)).toContain(
        'Setup Fee (one-time) — Platform',
      );
    });

    it('omits the fee when a prior non-void invoice already carried it', async () => {
      const { tx, items } = await run([
        { description: 'Setup Fee (one-time) — Platform' },
      ]);
      expect(items.map((i) => i.description)).toEqual(['Platform']);
      expect(tx.invoice.create.mock.calls[0][0].data.subtotal.toString()).toBe(
        '100',
      );
      expect(tx.invoiceItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            invoice: expect.objectContaining({
              contractId: 'contract-123',
              status: { notIn: ['void', 'cancelled'] },
            }),
          }),
        }),
      );
    });
  });

  describe('period derived from billingDate (review finding 1)', () => {
    const contract = {
      id: 'contract-123',
      accountId: 'account-123',
      startDate: new Date('2026-01-15T00:00:00Z'),
      endDate: new Date('2027-12-31T00:00:00Z'),
      contractValue: new Decimal(1200),
      billingFrequency: 'monthly',
      seatCount: null,
      seatPrice: null,
      status: 'active',
      products: [],
      account: {
        id: 'account-123',
        currency: 'USD',
        paymentTermsDays: 30,
        creditHold: false,
      },
    };

    const periodFor = async (c: any, billingDate: string) => {
      mockPrismaService.contract.findUnique.mockResolvedValue(c);
      mockPrismaService.invoice.count.mockResolvedValue(0);
      const create = jest
        .fn()
        .mockResolvedValue({ id: 'i', invoiceNumber: 'n', total: 0 });
      mockPrismaService.$transaction.mockImplementation(async (cb) =>
        cb({ invoice: { create }, invoiceItem: { createMany: jest.fn() } }),
      );
      await service.generateInvoiceFromContract({
        contractId: c.id,
        billingDate: new Date(billingDate),
      });
      const d = create.mock.calls[0][0].data;
      return [
        d.periodStart.toISOString().slice(0, 10),
        d.periodEnd.toISOString().slice(0, 10),
      ];
    };

    it('aligns monthly to the contract boundary regardless of run day', async () => {
      expect(await periodFor(contract, '2026-03-15')).toEqual([
        '2026-03-15',
        '2026-04-15',
      ]);
      expect(await periodFor(contract, '2026-04-02')).toEqual([
        '2026-03-15',
        '2026-04-15',
      ]);
    });

    it('aligns quarterly and annual', async () => {
      expect(
        await periodFor(
          { ...contract, billingFrequency: 'quarterly' },
          '2026-09-01',
        ),
      ).toEqual(['2026-07-15', '2026-10-15']);
      expect(
        await periodFor(
          { ...contract, billingFrequency: 'annual' },
          '2027-02-01',
        ),
      ).toEqual(['2027-01-15', '2028-01-15']);
    });

    it('clamps month-end anchors instead of overflowing', async () => {
      const c = { ...contract, startDate: new Date('2026-01-31T00:00:00Z') };
      expect(await periodFor(c, '2026-02-10')).toEqual([
        '2026-01-31',
        '2026-02-28',
      ]);
      expect(await periodFor(c, '2026-03-05')).toEqual([
        '2026-02-28',
        '2026-03-31',
      ]);
    });
  });

  describe('findContractsDueForBilling (review finding 1)', () => {
    it('excludes contracts already invoiced for the period and pages by cursor', async () => {
      mockPrismaService.contract.findMany.mockResolvedValue([{ id: 'c-2' }]);
      const asOf = new Date('2026-02-10');
      await service.findContractsDueForBilling('monthly', asOf, {
        afterId: 'c-1',
        take: 100,
      });
      const args = mockPrismaService.contract.findMany.mock.calls[0][0];
      expect(args.where.invoices).toEqual({
        none: { periodStart: { lte: asOf }, periodEnd: { gt: asOf } },
      });
      expect(args.where.id).toEqual({ gt: 'c-1' });
      expect(args.skip).toBeUndefined();
      expect(args.take).toBe(100);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // previewInvoice (dry run)
  // ──────────────────────────────────────────────────────────────────────────

  describe('previewInvoice', () => {
    const periodStart = new Date('2026-01-01');
    const periodEnd = new Date('2026-03-31');

    const baseContract = {
      id: 'contract-123',
      contractNumber: 'CNT-2026-0001',
      accountId: 'account-123',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      contractValue: new Decimal(120000),
      billingFrequency: 'quarterly',
      seatCount: null,
      committedSeats: null,
      seatPrice: null,
      status: 'active',
      products: [],
      account: {
        id: 'account-123',
        accountName: 'Acme Corp',
        currency: 'USD',
        paymentTermsDays: 30,
      },
    };

    it('should return isDryRun true and invoiceId null for contract with products', async () => {
      const contractWithProducts = {
        ...baseContract,
        products: [
          {
            product: { name: 'License', basePrice: new Decimal(100) },
            quantity: 5,
            unitPrice: null,
            discount: null,
          },
        ],
      };

      mockPrismaService.contract.findUnique.mockResolvedValue(
        contractWithProducts,
      );
      mockPrismaService.invoice.count.mockResolvedValue(0);

      const result = await service.previewInvoice({
        contractId: 'contract-123',
        periodStart,
        periodEnd,
      });

      expect(result.isDryRun).toBe(true);
      expect(result.invoiceId).toBeNull();
      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0].description).toBe('License');
      expect(result.lineItems[0].amount.toString()).toBe('500'); // 100 * 5
      expect(result.subtotal.toString()).toBe('500');
      expect(result.total.toString()).toBe('500');
    });

    it('should return seat line item when contract has seatCount and seatPrice and no products', async () => {
      const seatContract = {
        ...baseContract,
        seatCount: 10,
        seatPrice: new Decimal(200),
        products: [],
      };

      mockPrismaService.contract.findUnique.mockResolvedValue(seatContract);
      mockPrismaService.invoice.count.mockResolvedValue(0);

      mockSeatCalculator.calculateSeatPricing.mockReturnValue({
        seatCount: 10,
        pricePerSeat: new Decimal(200),
        subtotal: new Decimal(2000),
      });

      const result = await service.previewInvoice({
        contractId: 'contract-123',
        periodStart,
        periodEnd,
      });

      expect(result.isDryRun).toBe(true);
      expect(result.invoiceId).toBeNull();
      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0].description).toContain('10 seats');
      expect(result.lineItems[0].amount.toString()).toBe('2000');
      expect(result.subtotal.toString()).toBe('2000');
      expect(result.total.toString()).toBe('2000');
      expect(mockSeatCalculator.calculateSeatPricing).toHaveBeenCalledWith(
        10,
        seatContract.seatPrice,
        null,
      );
    });

    it('should return flat-fee line item when contract has no products and no seat data', async () => {
      const flatFeeContract = {
        ...baseContract,
        contractValue: new Decimal(12000),
        billingFrequency: 'monthly',
        seatCount: null,
        seatPrice: null,
        products: [],
      };

      mockPrismaService.contract.findUnique.mockResolvedValue(flatFeeContract);
      mockPrismaService.invoice.count.mockResolvedValue(0);

      const result = await service.previewInvoice({
        contractId: 'contract-123',
        periodStart,
        periodEnd,
      });

      expect(result.isDryRun).toBe(true);
      expect(result.invoiceId).toBeNull();
      expect(result.lineItems).toHaveLength(1);
      // monthly: contractValue / 12 = 1000
      expect(result.lineItems[0].unitPrice.toString()).toBe('1000');
      expect(result.lineItems[0].amount.toString()).toBe('1000');
    });

    it('should throw NotFoundException when contract does not exist', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue(null);

      await expect(
        service.previewInvoice({ contractId: 'no-such-id' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw Error when contract is not active', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue({
        ...baseContract,
        status: 'cancelled',
      });

      await expect(
        service.previewInvoice({ contractId: 'contract-123' }),
      ).rejects.toThrow('Contract contract-123 is not active');
    });

    it('should NOT call $transaction or invoice.create', async () => {
      const flatFeeContract = {
        ...baseContract,
        contractValue: new Decimal(48000),
        billingFrequency: 'quarterly',
        products: [],
      };

      mockPrismaService.contract.findUnique.mockResolvedValue(flatFeeContract);
      mockPrismaService.invoice.count.mockResolvedValue(0);

      await service.previewInvoice({ contractId: 'contract-123' });

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      expect(mockPrismaService.invoice.create).not.toHaveBeenCalled();
    });

    it('should produce same financial figures as generateInvoiceFromContract for seat-based contract', async () => {
      const seatContract = {
        ...baseContract,
        seatCount: 50,
        seatPrice: new Decimal(600),
        products: [],
      };

      const seatPricingResult = {
        seatCount: 50,
        pricePerSeat: new Decimal(600),
        subtotal: new Decimal(30000),
      };

      // --- preview ---
      mockPrismaService.contract.findUnique.mockResolvedValue(seatContract);
      mockPrismaService.invoice.count.mockResolvedValue(0);
      mockSeatCalculator.calculateSeatPricing.mockReturnValue(
        seatPricingResult,
      );

      const previewResult = await service.previewInvoice({
        contractId: 'contract-123',
        periodStart,
        periodEnd,
      });

      jest.clearAllMocks();

      // --- real generate ---
      mockPrismaService.contract.findUnique.mockResolvedValue(seatContract);
      mockPrismaService.invoice.count.mockResolvedValue(0);
      mockSeatCalculator.calculateSeatPricing.mockReturnValue(
        seatPricingResult,
      );

      const mockCreatedInvoice = {
        id: 'invoice-gen',
        invoiceNumber: 'INV-2026-000001',
        total: new Decimal(30000),
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          invoice: {
            create: jest.fn().mockResolvedValue(mockCreatedInvoice),
          },
          invoiceItem: {
            createMany: jest.fn(),
          },
        });
      });

      await service.generateInvoiceFromContract({
        contractId: 'contract-123',
        periodStart,
        periodEnd,
      });

      // The preview subtotal, tax, discount, total and first lineItem.amount
      // must match what computeLineItems returns (same path, same inputs).
      expect(previewResult.subtotal.toString()).toBe('30000');
      expect(previewResult.tax.toString()).toBe('0');
      expect(previewResult.discount.toString()).toBe('0');
      expect(previewResult.total.toString()).toBe('30000');
      expect(previewResult.lineItems[0].amount.toString()).toBe('30000');
    });
  });

  describe('generateInvoiceFromContract — annual frequency', () => {
    const mockContractLocal = {
      id: 'contract-123',
      contractNumber: 'CNT-2026-0001',
      accountId: 'account-123',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      contractValue: new Decimal(120000),
      billingFrequency: 'annual',
      seatCount: null,
      seatPrice: null,
      status: 'active',
      account: {
        id: 'account-123',
        accountName: 'Acme Corp',
        currency: 'USD',
        paymentTermsDays: 30,
      },
    };

    const mockInvoiceLocal = {
      id: 'invoice-123',
      invoiceNumber: 'INV-2026-000001',
      total: new Decimal(120000),
    };

    it('should handle annual billing frequency', async () => {
      const annualContract = {
        ...mockContractLocal,
        billingFrequency: 'annual',
        seatCount: null,
        seatPrice: null,
      };

      mockPrismaService.contract.findUnique.mockResolvedValue(annualContract);
      mockPrismaService.invoice.count.mockResolvedValue(0);

      let capturedLineItems: any[];
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          invoice: {
            create: jest.fn().mockResolvedValue(mockInvoiceLocal),
          },
          invoiceItem: {
            createMany: jest.fn().mockImplementation((data) => {
              capturedLineItems = data.data;
              return Promise.resolve();
            }),
            findMany: jest.fn().mockResolvedValue([]),
          },
          $queryRaw: jest.fn().mockResolvedValue([]),
        });
      });

      await service.generateInvoiceFromContract({
        contractId: 'contract-123',
      });

      // Annual = full contractValue
      expect(capturedLineItems[0].amount.toString()).toBe('120000');
      expect(capturedLineItems[0].description).toBe('Annual Subscription');
    });
  });

  describe('tax (P0-6) and product pricing (P0-7)', () => {
    const periodStart = new Date('2026-01-01');

    const contractWith = (overrides: Record<string, any>) => ({
      id: 'contract-1',
      accountId: 'account-1',
      startDate: new Date('2026-01-01'),
      billingFrequency: 'monthly',
      contractValue: new Decimal(12000),
      seatCount: null,
      seatPrice: null,
      account: { billingCountry: 'DE', billingState: null, currency: 'EUR' },
      products: [],
      ...overrides,
    });

    const productLine = (
      product: Record<string, any>,
      cp: Record<string, any> = {},
    ) => ({
      quantity: 10,
      unitPrice: null,
      discount: null,
      ...cp,
      product: {
        name: 'Seats',
        basePrice: new Decimal(100),
        chargeType: 'recurring',
        setupFee: null,
        trialPeriodDays: null,
        volumeTiers: null,
        ...product,
      },
    });

    beforeEach(() => {
      mockTaxRates.findApplicableRate.mockReset();
    });

    it('applies the tax rate for the account jurisdiction', async () => {
      mockTaxRates.findApplicableRate.mockResolvedValue({
        jurisdiction: 'DE',
        taxType: 'vat',
        rate: new Decimal('0.19'),
        name: 'German VAT',
      });

      const result = await service.computeLineItems(
        contractWith({ products: [productLine({})] }),
        null,
        periodStart,
      );

      expect(result.subtotal.toString()).toBe('1000');
      expect(result.tax.toString()).toBe('190');
      expect(result.total.toString()).toBe('1190');
    });

    it('prefers billing state over country when resolving jurisdiction', async () => {
      mockTaxRates.findApplicableRate.mockResolvedValue({
        rate: new Decimal('0.0875'),
        taxType: 'sales_tax',
        jurisdiction: 'US-CA',
      });

      await service.computeLineItems(
        contractWith({
          account: { billingCountry: 'US', billingState: 'US-CA' },
          products: [productLine({})],
        }),
        null,
        periodStart,
      );

      expect(mockTaxRates.findApplicableRate).toHaveBeenCalledWith(
        'US-CA',
        expect.any(Date),
      );
    });

    it('bills zero tax rather than failing when no rate is configured', async () => {
      mockTaxRates.findApplicableRate.mockResolvedValue(null);

      const result = await service.computeLineItems(
        contractWith({ products: [productLine({})] }),
        null,
        periodStart,
      );

      expect(result.tax.toString()).toBe('0');
      expect(result.total.toString()).toBe('1000');
    });

    it('charges each product setup fee until a prior invoice carried it', async () => {
      mockTaxRates.findApplicableRate.mockResolvedValue(null);
      const contract = contractWith({
        products: [productLine({ setupFee: new Decimal(500) })],
      });

      const first = await service.computeLineItems(contract, null, periodStart);
      expect(
        first.lineItems.some((l: any) => /setup fee/i.test(l.description)),
      ).toBe(true);
      expect(first.subtotal.toString()).toBe('1500');

      const later = await service.computeLineItems(
        contract,
        null,
        new Date('2026-05-01'),
        new Set(['Setup Fee (one-time) — Seats']),
      );
      expect(
        later.lineItems.some((l: any) => /setup fee/i.test(l.description)),
      ).toBe(false);
      expect(later.subtotal.toString()).toBe('1000');
    });

    it('applies volume tiers when the contract does not override the price', async () => {
      mockTaxRates.findApplicableRate.mockResolvedValue(null);
      mockSeatCalculator.calculateSeatPricing.mockReturnValue({
        seatCount: 10,
        pricePerSeat: new Decimal(80),
        subtotal: new Decimal(800),
      });

      const result = await service.computeLineItems(
        contractWith({
          products: [
            productLine({
              volumeTiers: [{ minSeats: 10, maxSeats: 50, pricePerSeat: 80 }],
            }),
          ],
        }),
        null,
        periodStart,
      );

      expect(mockSeatCalculator.calculateSeatPricing).toHaveBeenCalledWith(
        10,
        expect.anything(),
        [{ minSeats: 10, maxSeats: 50, pricePerSeat: 80 }],
      );
      expect(result.subtotal.toString()).toBe('800');
    });

    it('lets a negotiated contract price win over catalog tiers', async () => {
      mockTaxRates.findApplicableRate.mockResolvedValue(null);
      mockSeatCalculator.calculateSeatPricing.mockClear();

      const result = await service.computeLineItems(
        contractWith({
          products: [
            productLine(
              {
                volumeTiers: [{ minSeats: 10, maxSeats: 50, pricePerSeat: 80 }],
              },
              { unitPrice: 60 },
            ),
          ],
        }),
        null,
        periodStart,
      );

      // The tier is still computed, but only to compare — billing uses the
      // negotiated price, and a cheaper negotiated price reports no divergence.
      expect(result.subtotal.toString()).toBe('600');
      expect(result.tierDivergences).toHaveLength(0);
    });

    it('skips a usage_based product but still bills the rest', async () => {
      mockTaxRates.findApplicableRate.mockResolvedValue(null);

      const result = await service.computeLineItems(
        contractWith({
          products: [
            productLine({ name: 'Metered API', chargeType: 'usage_based' }),
            productLine({ name: 'Platform' }),
          ],
        }),
        null,
        periodStart,
      );

      expect(result.lineItems.map((l: any) => l.description)).toEqual([
        'Platform',
      ]);
      expect(result.subtotal.toString()).toBe('1000');
    });
  });

  describe('tier divergence signal (negotiated price wins, but surface it)', () => {
    const periodStart = new Date('2026-01-01');

    const contractWithTiered = (cpOverrides: Record<string, any>) => ({
      id: 'contract-1',
      accountId: 'account-1',
      status: 'active',
      startDate: new Date('2026-01-01'),
      billingFrequency: 'monthly',
      contractValue: new Decimal(12000),
      seatCount: null,
      seatPrice: null,
      account: {
        billingCountry: 'DE',
        billingState: null,
        currency: 'EUR',
        paymentTermsDays: 30,
      },
      products: [
        {
          quantity: 10,
          discount: null,
          ...cpOverrides,
          product: {
            name: 'Enterprise Volume',
            basePrice: new Decimal(100),
            chargeType: 'recurring',
            setupFee: null,
            trialPeriodDays: null,
            volumeTiers: [{ minSeats: 10, maxSeats: 50, pricePerSeat: 80 }],
          },
        },
      ],
    });

    beforeEach(() => {
      mockTaxRates.findApplicableRate.mockResolvedValue(null);
      mockSeatCalculator.calculateSeatPricing.mockReturnValue({
        seatCount: 10,
        pricePerSeat: new Decimal(80),
        subtotal: new Decimal(800),
      });
    });

    it('still bills the negotiated price but reports the cheaper tier', async () => {
      const result = await service.computeLineItems(
        contractWithTiered({ unitPrice: 100 }),
        null,
        periodStart,
      );

      // Billing is unchanged: the negotiated price wins.
      expect(result.subtotal.toString()).toBe('1000');
      expect(result.tierDivergences).toHaveLength(1);
      expect(result.tierDivergences[0]).toMatchObject({
        productName: 'Enterprise Volume',
        negotiatedUnitPrice: '100.00',
        tierUnitPrice: '80.00',
        negotiatedAmount: '1000.00',
        tierAmount: '800.00',
      });
    });

    it('reports nothing when the negotiated price already beats the tier', async () => {
      const result = await service.computeLineItems(
        contractWithTiered({ unitPrice: 60 }),
        null,
        periodStart,
      );

      expect(result.subtotal.toString()).toBe('600');
      expect(result.tierDivergences).toHaveLength(0);
    });

    it('reports nothing when the contract has no negotiated price', async () => {
      const result = await service.computeLineItems(
        contractWithTiered({ unitPrice: null }),
        null,
        periodStart,
      );

      expect(result.tierDivergences).toHaveLength(0);
    });

    it('records the divergence in the invoice audit metadata', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue(
        contractWithTiered({ unitPrice: 100 }),
      );
      mockPrismaService.invoice.count.mockResolvedValue(0);
      mockPrismaService.$transaction.mockImplementation(async (cb: any) =>
        cb({
          invoice: {
            create: jest.fn().mockResolvedValue({
              id: 'invoice-1',
              invoiceNumber: 'INV-2026-000001',
              total: new Decimal(1000),
            }),
          },
          invoiceItem: { createMany: jest.fn() },
        }),
      );

      await service.generateInvoiceFromContract({ contractId: 'contract-1' });

      const entry = mockAuditLogService.log.mock.calls.at(-1)[0];
      expect(entry.metadata.tierDivergences).toHaveLength(1);
    });

    it('surfaces the divergence in dry-run output', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue(
        contractWithTiered({ unitPrice: 100 }),
      );
      mockPrismaService.invoice.count.mockResolvedValue(0);

      const preview = await service.previewInvoice({
        contractId: 'contract-1',
      });

      expect(preview.tierDivergences).toHaveLength(1);
      expect(preview.tierDivergences?.[0].tierUnitPrice).toBe('80.00');
    });
  });

  describe('tax status — zero-rated vs unrated (P0-6 follow-up)', () => {
    const periodStart = new Date('2026-01-01');

    const contractFor = (account: Record<string, any>) => ({
      id: 'contract-1',
      accountId: 'account-1',
      status: 'active',
      startDate: new Date('2026-01-01'),
      billingFrequency: 'monthly',
      contractValue: new Decimal(12000),
      seatCount: null,
      seatPrice: null,
      account: { currency: 'EUR', paymentTermsDays: 30, ...account },
      products: [
        {
          quantity: 10,
          unitPrice: null,
          discount: null,
          product: {
            name: 'Care Platform',
            basePrice: new Decimal(100),
            chargeType: 'recurring',
            setupFee: null,
            trialPeriodDays: null,
            volumeTiers: null,
          },
        },
      ],
    });

    it('treats a configured 0% rate as rated, not a problem', async () => {
      // Legitimate zero-rated supply (e.g. Finnish healthcare VAT exemption).
      mockTaxRates.findApplicableRate.mockResolvedValue({
        jurisdiction: 'FI',
        taxType: 'vat',
        rate: new Decimal('0'),
        name: 'Healthcare exemption',
      });

      const result = await service.computeLineItems(
        contractFor({ billingCountry: 'FI' }),
        null,
        periodStart,
      );

      expect(result.tax.toString()).toBe('0');
      expect(result.taxStatus).toBe('zero_rated');
    });

    it('flags a zero that comes from no configured rate', async () => {
      mockTaxRates.findApplicableRate.mockResolvedValue(null);

      const result = await service.computeLineItems(
        contractFor({ billingCountry: 'DE' }),
        null,
        periodStart,
      );

      expect(result.tax.toString()).toBe('0');
      expect(result.taxStatus).toBe('unrated_no_rate');
    });

    it('flags an account with no jurisdiction at all', async () => {
      mockTaxRates.findApplicableRate.mockResolvedValue(null);

      const result = await service.computeLineItems(
        contractFor({ billingCountry: null, billingState: null }),
        null,
        periodStart,
      );

      expect(result.taxStatus).toBe('unrated_no_jurisdiction');
      expect(mockTaxRates.findApplicableRate).not.toHaveBeenCalled();
    });

    it('reports a normal rate as rated', async () => {
      mockTaxRates.findApplicableRate.mockResolvedValue({
        jurisdiction: 'DE',
        taxType: 'vat',
        rate: new Decimal('0.19'),
        name: 'German VAT',
      });

      const result = await service.computeLineItems(
        contractFor({ billingCountry: 'DE' }),
        null,
        periodStart,
      );

      expect(result.taxStatus).toBe('rated');
      expect(result.tax.toString()).toBe('190');
    });

    it('carries an unrated flag into audit metadata and dry-run output', async () => {
      mockTaxRates.findApplicableRate.mockResolvedValue(null);
      mockPrismaService.contract.findUnique.mockResolvedValue(
        contractFor({ billingCountry: 'DE' }),
      );
      mockPrismaService.invoice.count.mockResolvedValue(0);
      mockPrismaService.$transaction.mockImplementation(async (cb: any) =>
        cb({
          invoice: {
            create: jest.fn().mockResolvedValue({
              id: 'invoice-1',
              invoiceNumber: 'INV-2026-000001',
              total: new Decimal(1000),
            }),
          },
          invoiceItem: { createMany: jest.fn() },
        }),
      );

      await service.generateInvoiceFromContract({ contractId: 'contract-1' });
      const entry = mockAuditLogService.log.mock.calls.at(-1)[0];
      expect(entry.metadata.taxStatus).toBe('unrated_no_rate');

      const preview = await service.previewInvoice({
        contractId: 'contract-1',
      });
      expect(preview.taxStatus).toBe('unrated_no_rate');
    });

    it('does not flag a configured zero rate in audit metadata', async () => {
      mockTaxRates.findApplicableRate.mockResolvedValue({
        jurisdiction: 'FI',
        taxType: 'vat',
        rate: new Decimal('0'),
        name: 'Healthcare exemption',
      });
      mockPrismaService.contract.findUnique.mockResolvedValue(
        contractFor({ billingCountry: 'FI' }),
      );
      mockPrismaService.invoice.count.mockResolvedValue(0);
      mockPrismaService.$transaction.mockImplementation(async (cb: any) =>
        cb({
          invoice: {
            create: jest.fn().mockResolvedValue({
              id: 'invoice-2',
              invoiceNumber: 'INV-2026-000002',
              total: new Decimal(1000),
            }),
          },
          invoiceItem: { createMany: jest.fn() },
        }),
      );

      await service.generateInvoiceFromContract({ contractId: 'contract-1' });
      const entry = mockAuditLogService.log.mock.calls.at(-1)[0];
      expect(entry.metadata.taxStatus).toBe('zero_rated');
    });
  });
});
