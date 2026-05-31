/**
 * Snapshot tests for BillingEngineService pure calculation methods.
 *
 * WHY snapshots here: billing line items, totals, and charge-type logic are
 * financial outputs — exact values matter. A rounding change, discount formula
 * tweak, or billing-period boundary shift must produce a visible diff that a
 * reviewer explicitly accepts. These tests complement the behavioral specs by
 * locking the full output shape.
 *
 * Scope: computeLineItems, shouldBillProduct, getSetupFee, isFirstBillingPeriod.
 * (generateInvoiceFromContract and previewInvoice are covered by E2E tests.)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BillingEngineService } from './billing-engine.service';
import { SeatCalculatorService } from './seat-calculator.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

/** Serialize line items for stable snapshots (Decimal → string). */
function serializeLineItems(
  items: Array<{
    description: string;
    quantity: Decimal;
    unitPrice: Decimal;
    amount: Decimal;
  }>,
) {
  return items.map((item) => ({
    description: item.description,
    quantity: item.quantity.toString(),
    unitPrice: item.unitPrice.toString(),
    amount: item.amount.toString(),
  }));
}

/** Serialize computeLineItems result for stable snapshots. */
async function serializeAmounts(
  result: Awaited<ReturnType<BillingEngineService['computeLineItems']>>,
) {
  return {
    lineItems: serializeLineItems(result.lineItems),
    subtotal: result.subtotal.toString(),
    tax: result.tax.toString(),
    discount: result.discount.toString(),
    total: result.total.toString(),
  };
}

// ─── Shared contract fixtures ─────────────────────────────────────────────

const BASE_DATE = new Date('2024-01-01T00:00:00.000Z');

function makeContractBase(overrides: Partial<any> = {}): any {
  return {
    id: 'contract-1',
    accountId: 'account-1',
    startDate: BASE_DATE,
    billingFrequency: 'monthly',
    contractValue: new Decimal('12000.00'),
    seatCount: null,
    seatPrice: null,
    products: [],
    account: { paymentTermsDays: 30, currency: 'USD' },
    ...overrides,
  };
}

