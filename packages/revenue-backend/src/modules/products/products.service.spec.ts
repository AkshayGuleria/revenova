import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductsService } from './products.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { CreateProductDto, UpdateProductDto } from './dto';
import {
  PricingModel,
  ChargeType,
  ProductCategory,
} from './dto/create-product.dto';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    product: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('EUR'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
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

    service = module.get<ProductsService>(ProductsService);
    prisma = module.get<PrismaService>(PrismaService);

    // Prevent unused variable warning
    void prisma;

    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue('EUR');
  });

  describe('create', () => {
    const createProductDto: CreateProductDto = {
      name: 'Enterprise Plan',
      pricingModel: PricingModel.SEAT_BASED,
      basePrice: 99.99,
      minSeats: 1,
      maxSeats: 1000,
      seatIncrement: 5,
    };

    const mockCreatedProduct = {
      id: 'product-123',
      ...createProductDto,
      currency: 'EUR',
      active: true,
      isAddon: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create a product successfully', async () => {
      mockPrismaService.product.create.mockResolvedValue(mockCreatedProduct);

      const result = await service.create(createProductDto);

      expect(result).toEqual({
        data: mockCreatedProduct,
        paging: {
          offset: null,
          limit: null,
          total: null,
          totalPages: null,
          hasNext: null,
          hasPrev: null,
        },
      });
      expect(mockPrismaService.product.create).toHaveBeenCalledWith({
        data: { ...createProductDto, currency: 'EUR' },
      });
    });

    it('should create recurring product with all Phase 3.5 fields', async () => {
      const recurringProductDto: CreateProductDto = {
        name: 'Professional Plan',
        sku: 'PLAN-PRO',
        pricingModel: PricingModel.SEAT_BASED,
        chargeType: ChargeType.RECURRING,
        category: ProductCategory.PLATFORM,
        basePrice: 79.99,
        billingInterval: undefined,
        setupFee: 500,
        trialPeriodDays: undefined,
        minCommitmentMonths: undefined,
        minSeats: 5,
      };

      const mockRecurringProduct = {
        id: 'product-pro',
        ...recurringProductDto,
        currency: 'USD',
        active: true,
        isAddon: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.product.create.mockResolvedValue(mockRecurringProduct);

      const result = await service.create(recurringProductDto);

      expect(result.data).toMatchObject({
        chargeType: 'recurring',
        category: 'platform',
        setupFee: 500,
      });
    });

    it('should create one_time product without billingInterval', async () => {
      const oneTimeDto: CreateProductDto = {
        name: 'Onboarding Package',
        sku: 'SVC-ONBOARDING',
        pricingModel: PricingModel.FLAT_FEE,
        chargeType: ChargeType.ONE_TIME,
        category: ProductCategory.PROFESSIONAL_SERVICES,
        basePrice: 5000,
      };

      const mockOneTimeProduct = {
        id: 'product-onboarding',
        ...oneTimeDto,
        billingInterval: null,
        currency: 'USD',
        active: true,
        isAddon: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.product.create.mockResolvedValue(mockOneTimeProduct);

      const result = await service.create(oneTimeDto);

      expect(result.data).toMatchObject({
        chargeType: 'one_time',
        category: 'professional_services',
        billingInterval: null,
      });
    });

    it('should create usage_based product (billing deferred to Phase 6)', async () => {
      const usageDto: CreateProductDto = {
        name: 'Extra Storage',
        sku: 'STORAGE-GB',
        pricingModel: PricingModel.CUSTOM,
        chargeType: ChargeType.USAGE_BASED,
        category: ProductCategory.STORAGE,
        basePrice: 0.1,
      };

      const mockUsageProduct = {
        id: 'product-storage',
        ...usageDto,
        currency: 'USD',
        active: true,
        isAddon: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.product.create.mockResolvedValue(mockUsageProduct);

      const result = await service.create(usageDto);

      expect(result.data.chargeType).toBe('usage_based');
    });

    it('should create product with volume tiers', async () => {
      const productWithTiers = {
        ...createProductDto,
        pricingModel: PricingModel.VOLUME_TIERED,
        volumeTiers: [
          { minQuantity: 1, maxQuantity: 10, pricePerUnit: 99.99 },
          { minQuantity: 11, maxQuantity: 50, pricePerUnit: 89.99 },
          { minQuantity: 51, maxQuantity: null, pricePerUnit: 79.99 },
        ],
      };

      mockPrismaService.product.create.mockResolvedValue({
        ...mockCreatedProduct,
        ...productWithTiers,
      });

      const result = await service.create(productWithTiers);

      expect(result.data.volumeTiers).toBeDefined();
      expect(mockPrismaService.product.create).toHaveBeenCalled();
    });

    it('should throw ConflictException when SKU already exists', async () => {
      const prismaError = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
        },
      );

      mockPrismaService.product.create.mockRejectedValue(prismaError);

      await expect(
        service.create({ ...createProductDto, sku: 'ENT-PLAN-001' }),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.create({ ...createProductDto, sku: 'ENT-PLAN-001' }),
      ).rejects.toThrow('Product with this SKU already exists');
    });

    it('should rethrow non-P2002 prisma errors on create', async () => {
      const genericError = new Error('Generic DB error');
      mockPrismaService.product.create.mockRejectedValue(genericError);

      await expect(
        service.create({
          name: 'Test Product',
          pricingModel: PricingModel.FLAT_FEE,
        }),
      ).rejects.toThrow('Generic DB error');
    });

    it('should apply EUR default when currency is omitted', async () => {
      const dtoWithoutCurrency: CreateProductDto = {
        name: 'No Currency Plan',
        pricingModel: PricingModel.FLAT_FEE,
      };
      const mockProduct = {
        id: 'product-no-currency',
        ...dtoWithoutCurrency,
        currency: 'EUR',
        active: true,
        isAddon: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.product.create.mockResolvedValue(mockProduct);

      const result = await service.create(dtoWithoutCurrency);

      expect(result.data.currency).toBe('EUR');
      expect(mockPrismaService.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currency: 'EUR' }),
        }),
      );
    });

    it('should use explicitly provided currency when given', async () => {
      const dtoWithGbp: CreateProductDto = {
        name: 'GBP Plan',
        pricingModel: PricingModel.FLAT_FEE,
        currency: 'GBP',
      };
      const mockProduct = {
        id: 'product-gbp',
        ...dtoWithGbp,
        active: true,
        isAddon: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.product.create.mockResolvedValue(mockProduct);

      const result = await service.create(dtoWithGbp);

      expect(result.data.currency).toBe('GBP');
      expect(mockPrismaService.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currency: 'GBP' }),
        }),
      );
    });
  });

  describe('findAll', () => {
    const mockProducts = [
      {
        id: 'product-1',
        name: 'Enterprise Plan',
        sku: 'ENT-001',
        pricingModel: 'seat_based',
        basePrice: '99.99',
        active: true,
        isAddon: false,
      },
      {
        id: 'product-2',
        name: 'Pro Plan',
        sku: 'PRO-001',
        pricingModel: 'flat_fee',
        basePrice: '49.99',
        active: true,
        isAddon: false,
      },
    ];

    it('should return paginated list of products', async () => {
      const query = { 'offset[eq]': 0, 'limit[eq]': 20 };

      mockPrismaService.product.findMany.mockResolvedValue(mockProducts);
      mockPrismaService.product.count.mockResolvedValue(2);

      const result = await service.findAll(query);

      expect(result.data).toEqual(mockProducts);
      expect(result.paging).toEqual({
        offset: 0,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('should filter by pricing model using eq operator', async () => {
      const query = { 'pricingModel[eq]': 'seat_based' };

      mockPrismaService.product.findMany.mockResolvedValue([mockProducts[0]]);
      mockPrismaService.product.count.mockResolvedValue(1);

      await service.findAll(query);

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            pricingModel: 'seat_based',
          },
        }),
      );
    });

    it('should filter by name using like operator', async () => {
      const query = { 'name[like]': 'Enterprise' };

      mockPrismaService.product.findMany.mockResolvedValue([mockProducts[0]]);
      mockPrismaService.product.count.mockResolvedValue(1);

      await service.findAll(query);

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            name: { contains: 'Enterprise', mode: 'insensitive' },
          },
        }),
      );
    });

    it('should filter by active status', async () => {
      const query = { 'active[eq]': true };

      mockPrismaService.product.findMany.mockResolvedValue(mockProducts);
      mockPrismaService.product.count.mockResolvedValue(2);

      await service.findAll(query);

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            active: true,
          },
        }),
      );
    });

    it('should filter by multiple pricing models using in operator', async () => {
      const query = { 'pricingModel[in]': 'seat_based,flat_fee' };

      mockPrismaService.product.findMany.mockResolvedValue(mockProducts);
      mockPrismaService.product.count.mockResolvedValue(2);

      await service.findAll(query);

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            pricingModel: { in: ['seat_based', 'flat_fee'] },
          },
        }),
      );
    });

    it('should filter products by chargeType[eq]=recurring', async () => {
      const query = { 'chargeType[eq]': 'recurring' };

      mockPrismaService.product.findMany.mockResolvedValue(mockProducts);
      mockPrismaService.product.count.mockResolvedValue(2);

      await service.findAll(query);

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { chargeType: 'recurring' },
        }),
      );
    });

    it('should filter products by chargeType[eq]=one_time', async () => {
      const oneTimeProducts = [
        {
          id: 'p1',
          name: 'Onboarding Package',
          chargeType: 'one_time',
          category: 'professional_services',
        },
      ];
      const query = { 'chargeType[eq]': 'one_time' };

      mockPrismaService.product.findMany.mockResolvedValue(oneTimeProducts);
      mockPrismaService.product.count.mockResolvedValue(1);

      const result = await service.findAll(query);

      expect(result.data).toHaveLength(1);
      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { chargeType: 'one_time' },
        }),
      );
    });

    it('should filter products by category[eq]=addon', async () => {
      const addonProducts = [
        {
          id: 'p1',
          name: 'AI Assistant',
          chargeType: 'recurring',
          category: 'addon',
        },
      ];
      const query = { 'category[eq]': 'addon' };

      mockPrismaService.product.findMany.mockResolvedValue(addonProducts);
      mockPrismaService.product.count.mockResolvedValue(1);

      await service.findAll(query);

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { category: 'addon' },
        }),
      );
    });

    it('should filter by combined chargeType and category', async () => {
      const query = {
        'chargeType[eq]': 'one_time',
        'category[eq]': 'professional_services',
      };

      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.count.mockResolvedValue(0);

      await service.findAll(query);

      // Query parser wraps multiple filters in AND
      const call = mockPrismaService.product.findMany.mock.calls[0][0];
      const where = call.where;
      // Accepts either direct fields or AND-wrapped structure
      const hasChargeType =
        where.chargeType === 'one_time' ||
        (where.AND && where.AND.some((c: any) => c.chargeType === 'one_time'));
      const hasCategory =
        where.category === 'professional_services' ||
        (where.AND &&
          where.AND.some((c: any) => c.category === 'professional_services'));
      expect(hasChargeType).toBe(true);
      expect(hasCategory).toBe(true);
    });
  });

  describe('findOne', () => {
    const mockProduct = {
      id: 'product-1',
      name: 'Enterprise Plan',
      pricingModel: 'seat_based',
      active: true,
    };

    it('should return product by ID', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.findOne('product-1');

      expect(result).toEqual({
        data: mockProduct,
        paging: {
          offset: null,
          limit: null,
          total: null,
          totalPages: null,
          hasNext: null,
          hasPrev: null,
        },
      });
      expect(mockPrismaService.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'product-1' },
      });
    });

    it('should throw NotFoundException when product does not exist', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('non-existent')).rejects.toThrow(
        'Product with ID non-existent not found',
      );
    });
  });

  describe('update', () => {
    const mockProduct = {
      id: 'product-1',
      name: 'Enterprise Plan',
      pricingModel: 'seat_based',
    };

    const updateProductDto: UpdateProductDto = {
      basePrice: 149.99,
      maxSeats: 2000,
    };

    beforeEach(() => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
    });

    it('should update product successfully', async () => {
      const updatedProduct = { ...mockProduct, ...updateProductDto };
      mockPrismaService.product.update.mockResolvedValue(updatedProduct);

      const result = await service.update('product-1', updateProductDto);

      expect(result.data).toEqual(updatedProduct);
      expect(mockPrismaService.product.update).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        data: updateProductDto,
      });
    });

    it('should throw NotFoundException when product does not exist', async () => {
      mockPrismaService.product.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.update('non-existent', updateProductDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update product with volume tiers', async () => {
      const updateWithTiers = {
        volumeTiers: [{ minQuantity: 1, maxQuantity: 20, pricePerUnit: 99.99 }],
      };

      mockPrismaService.product.update.mockResolvedValue({
        ...mockProduct,
        ...updateWithTiers,
      });

      const result = await service.update('product-1', updateWithTiers);

      expect(result.data.volumeTiers).toBeDefined();
    });

    it('should throw ConflictException when SKU already exists', async () => {
      const prismaError = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
        },
      );

      mockPrismaService.product.update.mockRejectedValue(prismaError);

      await expect(
        service.update('product-1', { sku: 'EXISTING-SKU' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should rethrow non-P2002 prisma errors on update', async () => {
      const genericError = new Error('Generic DB error on update');
      mockPrismaService.product.update.mockRejectedValue(genericError);

      await expect(
        service.update('product-1', { name: 'New Name' }),
      ).rejects.toThrow('Generic DB error on update');
    });
  });

  describe('remove', () => {
    const mockProduct = {
      id: 'product-1',
      name: 'Enterprise Plan',
    };

    it('should delete product successfully', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.product.delete.mockResolvedValue(mockProduct);

      await service.remove('product-1');

      expect(mockPrismaService.product.delete).toHaveBeenCalledWith({
        where: { id: 'product-1' },
      });
    });

    it('should throw NotFoundException when product does not exist', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
