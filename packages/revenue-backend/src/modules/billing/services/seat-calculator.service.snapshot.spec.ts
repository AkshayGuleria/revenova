/**
 * Snapshot tests for SeatCalculatorService.
 *
 * WHY snapshots here: financial calculations must produce byte-exact outputs.
 * Any change to pricing formulas (rounding, tier logic, proration) triggers a
 * visible diff — reviewer must explicitly accept it rather than silently passing.
 * These complement the behavioral specs; they lock in the full output shape.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { SeatCalculatorService } from './seat-calculator.service';
import { Decimal } from '@prisma/client/runtime/library';

const ENTERPRISE_TIERS = [
  { minSeats: 1, maxSeats: 10, pricePerSeat: 100 },
  { minSeats: 11, maxSeats: 50, pricePerSeat: 90 },
  { minSeats: 51, maxSeats: 200, pricePerSeat: 80 },
  { minSeats: 201, maxSeats: null, pricePerSeat: 70 },
];

/** Serialize SeatPricingResult to plain strings for stable snapshots. */
function serializeSeatResult(result: ReturnType<SeatCalculatorService['calculateSeatPricing']>) {
  return {
    seatCount: result.seatCount,
    pricePerSeat: result.pricePerSeat.toString(),
    subtotal: result.subtotal.toString(),
    appliedTier: result.appliedTier ?? null,
  };
}

describe('SeatCalculatorService — snapshots', () => {
  let service: SeatCalculatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SeatCalculatorService],
    }).compile();
    service = module.get<SeatCalculatorService>(SeatCalculatorService);
  });

  // ─── calculateSeatPricing ────────────────────────────────────────────────

  describe('calculateSeatPricing', () => {
    it('flat pricing — 50 seats at $120/seat', () => {
      const result = service.calculateSeatPricing(50, new Decimal('120.00'));
      expect(serializeSeatResult(result)).toMatchSnapshot();
    });

    it('flat pricing — 1 seat at $99.99/seat (decimal base price)', () => {
      const result = service.calculateSeatPricing(1, new Decimal('99.99'));
      expect(serializeSeatResult(result)).toMatchSnapshot();
    });

    it('volume tier — 1 seat (tier 1 lower bound)', () => {
      const result = service.calculateSeatPricing(1, new Decimal('100'), ENTERPRISE_TIERS);
      expect(serializeSeatResult(result)).toMatchSnapshot();
    });

    it('volume tier — 10 seats (tier 1 upper bound)', () => {
      const result = service.calculateSeatPricing(10, new Decimal('100'), ENTERPRISE_TIERS);
      expect(serializeSeatResult(result)).toMatchSnapshot();
    });

    it('volume tier — 11 seats (tier 2 lower bound)', () => {
      const result = service.calculateSeatPricing(11, new Decimal('100'), ENTERPRISE_TIERS);
      expect(serializeSeatResult(result)).toMatchSnapshot();
    });

    it('volume tier — 50 seats (tier 2 upper bound)', () => {
      const result = service.calculateSeatPricing(50, new Decimal('100'), ENTERPRISE_TIERS);
      expect(serializeSeatResult(result)).toMatchSnapshot();
    });

    it('volume tier — 51 seats (tier 3 lower bound)', () => {
      const result = service.calculateSeatPricing(51, new Decimal('100'), ENTERPRISE_TIERS);
      expect(serializeSeatResult(result)).toMatchSnapshot();
    });

    it('volume tier — 200 seats (tier 3 upper bound)', () => {
      const result = service.calculateSeatPricing(200, new Decimal('100'), ENTERPRISE_TIERS);
      expect(serializeSeatResult(result)).toMatchSnapshot();
    });

    it('volume tier — 201 seats (unlimited tier lower bound)', () => {
      const result = service.calculateSeatPricing(201, new Decimal('100'), ENTERPRISE_TIERS);
      expect(serializeSeatResult(result)).toMatchSnapshot();
    });

    it('volume tier — 500 seats (deep in unlimited tier)', () => {
      const result = service.calculateSeatPricing(500, new Decimal('100'), ENTERPRISE_TIERS);
      expect(serializeSeatResult(result)).toMatchSnapshot();
    });

    it('no tier match — falls back to base price', () => {
      // Gap in tiers: 5 seats with tiers starting at 10
      const gappedTiers = [
        { minSeats: 10, maxSeats: 50, pricePerSeat: 90 },
        { minSeats: 51, maxSeats: null, pricePerSeat: 80 },
      ];
      const result = service.calculateSeatPricing(5, new Decimal('100'), gappedTiers);
      expect(serializeSeatResult(result)).toMatchSnapshot();
    });

    it('decimal seat price with volume discount — precise Decimal arithmetic', () => {
      const tiers = [
        { minSeats: 1, maxSeats: 100, pricePerSeat: 49.99 },
        { minSeats: 101, maxSeats: null, pricePerSeat: 39.99 },
      ];
      const result = service.calculateSeatPricing(75, new Decimal('50.00'), tiers);
      expect(serializeSeatResult(result)).toMatchSnapshot();
    });
  });

  // ─── calculateProration ──────────────────────────────────────────────────

  describe('calculateProration', () => {
    it('full year proration (365/365)', () => {
      const result = service.calculateProration(new Decimal('12000.00'), 365, 365);
      expect(result.toString()).toMatchSnapshot();
    });

    it('mid-year join — 182 of 365 days', () => {
      const result = service.calculateProration(new Decimal('12000.00'), 365, 182);
      expect(result.toString()).toMatchSnapshot();
    });

    it('monthly proration — 15 of 31 days', () => {
      const result = service.calculateProration(new Decimal('1000.00'), 31, 15);
      expect(result.toString()).toMatchSnapshot();
    });

    it('quarterly proration — 45 of 91 days', () => {
      const result = service.calculateProration(new Decimal('3000.00'), 91, 45);
      expect(result.toString()).toMatchSnapshot();
    });

    it('single day of monthly period', () => {
      const result = service.calculateProration(new Decimal('600.00'), 30, 1);
      expect(result.toString()).toMatchSnapshot();
    });

    it('precise decimal amount — 99.99 for 15 of 30 days', () => {
      const result = service.calculateProration(new Decimal('99.99'), 30, 15);
      expect(result.toString()).toMatchSnapshot();
    });

    it('zero total days returns 0', () => {
      const result = service.calculateProration(new Decimal('1200.00'), 0, 30);
      expect(result.toString()).toMatchSnapshot();
    });
  });
});
