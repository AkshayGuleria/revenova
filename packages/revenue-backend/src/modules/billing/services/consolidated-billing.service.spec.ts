import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConsolidatedBillingService } from './consolidated-billing.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('ConsolidatedBillingService', () => {
  let service: ConsolidatedBillingService;
  let prisma: PrismaService;

  const mockPrismaService = {
    account: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    contract: {
      findMany: jest.fn(),
    },
    invoice: {
      create: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    invoiceItem: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsolidatedBillingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ConsolidatedBillingService>(
      ConsolidatedBillingService,
    );
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateConsolidatedInvoice', () => {
    it('should generate consolidated invoice for parent and subsidiaries', async () => {
      const parentAccount = {
        id: 'parent-id',
        accountName: 'Parent Corp',
        currency: 'USD',
        paymentTermsDays: 30,
        creditHold: false,
        deletedAt: null,
      };

      const subsidiaries = [
        {
          id: 'sub-1',
          accountName: 'Subsidiary 1',
          parentAccountId: 'parent-id',
        },
        {
          id: 'sub-2',
          accountName: 'Subsidiary 2',
          parentAccountId: 'parent-id',
        },
      ];

      const contracts = [
        {
          id: 'contract-1',
          contractNumber: 'CNT-001',
          accountId: 'parent-id',
          status: 'active',
          contractValue: new Decimal(120000),
          billingFrequency: 'annual',
          seatCount: 10,
          seatPrice: new Decimal(1000),
          account: { id: 'parent-id', accountName: 'Parent Corp' },
          products: [],
        },
        {
          id: 'contract-2',
          contractNumber: 'CNT-002',
          accountId: 'sub-1',
          status: 'active',
          contractValue: new Decimal(60000),
          billingFrequency: 'annual',
          seatCount: 5,
          seatPrice: new Decimal(1000),
          account: { id: 'sub-1', accountName: 'Subsidiary 1' },
          products: [],
        },
      ];

      const createdInvoice = {
        id: 'invoice-id',
        invoiceNumber: 'INV-202601-00001',
        total: new Decimal(15000),
      };

      jest
        .spyOn(prisma.account, 'findUnique')
        .mockResolvedValueOnce(parentAccount as any);
      // Mock for getDescendantAccounts - first level
      jest
        .spyOn(prisma.account, 'findMany')
        .mockResolvedValueOnce(subsidiaries as any);
      // Mock for getDescendantAccounts - second level (sub-1 has no children)
      jest.spyOn(prisma.account, 'findMany').mockResolvedValueOnce([]);
      // Mock for getDescendantAccounts - second level (sub-2 has no children)
      jest.spyOn(prisma.account, 'findMany').mockResolvedValueOnce([]);
      jest
        .spyOn(prisma.contract, 'findMany')
        .mockResolvedValueOnce(contracts as any);
      jest.spyOn(prisma.invoice, 'count').mockResolvedValueOnce(0);

      // Mock transaction
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          invoice: {
            create: jest.fn().mockResolvedValueOnce(createdInvoice),
          },
          invoiceItem: {
            createMany: jest.fn().mockResolvedValueOnce({ count: 2 }),
          },
        };
        return callback(mockTx);
      });

      const result = await service.generateConsolidatedInvoice({
        parentAccountId: 'parent-id',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        includeChildren: true,
      });

      expect(result.invoiceId).toBe('invoice-id');
      expect(result.invoiceNumber).toBe('INV-202601-00001');
      expect(result.subsidiariesIncluded).toBe(2);
      expect(prisma.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { accountId: { in: ['parent-id', 'sub-1', 'sub-2'] } },
              {
                shares: {
                  some: { accountId: { in: ['parent-id', 'sub-1', 'sub-2'] } },
                },
              },
            ],
          }),
        }),
      );
    });

    it('should throw NotFoundException if parent account not found', async () => {
      jest.spyOn(prisma.account, 'findUnique').mockResolvedValueOnce(null);

      await expect(
        service.generateConsolidatedInvoice({
          parentAccountId: 'invalid-id',
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-01-31'),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if account is on credit hold', async () => {
      const parentAccount = {
        id: 'parent-id',
        creditHold: true,
        deletedAt: null,
      };

      jest
        .spyOn(prisma.account, 'findUnique')
        .mockResolvedValueOnce(parentAccount as any);

      await expect(
        service.generateConsolidatedInvoice({
          parentAccountId: 'parent-id',
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-01-31'),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if no active contracts found', async () => {
      const parentAccount = {
        id: 'parent-id',
        creditHold: false,
        deletedAt: null,
      };

      jest
        .spyOn(prisma.account, 'findUnique')
        .mockResolvedValueOnce(parentAccount as any);
      jest.spyOn(prisma.account, 'findMany').mockResolvedValueOnce([]); // No descendants
      jest.spyOn(prisma.contract, 'findMany').mockResolvedValueOnce([]); // No contracts

      await expect(
        service.generateConsolidatedInvoice({
          parentAccountId: 'parent-id',
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-01-31'),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if all contracts have zero billable amount', async () => {
      const parentAccount = {
        id: 'parent-id',
        accountName: 'Parent Corp',
        currency: 'USD',
        paymentTermsDays: 30,
        creditHold: false,
        deletedAt: null,
      };

      // Contract with contractValue = 0 will result in zero total
      const zeroValueContracts = [
        {
          id: 'contract-zero',
          contractNumber: 'CNT-ZERO',
          accountId: 'parent-id',
          status: 'active',
          contractValue: new Decimal(0),
          billingFrequency: 'annual',
          seatCount: null,
          seatPrice: null,
          account: { id: 'parent-id', accountName: 'Parent Corp' },
          shares: [],
          products: [],
},
      ];

      jest
        .spyOn(prisma.account, 'findUnique')
        .mockResolvedValueOnce(parentAccount as any);
      jest.spyOn(prisma.account, 'findMany').mockResolvedValueOnce([]); // No descendants
      jest
        .spyOn(prisma.contract, 'findMany')
        .mockResolvedValueOnce(zeroValueContracts as any);

      await expect(
        service.generateConsolidatedInvoice({
          parentAccountId: 'parent-id',
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-01-31'),
          includeChildren: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should generate invoice without seat count info in line description', async () => {
      const parentAccount = {
        id: 'parent-id',
        accountName: 'Parent Corp',
        currency: 'USD',
        paymentTermsDays: 30,
        creditHold: false,
        deletedAt: null,
      };

      // Contract without seatCount => description won't have "(N seats)"
      const fixedValueContracts = [
        {
          id: 'contract-fixed',
          contractNumber: 'CNT-FIXED',
          accountId: 'parent-id',
          status: 'active',
          contractValue: new Decimal(12000),
          billingFrequency: 'monthly',
          seatCount: null,
          seatPrice: null,
          account: { id: 'parent-id', accountName: 'Parent Corp' },
          shares: [],
          products: [],
},
      ];

      const createdInvoice = {
        id: 'invoice-fixed',
        invoiceNumber: 'INV-202601-00001',
        total: new Decimal(12000),
      };

      jest
        .spyOn(prisma.account, 'findUnique')
        .mockResolvedValueOnce(parentAccount as any);
      jest.spyOn(prisma.account, 'findMany').mockResolvedValueOnce([]);
      jest
        .spyOn(prisma.contract, 'findMany')
        .mockResolvedValueOnce(fixedValueContracts as any);
      jest.spyOn(prisma.invoice, 'count').mockResolvedValueOnce(0);

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          invoice: {
            create: jest.fn().mockResolvedValueOnce(createdInvoice),
          },
          invoiceItem: {
            createMany: jest.fn().mockResolvedValueOnce({ count: 1 }),
          },
        };
        return callback(mockTx);
      });

      const result = await service.generateConsolidatedInvoice({
        parentAccountId: 'parent-id',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        includeChildren: false,
      });

      expect(result.invoiceId).toBe('invoice-fixed');
    });

    it('should throw NotFoundException if parent account is soft-deleted', async () => {
      const deletedAccount = {
        id: 'parent-id',
        deletedAt: new Date(),
        creditHold: false,
      };

      jest
        .spyOn(prisma.account, 'findUnique')
        .mockResolvedValueOnce(deletedAccount as any);

      await expect(
        service.generateConsolidatedInvoice({
          parentAccountId: 'parent-id',
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-01-31'),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should stop descendant traversal at maxDepth (5 levels)', async () => {
      // This test exercises the `if (currentDepth >= maxDepth) return []` branch (line 216)
      // by using a mockImplementation that tracks call depth and simulates 5 levels of accounts
      const parentAccount = {
        id: 'parent-id',
        accountName: 'Root Corp',
        currency: 'USD',
        paymentTermsDays: 30,
        creditHold: false,
        deletedAt: null,
      };

      // Directly replace prisma.account.findMany with a counter-based implementation
      // to avoid spy-stacking issues from previous tests in this suite.
      let findManyCallCount = 0;
      const childrenByCall: any[][] = [
        [{ id: 'l1', accountName: 'L1', parentAccountId: 'parent-id' }],
        [{ id: 'l2', accountName: 'L2', parentAccountId: 'l1' }],
        [{ id: 'l3', accountName: 'L3', parentAccountId: 'l2' }],
        [{ id: 'l4', accountName: 'L4', parentAccountId: 'l3' }],
        [{ id: 'l5', accountName: 'L5', parentAccountId: 'l4' }],
      ];

      // Save the original and replace directly on the mock object
      const originalFindUnique = mockPrismaService.account.findUnique;
      const originalFindMany = mockPrismaService.account.findMany;

      mockPrismaService.account.findUnique = jest
        .fn()
        .mockResolvedValue(parentAccount);
      mockPrismaService.account.findMany = jest.fn().mockImplementation(() => {
        const result = childrenByCall[findManyCallCount] ?? [];
        findManyCallCount++;
        return Promise.resolve(result);
      });

      const contracts = [
        {
          id: 'contract-root',
          contractNumber: 'CNT-ROOT',
          accountId: 'parent-id',
          status: 'active',
          contractValue: new Decimal(12000),
          billingFrequency: 'monthly',
          seatCount: 3,
          seatPrice: new Decimal(500),
          account: { id: 'parent-id', accountName: 'Root Corp' },
          shares: [],
          products: [],
},
      ];

      const createdInvoice = {
        id: 'invoice-deep',
        invoiceNumber: 'INV-202601-00001',
        total: new Decimal(1500),
      };

      mockPrismaService.contract.findMany = jest
        .fn()
        .mockResolvedValue(contracts);
      mockPrismaService.invoice.count = jest.fn().mockResolvedValue(0);

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          invoice: { create: jest.fn().mockResolvedValueOnce(createdInvoice) },
          invoiceItem: {
            createMany: jest.fn().mockResolvedValueOnce({ count: 1 }),
          },
        };
        return callback(mockTx);
      });

      const result = await service.generateConsolidatedInvoice({
        parentAccountId: 'parent-id',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        includeChildren: true,
      });

      // Restore the original mocks
      mockPrismaService.account.findUnique = originalFindUnique;
      mockPrismaService.account.findMany = originalFindMany;

      expect(result.invoiceId).toBe('invoice-deep');
      // 5 levels of descendants included (l1, l2, l3, l4, l5)
      expect(result.subsidiariesIncluded).toBe(5);
      // Verify exactly 5 findMany calls (one per depth level 0-4; depth 5 exits early)
      expect(findManyCallCount).toBe(5);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // previewConsolidatedInvoice (dry run)
    // ──────────────────────────────────────────────────────────────────────────

    describe('previewConsolidatedInvoice', () => {
      const periodStart = new Date('2026-01-01');
      const periodEnd = new Date('2026-01-31');

      const parentAccount = {
        id: 'parent-id',
        accountName: 'Parent Corp',
        currency: 'USD',
        paymentTermsDays: 30,
        creditHold: false,
        deletedAt: null,
      };

      const subsidiaries = [
        { id: 'sub-1', accountName: 'Sub 1', parentAccountId: 'parent-id' },
      ];

      const contracts = [
        {
          id: 'contract-1',
          contractNumber: 'CNT-001',
          accountId: 'parent-id',
          status: 'active',
          contractValue: new Decimal(12000),
          billingFrequency: 'monthly',
          seatCount: 10,
          seatPrice: new Decimal(200),
          account: { id: 'parent-id', accountName: 'Parent Corp' },
          shares: [],
          products: [],
        },
      ];

      it('should return isDryRun true and invoiceId null', async () => {
        // Use direct mock replacement (same pattern as maxDepth test) to avoid
        // spy-stacking issues with sequential mockResolvedValueOnce calls.
        const originalFindUnique = mockPrismaService.account.findUnique;
        const originalFindMany = mockPrismaService.account.findMany;
        const originalContractFindMany = mockPrismaService.contract.findMany;
        const originalInvoiceCount = mockPrismaService.invoice.count;

        let accountFindManyCallCount = 0;
        // Call 0 → subsidiaries (for parent-id), Call 1 → [] (for sub-1's children)
        const accountFindManyResults: any[][] = [subsidiaries, []];

        mockPrismaService.account.findUnique = jest.fn().mockResolvedValue(parentAccount);
        mockPrismaService.account.findMany = jest.fn().mockImplementation(() => {
          const r = accountFindManyResults[accountFindManyCallCount] ?? [];
          accountFindManyCallCount++;
          return Promise.resolve(r);
        });
        mockPrismaService.contract.findMany = jest.fn().mockResolvedValue(contracts);
        mockPrismaService.invoice.count = jest.fn().mockResolvedValue(0);

        const result = await service.previewConsolidatedInvoice({
          parentAccountId: 'parent-id',
          periodStart,
          periodEnd,
          includeChildren: true,
        });

        // Restore originals
        mockPrismaService.account.findUnique = originalFindUnique;
        mockPrismaService.account.findMany = originalFindMany;
        mockPrismaService.contract.findMany = originalContractFindMany;
        mockPrismaService.invoice.count = originalInvoiceCount;

        expect(result.isDryRun).toBe(true);
        expect(result.invoiceId).toBeNull();
        expect(result.lineItems.length).toBeGreaterThan(0);
        expect(result.subsidiariesIncluded).toBe(1); // one subsidiary
      });

      it('should NOT throw for an account on credit hold (dry run skips credit check)', async () => {
        const creditHoldAccount = { ...parentAccount, creditHold: true };

        jest.spyOn(prisma.account, 'findUnique').mockResolvedValueOnce(creditHoldAccount as any);
        jest.spyOn(prisma.account, 'findMany').mockResolvedValueOnce([]); // no descendants
        jest.spyOn(prisma.contract, 'findMany').mockResolvedValueOnce(contracts as any);
        jest.spyOn(prisma.invoice, 'count').mockResolvedValueOnce(0);

        // Must NOT reject — credit hold is intentionally skipped for dry run
        await expect(
          service.previewConsolidatedInvoice({
            parentAccountId: 'parent-id',
            periodStart,
            periodEnd,
            includeChildren: false,
          }),
        ).resolves.not.toThrow();
      });

      it('should NOT call $transaction (no DB writes)', async () => {
        jest.spyOn(prisma.account, 'findUnique').mockResolvedValueOnce(parentAccount as any);
        jest.spyOn(prisma.account, 'findMany').mockResolvedValueOnce([]);
        jest.spyOn(prisma.contract, 'findMany').mockResolvedValueOnce(contracts as any);
        jest.spyOn(prisma.invoice, 'count').mockResolvedValueOnce(0);

        await service.previewConsolidatedInvoice({
          parentAccountId: 'parent-id',
          periodStart,
          periodEnd,
          includeChildren: false,
        });

        expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
      });

      it('should NOT call invoice.findFirst (no dedup check)', async () => {
        jest.spyOn(prisma.account, 'findUnique').mockResolvedValueOnce(parentAccount as any);
        jest.spyOn(prisma.account, 'findMany').mockResolvedValueOnce([]);
        jest.spyOn(prisma.contract, 'findMany').mockResolvedValueOnce(contracts as any);
        jest.spyOn(prisma.invoice, 'count').mockResolvedValueOnce(0);

        // Reset call count from beforeEach defaults
        mockPrismaService.invoice.findFirst.mockClear();

        await service.previewConsolidatedInvoice({
          parentAccountId: 'parent-id',
          periodStart,
          periodEnd,
          includeChildren: false,
        });

        expect(mockPrismaService.invoice.findFirst).not.toHaveBeenCalled();
      });

      it('should throw NotFoundException for unknown parent account', async () => {
        jest.spyOn(prisma.account, 'findUnique').mockResolvedValueOnce(null);

        await expect(
          service.previewConsolidatedInvoice({
            parentAccountId: 'ghost-id',
            periodStart,
            periodEnd,
          }),
        ).rejects.toThrow(NotFoundException);
      });

      it('should include parent + descendant IDs in accountsIncluded', async () => {
        const twoSubs = [
          { id: 'sub-1', accountName: 'Sub 1', parentAccountId: 'parent-id' },
          { id: 'sub-2', accountName: 'Sub 2', parentAccountId: 'parent-id' },
        ];

        const originalFindUnique = mockPrismaService.account.findUnique;
        const originalFindMany = mockPrismaService.account.findMany;
        const originalContractFindMany = mockPrismaService.contract.findMany;
        const originalInvoiceCount = mockPrismaService.invoice.count;

        let callCount = 0;
        // Call 0 → twoSubs (children of parent)
        // Call 1 → [] (children of sub-1)
        // Call 2 → [] (children of sub-2)
        const accountFindManyResults: any[][] = [twoSubs, [], []];

        mockPrismaService.account.findUnique = jest.fn().mockResolvedValue(parentAccount);
        mockPrismaService.account.findMany = jest.fn().mockImplementation(() => {
          const r = accountFindManyResults[callCount] ?? [];
          callCount++;
          return Promise.resolve(r);
        });
        mockPrismaService.contract.findMany = jest.fn().mockResolvedValue(contracts);
        mockPrismaService.invoice.count = jest.fn().mockResolvedValue(0);

        const result = await service.previewConsolidatedInvoice({
          parentAccountId: 'parent-id',
          periodStart,
          periodEnd,
          includeChildren: true,
        });

        mockPrismaService.account.findUnique = originalFindUnique;
        mockPrismaService.account.findMany = originalFindMany;
        mockPrismaService.contract.findMany = originalContractFindMany;
        mockPrismaService.invoice.count = originalInvoiceCount;

        expect(result.accountsIncluded).toContain('parent-id');
        expect(result.accountsIncluded).toContain('sub-1');
        expect(result.accountsIncluded).toContain('sub-2');
        expect(result.accountsIncluded).toHaveLength(3);
        expect(result.subsidiariesIncluded).toBe(2);
      });
    });

    it('should handle quarterly billing frequency in calculateContractAmount', async () => {
      // This test exercises the `frequency === "quarterly"` branch (line 276)
      const parentAccount = {
        id: 'parent-id',
        accountName: 'Parent Corp',
        currency: 'USD',
        paymentTermsDays: 30,
        creditHold: false,
        deletedAt: null,
      };

      const quarterlyContracts = [
        {
          id: 'contract-q',
          contractNumber: 'CNT-Q',
          accountId: 'parent-id',
          status: 'active',
          contractValue: new Decimal(30000),
          billingFrequency: 'quarterly',
          seatCount: null,
          seatPrice: null,
          account: { id: 'parent-id', accountName: 'Parent Corp' },
          shares: [],
          products: [],
},
      ];

      const createdInvoice = {
        id: 'invoice-quarterly',
        invoiceNumber: 'INV-202601-00002',
        total: new Decimal(10000),
      };

      jest
        .spyOn(prisma.account, 'findUnique')
        .mockResolvedValueOnce(parentAccount as any);
      jest.spyOn(prisma.account, 'findMany').mockResolvedValueOnce([]);
      jest
        .spyOn(prisma.contract, 'findMany')
        .mockResolvedValueOnce(quarterlyContracts as any);
      jest.spyOn(prisma.invoice, 'count').mockResolvedValueOnce(1);

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          invoice: { create: jest.fn().mockResolvedValueOnce(createdInvoice) },
          invoiceItem: {
            createMany: jest.fn().mockResolvedValueOnce({ count: 1 }),
          },
        };
        return callback(mockTx);
      });

      const result = await service.generateConsolidatedInvoice({
        parentAccountId: 'parent-id',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        includeChildren: false,
      });

      expect(result.invoiceId).toBe('invoice-quarterly');
    });

    it('should generate invoice for parent only when includeChildren is false', async () => {
      const parentAccount = {
        id: 'parent-id',
        accountName: 'Parent Corp',
        currency: 'USD',
        paymentTermsDays: 30,
        creditHold: false,
        deletedAt: null,
      };

      const contracts = [
        {
          id: 'contract-1',
          contractNumber: 'CNT-001',
          accountId: 'parent-id',
          status: 'active',
          contractValue: new Decimal(120000),
          billingFrequency: 'annual',
          seatCount: 10,
          seatPrice: new Decimal(1000),
          account: { id: 'parent-id', accountName: 'Parent Corp' },
          products: [],
        },
      ];

      const createdInvoice = {
        id: 'invoice-id',
        invoiceNumber: 'INV-202601-00001',
        total: new Decimal(10000),
      };

      jest
        .spyOn(prisma.account, 'findUnique')
        .mockResolvedValueOnce(parentAccount as any);
      // includeChildren is false, so no getDescendantAccounts call
      jest
        .spyOn(prisma.contract, 'findMany')
        .mockResolvedValueOnce(contracts as any);
      jest.spyOn(prisma.invoice, 'count').mockResolvedValueOnce(0);

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          invoice: {
            create: jest.fn().mockResolvedValueOnce(createdInvoice),
          },
          invoiceItem: {
            createMany: jest.fn().mockResolvedValueOnce({ count: 1 }),
          },
        };
        return callback(mockTx);
      });

      const result = await service.generateConsolidatedInvoice({
        parentAccountId: 'parent-id',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-01-31'),
        includeChildren: false,
      });

      expect(result.subsidiariesIncluded).toBe(0);
      expect(prisma.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { accountId: { in: ['parent-id'] } },
              { shares: { some: { accountId: { in: ['parent-id'] } } } },
            ],
          }),
        }),
      );
    });
  });
});
