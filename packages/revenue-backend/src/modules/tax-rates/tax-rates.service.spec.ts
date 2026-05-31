import { Test, TestingModule } from '@nestjs/testing';
import { TaxRatesService } from './tax-rates.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrismaService = {
  taxRate: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

describe('TaxRatesService', () => {
  let service: TaxRatesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxRatesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();
    service = module.get<TaxRatesService>(TaxRatesService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create tax rate with active=true', async () => {
      mockPrismaService.taxRate.create.mockResolvedValue({
        id: 'tr-1',
        jurisdiction: 'EU-DE',
        taxType: 'VAT',
        rate: 0.19,
        name: 'German VAT Standard Rate',
        active: true,
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
      });

      const result = await service.create({
        jurisdiction: 'EU-DE',
        taxType: 'VAT',
        rate: 0.19,
        name: 'German VAT Standard Rate',
        effectiveFrom: '2026-01-01',
      });

      expect(result.data).toMatchObject({ jurisdiction: 'EU-DE', active: true });
      expect(mockPrismaService.taxRate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ active: true, jurisdiction: 'EU-DE' }),
        }),
      );
    });

    it('should set effectiveTo when provided', async () => {
      mockPrismaService.taxRate.create.mockResolvedValue({
        id: 'tr-1',
        jurisdiction: 'UK',
        taxType: 'VAT',
        rate: 0.2,
        name: 'UK VAT',
        active: true,
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: new Date('2026-12-31'),
      });

      await service.create({
        jurisdiction: 'UK',
        taxType: 'VAT',
        rate: 0.2,
        name: 'UK VAT',
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
      });

      expect(mockPrismaService.taxRate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ effectiveTo: new Date('2026-12-31') }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated list', async () => {
      mockPrismaService.taxRate.findMany.mockResolvedValue([{ id: 'tr-1' }]);
      mockPrismaService.taxRate.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.paging.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('should respect pagination params', async () => {
      mockPrismaService.taxRate.findMany.mockResolvedValue([]);
      mockPrismaService.taxRate.count.mockResolvedValue(0);

      await service.findAll({ 'offset[eq]': '10', 'limit[eq]': '5' });

      expect(mockPrismaService.taxRate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });
  });

  describe('findOne', () => {
    it('should return tax rate by id', async () => {
      mockPrismaService.taxRate.findUnique.mockResolvedValue({ id: 'tr-1', jurisdiction: 'EU-DE' });

      const result = await service.findOne('tr-1');

      expect(result.data).toMatchObject({ id: 'tr-1' });
    });

    it('should throw NotFoundException for unknown id', async () => {
      mockPrismaService.taxRate.findUnique.mockResolvedValue(null);

      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('calculateTax', () => {
    it('should calculate VAT correctly at 19%', async () => {
      mockPrismaService.taxRate.findFirst.mockResolvedValue({
        id: 'tr-1',
        jurisdiction: 'EU-DE',
        taxType: 'VAT',
        rate: 0.19,
        name: 'German VAT Standard Rate',
      });

      const result = await service.calculateTax({ amount: 10000, jurisdiction: 'EU-DE', taxType: 'VAT' });

      expect(result.data.taxAmount).toBe(1900);
      expect(result.data.totalWithTax).toBe(11900);
      expect(result.data.rate).toBe(0.19);
    });

    it('should throw NotFoundException when no active rate found', async () => {
      mockPrismaService.taxRate.findFirst.mockResolvedValue(null);

      await expect(service.calculateTax({ amount: 1000, jurisdiction: 'UNKNOWN' }))
        .rejects.toThrow(NotFoundException);
    });

    it('should calculate 0 tax for 0% rate', async () => {
      mockPrismaService.taxRate.findFirst.mockResolvedValue({
        id: 'tr-2',
        jurisdiction: 'US-OR',
        taxType: 'SALES_TAX',
        rate: 0,
        name: 'Oregon No Sales Tax',
      });

      const result = await service.calculateTax({ amount: 5000, jurisdiction: 'US-OR' });

      expect(result.data.taxAmount).toBe(0);
      expect(result.data.totalWithTax).toBe(5000);
    });

    it('should query with taxType filter when provided', async () => {
      mockPrismaService.taxRate.findFirst.mockResolvedValue({
        id: 'tr-1', jurisdiction: 'EU-DE', taxType: 'VAT', rate: 0.19, name: 'German VAT',
      });

      await service.calculateTax({ amount: 1000, jurisdiction: 'EU-DE', taxType: 'VAT' });

      expect(mockPrismaService.taxRate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ taxType: 'VAT' }),
        }),
      );
    });

    it('should use today as default date when not provided', async () => {
      mockPrismaService.taxRate.findFirst.mockResolvedValue({
        id: 'tr-1', jurisdiction: 'EU-FR', taxType: 'VAT', rate: 0.2, name: 'French VAT',
      });

      await service.calculateTax({ amount: 500, jurisdiction: 'EU-FR' });

      expect(mockPrismaService.taxRate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            effectiveFrom: { lte: expect.any(Date) },
          }),
        }),
      );
    });
  });

  describe('deactivate', () => {
    it('should set active=false on soft delete', async () => {
      mockPrismaService.taxRate.findUnique.mockResolvedValue({ id: 'tr-1', active: true });
      mockPrismaService.taxRate.update.mockResolvedValue({ id: 'tr-1', active: false });

      await service.deactivate('tr-1');

      expect(mockPrismaService.taxRate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ active: false }),
        }),
      );
    });

    it('should throw NotFoundException for unknown id', async () => {
      mockPrismaService.taxRate.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
