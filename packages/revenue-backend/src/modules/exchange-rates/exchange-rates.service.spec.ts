import { Test, TestingModule } from '@nestjs/testing';
import { ExchangeRatesService } from './exchange-rates.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockPrismaService = {
  exchangeRate: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};

describe('ExchangeRatesService', () => {
  let service: ExchangeRatesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExchangeRatesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ExchangeRatesService>(ExchangeRatesService);
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // upsert
  // ---------------------------------------------------------------------------
  describe('upsert', () => {
    it('should create a new exchange rate and return it', async () => {
      const createdRate = {
        id: 'er-1',
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        rate: 0.921543,
        effectiveDate: new Date('2026-05-31'),
        source: 'manual',
      };
      mockPrismaService.exchangeRate.upsert.mockResolvedValue(createdRate);

      const result = await service.upsert({
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        rate: 0.921543,
        effectiveDate: '2026-05-31',
      });

      expect(result.data).toMatchObject({
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        rate: 0.921543,
      });
      expect(result.paging.offset).toBeNull();
    });

    it('should normalise currency codes to uppercase before upsert', async () => {
      mockPrismaService.exchangeRate.upsert.mockResolvedValue({
        id: 'er-2',
        fromCurrency: 'GBP',
        toCurrency: 'USD',
        rate: 1.27,
        effectiveDate: new Date('2026-05-31'),
        source: 'ecb',
      });

      await service.upsert({
        fromCurrency: 'GBP',
        toCurrency: 'USD',
        rate: 1.27,
        effectiveDate: '2026-05-31',
        source: 'ecb',
      });

      expect(mockPrismaService.exchangeRate.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fromCurrency_toCurrency_effectiveDate: expect.objectContaining({
              fromCurrency: 'GBP',
              toCurrency: 'USD',
            }),
          }),
        }),
      );
    });

    it('should default source to "manual" when not provided', async () => {
      mockPrismaService.exchangeRate.upsert.mockResolvedValue({
        id: 'er-3',
        source: 'manual',
      });

      await service.upsert({
        fromCurrency: 'USD',
        toCurrency: 'JPY',
        rate: 155.0,
        effectiveDate: '2026-05-31',
      });

      expect(mockPrismaService.exchangeRate.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ source: 'manual' }),
          update: expect.objectContaining({ source: 'manual' }),
        }),
      );
    });

    it('should throw BadRequestException when fromCurrency === toCurrency', async () => {
      await expect(
        service.upsert({
          fromCurrency: 'USD',
          toCurrency: 'USD',
          rate: 1,
          effectiveDate: '2026-05-31',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.exchangeRate.upsert).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------
  describe('findAll', () => {
    it('should return paginated exchange rates with paging metadata', async () => {
      mockPrismaService.exchangeRate.findMany.mockResolvedValue([
        { id: 'er-1', fromCurrency: 'USD', toCurrency: 'EUR', rate: 0.92 },
      ]);
      mockPrismaService.exchangeRate.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.paging.total).toBe(1);
      expect(result.paging.offset).toBe(0);
      expect(result.paging.limit).toBe(20);
    });

    it('should apply pagination params from query', async () => {
      mockPrismaService.exchangeRate.findMany.mockResolvedValue([]);
      mockPrismaService.exchangeRate.count.mockResolvedValue(0);

      await service.findAll({ 'offset[eq]': 40, 'limit[eq]': 10 } as any);

      expect(mockPrismaService.exchangeRate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 10 }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------
  describe('findOne', () => {
    it('should return a single exchange rate by id', async () => {
      const rate = {
        id: 'er-1',
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        rate: 0.92,
      };
      mockPrismaService.exchangeRate.findUnique.mockResolvedValue(rate);

      const result = await service.findOne('er-1');

      expect(result.data).toMatchObject({ id: 'er-1' });
      expect(result.paging.total).toBeNull();
    });

    it('should throw NotFoundException for an unknown id', async () => {
      mockPrismaService.exchangeRate.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  describe('update', () => {
    it('should update the rate of an existing record', async () => {
      const existing = {
        id: 'er-1',
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        rate: 0.92,
      };
      const updated = { ...existing, rate: 0.935 };
      mockPrismaService.exchangeRate.findUnique.mockResolvedValue(existing);
      mockPrismaService.exchangeRate.update.mockResolvedValue(updated);

      const result = await service.update('er-1', { rate: 0.935 });

      expect(result.data).toMatchObject({ rate: 0.935 });
      expect(mockPrismaService.exchangeRate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'er-1' },
          data: { rate: 0.935 },
        }),
      );
    });

    it('should throw NotFoundException when record does not exist', async () => {
      mockPrismaService.exchangeRate.findUnique.mockResolvedValue(null);

      await expect(service.update('bad-id', { rate: 1.0 })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.exchangeRate.update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------
  describe('remove', () => {
    it('should delete an existing exchange rate and return confirmation', async () => {
      mockPrismaService.exchangeRate.findUnique.mockResolvedValue({
        id: 'er-1',
      });
      mockPrismaService.exchangeRate.delete.mockResolvedValue({ id: 'er-1' });

      const result = await service.remove('er-1');

      expect(result.data).toMatchObject({ deleted: true, id: 'er-1' });
      expect(mockPrismaService.exchangeRate.delete).toHaveBeenCalledWith({
        where: { id: 'er-1' },
      });
    });

    it('should throw NotFoundException when record does not exist', async () => {
      mockPrismaService.exchangeRate.findUnique.mockResolvedValue(null);

      await expect(service.remove('bad-id')).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.exchangeRate.delete).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // convert
  // ---------------------------------------------------------------------------
  describe('convert', () => {
    it('should convert USD to EUR using the stored rate', async () => {
      mockPrismaService.exchangeRate.findFirst.mockResolvedValue({
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        rate: 0.921543,
        effectiveDate: new Date('2026-05-31'),
      });

      const result = await service.convert({
        amount: 1000,
        from: 'USD',
        to: 'EUR',
      });

      expect((result.data as any).convertedAmount).toBeCloseTo(921.54, 1);
      expect((result.data as any).rate).toBe(0.921543);
      expect((result.data as any).fromCurrency).toBe('USD');
      expect((result.data as any).toCurrency).toBe('EUR');
    });

    it('should return the original amount with rate=1 when from === to (no DB hit)', async () => {
      const result = await service.convert({
        amount: 500,
        from: 'EUR',
        to: 'EUR',
      });

      expect((result.data as any).convertedAmount).toBe(500);
      expect((result.data as any).rate).toBe(1);
      expect(mockPrismaService.exchangeRate.findFirst).not.toHaveBeenCalled();
    });

    it('should normalise currency codes to uppercase before lookup', async () => {
      mockPrismaService.exchangeRate.findFirst.mockResolvedValue({
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        rate: 0.92,
        effectiveDate: new Date('2026-05-31'),
      });

      await service.convert({ amount: 100, from: 'usd', to: 'eur' });

      expect(mockPrismaService.exchangeRate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fromCurrency: 'USD',
            toCurrency: 'EUR',
          }),
        }),
      );
    });

    it('should use the provided date for the rate lookup', async () => {
      mockPrismaService.exchangeRate.findFirst.mockResolvedValue({
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        rate: 0.9,
        effectiveDate: new Date('2026-01-01'),
      });

      await service.convert({
        amount: 1000,
        from: 'USD',
        to: 'EUR',
        date: '2026-01-15',
      });

      expect(mockPrismaService.exchangeRate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            effectiveDate: { lte: new Date('2026-01-15') },
          }),
        }),
      );
    });

    it('should throw NotFoundException when no rate exists for the pair', async () => {
      mockPrismaService.exchangeRate.findFirst.mockResolvedValue(null);

      await expect(
        service.convert({ amount: 1000, from: 'USD', to: 'JPY' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should round convertedAmount to 2 decimal places', async () => {
      mockPrismaService.exchangeRate.findFirst.mockResolvedValue({
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        rate: 0.333333,
        effectiveDate: new Date('2026-05-31'),
      });

      const result = await service.convert({
        amount: 100,
        from: 'USD',
        to: 'EUR',
      });

      const converted = (result.data as any).convertedAmount;
      expect(String(converted)).toMatch(/^\d+\.\d{1,2}$/);
    });
  });
});