describe('BillingEngineService — snapshots', () => {
  let service: BillingEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingEngineService,
        SeatCalculatorService,
        {
          provide: PrismaService,
          useValue: {
            invoice: { count: jest.fn().mockResolvedValue(0) },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BillingEngineService>(BillingEngineService);
  });

  // ─── computeLineItems ──────────────────────────────────────────────────

  describe('computeLineItems', () => {
    describe('product-based billing', () => {
      it('single product — full price, no discount', async () => {
        const contract = makeContractBase({
          products: [
            {
              quantity: 5,
              unitPrice: new Decimal('200.00'),
              discount: null,
              product: {
                name: 'Enterprise License',
                basePrice: new Decimal('200.00'),
              },
            },
          ],
        });

        const result = await service.computeLineItems(
          contract,
          null,
          BASE_DATE,
        );
        expect(await serializeAmounts(result)).toMatchSnapshot();
      });

      it('single product — uses product basePrice when unitPrice is null', async () => {
        const contract = makeContractBase({
          products: [
            {
              quantity: 10,
              unitPrice: null,
              discount: null,
              product: { name: 'Basic Seat', basePrice: new Decimal('50.00') },
            },
          ],
        });

        const result = await service.computeLineItems(
          contract,
          null,
          BASE_DATE,
        );
        expect(await serializeAmounts(result)).toMatchSnapshot();
      });

      it('single product — 20% discount applied', async () => {
        const contract = makeContractBase({
          products: [
            {
              quantity: 10,
              unitPrice: new Decimal('100.00'),
              discount: new Decimal('0.20'),
              product: { name: 'Pro Seat', basePrice: new Decimal('100.00') },
            },
          ],
        });

        const result = await service.computeLineItems(
          contract,
          null,
          BASE_DATE,
        );
        expect(await serializeAmounts(result)).toMatchSnapshot();
      });

      it('multiple products — mixed discounts', async () => {
        const contract = makeContractBase({
          products: [
            {
              quantity: 50,
              unitPrice: new Decimal('80.00'),
              discount: new Decimal('0.10'),
              product: { name: 'Core Seats', basePrice: new Decimal('80.00') },
            },
            {
              quantity: 1,
              unitPrice: new Decimal('5000.00'),
              discount: null,
              product: {
                name: 'Platform Fee',
                basePrice: new Decimal('5000.00'),
              },
            },
            {
              quantity: 5,
              unitPrice: new Decimal('200.00'),
              discount: new Decimal('0.15'),
              product: {
                name: 'Admin Add-on',
                basePrice: new Decimal('200.00'),
              },
            },
          ],
        });

        const result = await service.computeLineItems(
          contract,
          null,
          BASE_DATE,
        );
        expect(await serializeAmounts(result)).toMatchSnapshot();
      });

      it('multiple products — full 100% discount on one item', async () => {
        const contract = makeContractBase({
          products: [
            {
              quantity: 10,
              unitPrice: new Decimal('100.00'),
              discount: new Decimal('1.00'),
              product: {
                name: 'Waived Seat',
                basePrice: new Decimal('100.00'),
              },
            },
            {
              quantity: 1,
              unitPrice: new Decimal('500.00'),
              discount: null,
              product: {
                name: 'Support Package',
                basePrice: new Decimal('500.00'),
              },
            },
          ],
        });

        const result = await service.computeLineItems(
          contract,
          null,
          BASE_DATE,
        );
        expect(await serializeAmounts(result)).toMatchSnapshot();
      });
    });

    describe('seat-based billing (no products)', () => {
      it('monthly — 25 seats at $100/seat', async () => {
        const contract = makeContractBase({
          billingFrequency: 'monthly',
          seatCount: 25,
          seatPrice: new Decimal('100.00'),
        });

        const result = await service.computeLineItems(
          contract,
          null,
          BASE_DATE,
        );
        expect(await serializeAmounts(result)).toMatchSnapshot();
      });

      it('quarterly — 100 seats at $90/seat', async () => {
        const contract = makeContractBase({
          billingFrequency: 'quarterly',
          seatCount: 100,
          seatPrice: new Decimal('90.00'),
        });

        const result = await service.computeLineItems(
          contract,
          null,
          BASE_DATE,
        );
        expect(await serializeAmounts(result)).toMatchSnapshot();
      });

      it('annual — 500 seats at $80/seat', async () => {
        const contract = makeContractBase({
          billingFrequency: 'annual',
          seatCount: 500,
          seatPrice: new Decimal('80.00'),
        });

        const result = await service.computeLineItems(
          contract,
          null,
          BASE_DATE,
        );
        expect(await serializeAmounts(result)).toMatchSnapshot();
      });
    });

    describe('contract value fallback billing (no products, no seats)', () => {
      it('monthly — $12,000 annual value → $1,000/month', async () => {
        const contract = makeContractBase({
          billingFrequency: 'monthly',
          contractValue: new Decimal('12000.00'),
        });

        const result = await service.computeLineItems(
          contract,
          null,
          BASE_DATE,
        );
        expect(await serializeAmounts(result)).toMatchSnapshot();
      });

      it('quarterly — $12,000 annual value → $3,000/quarter', async () => {
        const contract = makeContractBase({
          billingFrequency: 'quarterly',
          contractValue: new Decimal('12000.00'),
        });

        const result = await service.computeLineItems(
          contract,
          null,
          BASE_DATE,
        );
        expect(await serializeAmounts(result)).toMatchSnapshot();
      });

      it('annual — $120,000 billed as full annual', async () => {
        const contract = makeContractBase({
          billingFrequency: 'annual',
          contractValue: new Decimal('120000.00'),
        });

        const result = await service.computeLineItems(
          contract,
          null,
          BASE_DATE,
        );
        expect(await serializeAmounts(result)).toMatchSnapshot();
      });

      it('unknown frequency — falls back to monthly (÷12)', async () => {
        const contract = makeContractBase({
          billingFrequency: 'semi_annual',
          contractValue: new Decimal('12000.00'),
        });

        const result = await service.computeLineItems(
          contract,
          null,
          BASE_DATE,
        );
        expect(await serializeAmounts(result)).toMatchSnapshot();
      });
    });

    describe('setup fee line item', () => {
      it('setup fee added on first billing period', async () => {
        const product = {
          chargeType: 'recurring',
          setupFee: new Decimal('500.00'),
          trialPeriodDays: null,
        };
        const contract = makeContractBase({
          billingFrequency: 'monthly',
          contractValue: new Decimal('12000.00'),
          startDate: BASE_DATE,
        });

        // periodStart is same month as contract start → first period
        const result = await service.computeLineItems(
          contract,
          product,
          BASE_DATE,
        );
        expect(await serializeAmounts(result)).toMatchSnapshot();
      });

      it('setup fee NOT added on subsequent billing period', async () => {
        const product = {
          chargeType: 'recurring',
          setupFee: new Decimal('500.00'),
          trialPeriodDays: null,
        };
        const contract = makeContractBase({
          billingFrequency: 'monthly',
          contractValue: new Decimal('12000.00'),
          startDate: BASE_DATE,
        });

        // periodStart is next month → not first period
        const nextMonth = new Date('2024-02-01T00:00:00.000Z');
        const result = await service.computeLineItems(
          contract,
          product,
          nextMonth,
        );
        expect(await serializeAmounts(result)).toMatchSnapshot();
      });
    });
  });

  // ─── shouldBillProduct ────────────────────────────────────────────────

  describe('shouldBillProduct', () => {
    it('null product → always bill (backward compat)', () => {
      expect(
        service.shouldBillProduct(null, BASE_DATE, BASE_DATE),
      ).toMatchSnapshot();
    });

    it('recurring product → always bill', () => {
      const product = {
        chargeType: 'recurring',
        setupFee: null,
        trialPeriodDays: null,
      };
      expect(
        service.shouldBillProduct(product, BASE_DATE, BASE_DATE),
      ).toMatchSnapshot();
    });

    it('usage_based product → never bill (Phase 6)', () => {
      const product = {
        chargeType: 'usage_based',
        setupFee: null,
        trialPeriodDays: null,
      };
      expect(
        service.shouldBillProduct(product, BASE_DATE, BASE_DATE),
      ).toMatchSnapshot();
    });

    it('one_time product → bill on first period only', () => {
      const product = {
        chargeType: 'one_time',
        setupFee: null,
        trialPeriodDays: null,
      };
      const firstPeriod = new Date('2024-01-15T00:00:00.000Z');
      const secondPeriod = new Date('2024-02-01T00:00:00.000Z');

      expect({
        firstPeriod: service.shouldBillProduct(product, BASE_DATE, firstPeriod),
        secondPeriod: service.shouldBillProduct(
          product,
          BASE_DATE,
          secondPeriod,
        ),
      }).toMatchSnapshot();
    });

    it('trial period active → skip billing', () => {
      const product = {
        chargeType: 'recurring',
        setupFee: null,
        trialPeriodDays: 30,
      };
      const duringTrial = new Date('2024-01-15T00:00:00.000Z'); // 14 days in
      const afterTrial = new Date('2024-02-05T00:00:00.000Z'); // 35 days in

      expect({
        duringTrial: service.shouldBillProduct(product, BASE_DATE, duringTrial),
        afterTrial: service.shouldBillProduct(product, BASE_DATE, afterTrial),
      }).toMatchSnapshot();
    });

    it('trial period exact boundary (last trial day vs first post-trial day)', () => {
      const product = {
        chargeType: 'recurring',
        setupFee: null,
        trialPeriodDays: 14,
      };
      const lastTrialDay = new Date('2024-01-14T00:00:00.000Z'); // day 13 (0-indexed start)
      const firstBillDay = new Date('2024-01-15T00:00:00.000Z'); // day 14 — trial ends

      expect({
        lastTrialDay: service.shouldBillProduct(
          product,
          BASE_DATE,
          lastTrialDay,
        ),
        firstBillDay: service.shouldBillProduct(
          product,
          BASE_DATE,
          firstBillDay,
        ),
      }).toMatchSnapshot();
    });
  });

  // ─── getSetupFee ──────────────────────────────────────────────────────

  describe('getSetupFee', () => {
    it('no product → $0 setup fee', () => {
      const result = service.getSetupFee(null, BASE_DATE, BASE_DATE);
      expect(result.toString()).toMatchSnapshot();
    });

    it('product with no setupFee → $0', () => {
      const product = {
        chargeType: 'recurring',
        setupFee: null,
        trialPeriodDays: null,
      };
      const result = service.getSetupFee(product, BASE_DATE, BASE_DATE);
      expect(result.toString()).toMatchSnapshot();
    });

    it('product with $2500 setup fee — first period', () => {
      const product = {
        chargeType: 'recurring',
        setupFee: new Decimal('2500.00'),
        trialPeriodDays: null,
      };
      const result = service.getSetupFee(product, BASE_DATE, BASE_DATE);
      expect(result.toString()).toMatchSnapshot();
    });

    it('product with $2500 setup fee — subsequent period → $0', () => {
      const product = {
        chargeType: 'recurring',
        setupFee: new Decimal('2500.00'),
        trialPeriodDays: null,
      };
      const nextMonth = new Date('2024-02-01T00:00:00.000Z');
      const result = service.getSetupFee(product, BASE_DATE, nextMonth);
      expect(result.toString()).toMatchSnapshot();
    });
  });

  // ─── isFirstBillingPeriod ─────────────────────────────────────────────

  describe('isFirstBillingPeriod', () => {
    it('same year, same month → true', () => {
      const start = new Date('2024-01-01T00:00:00.000Z');
      const period = new Date('2024-01-31T00:00:00.000Z');
      expect(service.isFirstBillingPeriod(start, period)).toMatchSnapshot();
    });

    it('same year, next month → false', () => {
      const start = new Date('2024-01-01T00:00:00.000Z');
      const period = new Date('2024-02-01T00:00:00.000Z');
      expect(service.isFirstBillingPeriod(start, period)).toMatchSnapshot();
    });

    it('different year, same month → false', () => {
      const start = new Date('2024-01-01T00:00:00.000Z');
      const period = new Date('2025-01-01T00:00:00.000Z');
      expect(service.isFirstBillingPeriod(start, period)).toMatchSnapshot();
    });

    it('year-end rollover (Dec → Jan)', () => {
      const start = new Date('2024-12-01T00:00:00.000Z');
      const period = new Date('2025-01-01T00:00:00.000Z');
      expect(service.isFirstBillingPeriod(start, period)).toMatchSnapshot();
    });
  });
});
