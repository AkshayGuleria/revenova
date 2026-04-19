import { Test, TestingModule } from '@nestjs/testing';
import {
  BillingEngineService,
  BillableProduct,
} from './billing-engine.service';
import { SeatCalculatorService } from './seat-calculator.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('BillingEngineService', () => {
  let service: BillingEngineService;
  let prismaService: PrismaService;
  let seatCalculator: SeatCalculatorService;

  const mockPrismaService = {
    contract: {
      findUnique: jest.fn(),
    },
    invoice: {
      create: jest.fn(),
      count: jest.fn(),
    },
    invoiceItem: {
      createMany: jest.fn(),
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
          },
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
          },
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
          },
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
          },
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
    const contractStart = new Date('2026-01-01');

    it('should return 0 when product is null', () => {
      const fee = service.getSetupFee(
        null,
        contractStart,
        new Date('2026-01-01'),
      );
      expect(fee.toString()).toBe('0');
    });

    it('should return 0 when product has no setup fee', () => {
      const product: BillableProduct = {
        chargeType: 'recurring',
        setupFee: null,
        trialPeriodDays: null,
      };
      const fee = service.getSetupFee(
        product,
        contractStart,
        new Date('2026-01-01'),
      );
      expect(fee.toString()).toBe('0');
    });

    it('should return setup fee on first billing period', () => {
      const product: BillableProduct = {
        chargeType: 'recurring',
        setupFee: new Decimal(500),
        trialPeriodDays: null,
      };
      const fee = service.getSetupFee(
        product,
        contractStart,
        new Date('2026-01-15'),
      );
      expect(fee.toString()).toBe('500');
    });

    it('should return 0 for setup fee on subsequent periods', () => {
      const product: BillableProduct = {
        chargeType: 'recurring',
        setupFee: new Decimal(500),
        trialPeriodDays: null,
      };
      const fee = service.getSetupFee(
        product,
        contractStart,
        new Date('2026-02-01'),
      );
      expect(fee.toString()).toBe('0');
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
          },
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
          },
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
});
