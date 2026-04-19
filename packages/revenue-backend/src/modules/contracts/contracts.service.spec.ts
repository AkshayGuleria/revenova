import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { CreateContractDto, UpdateContractDto } from './dto';
import {
  BillingFrequency,
  ContractStatus,
  PaymentTerms,
} from './dto/create-contract.dto';

describe('ContractsService', () => {
  let service: ContractsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    contract: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    account: {
      findUnique: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    contractProduct: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    contractShare: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    // Transaction mock: executes the callback with this same mock object
    $transaction: jest.fn((fn: (tx: any) => Promise<any>) =>
      fn(mockPrismaService),
    ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
    prisma = module.get<PrismaService>(PrismaService);

    // Prevent unused variable warning
    void prisma;

    jest.clearAllMocks();
    // Re-bind $transaction to the default pass-through after each clear
    mockPrismaService.$transaction.mockImplementation(
      (fn: (tx: any) => Promise<any>) => fn(mockPrismaService),
    );
  });

  describe('create', () => {
    const mockAccount = {
      id: 'account-123',
      accountName: 'Test Account',
    };

    const mockProduct = { id: 'product-123', name: 'Enterprise Plan', basePrice: 99.99 };

    const createContractDto: CreateContractDto = {
      contractNumber: 'CNT-2024-0001',
      accountId: 'account-123',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      contractValue: 120000,
      billingFrequency: BillingFrequency.ANNUAL,
      paymentTerms: PaymentTerms.NET_30,
      products: [{ productId: 'product-123', quantity: 50 }],
    };

    const mockCreatedContract = {
      id: 'contract-123',
      contractNumber: 'CNT-2024-0001',
      accountId: 'account-123',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      contractValue: 120000,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      products: [
        {
          id: 'cp-123',
          contractId: 'contract-123',
          productId: 'product-123',
          quantity: 50,
          product: mockProduct,
        },
      ],
    };

    it('should create a contract successfully', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);
      mockPrismaService.contract.create.mockResolvedValue({ id: 'contract-123' });
      mockPrismaService.contractProduct.createMany.mockResolvedValue({ count: 1 });
      mockPrismaService.contract.findUnique.mockResolvedValue(mockCreatedContract);

      const result = await service.create(createContractDto);

      expect(result).toEqual({
        data: mockCreatedContract,
        paging: {
          offset: null,
          limit: null,
          total: null,
          totalPages: null,
          hasNext: null,
          hasPrev: null,
        },
      });
      expect(mockPrismaService.account.findUnique).toHaveBeenCalledWith({
        where: { id: 'account-123' },
      });
      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['product-123'] } },
        select: { id: true },
      });
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException when account does not exist', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(null);

      await expect(service.create(createContractDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(createContractDto)).rejects.toThrow(
        'Account with ID account-123 not found',
      );
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when end date is before start date', async () => {
      const invalidDto = {
        ...createContractDto,
        startDate: '2024-12-31',
        endDate: '2024-01-01',
      };

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);

      await expect(service.create(invalidDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(invalidDto)).rejects.toThrow(
        'End date must be after start date',
      );
    });

    it('should throw BadRequestException when a productId does not exist', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      // Return empty — no products found
      mockPrismaService.product.findMany.mockResolvedValue([]);

      await expect(service.create(createContractDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createContractDto)).rejects.toThrow(
        'Products not found: product-123',
      );
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when contract number already exists', async () => {
      const prismaError = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
        },
      );

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);
      // Make the transaction always throw the prisma error for this test
      mockPrismaService.$transaction.mockRejectedValue(prismaError);

      await expect(service.create(createContractDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createContractDto)).rejects.toThrow(
        'Contract with this number already exists',
      );
    });

    it('should rethrow non-P2002 prisma errors on create', async () => {
      const genericError = new Error('Generic DB error');
      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);
      mockPrismaService.$transaction.mockRejectedValueOnce(genericError);

      await expect(service.create(createContractDto)).rejects.toThrow(
        'Generic DB error',
      );
    });

    it('should create contractProduct records in transaction', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);
      mockPrismaService.contract.create.mockResolvedValue({ id: 'contract-123' });
      mockPrismaService.contractProduct.createMany.mockResolvedValue({ count: 1 });
      mockPrismaService.contract.findUnique.mockResolvedValue(mockCreatedContract);

      await service.create(createContractDto);

      expect(mockPrismaService.contractProduct.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            contractId: 'contract-123',
            productId: 'product-123',
            quantity: 50,
          }),
        ],
      });
    });
  });

  describe('findProducts', () => {
    it('should return products for a contract', async () => {
      const contract = { id: 'contract-1' };
      const contractProducts = [
        {
          id: 'cp-1',
          contractId: 'contract-1',
          productId: 'product-1',
          quantity: 10,
          product: { id: 'product-1', name: 'Enterprise Plan' },
        },
      ];

      mockPrismaService.contract.findUnique.mockResolvedValue(contract);
      mockPrismaService.contractProduct.findMany.mockResolvedValue(contractProducts);

      const result = await service.findProducts('contract-1');

      expect(result.data).toEqual(contractProducts);
      expect((result.paging as any).total).toBe(1);
    });

    it('should return empty array when contract has no products', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue({ id: 'contract-1' });
      mockPrismaService.contractProduct.findMany.mockResolvedValue([]);

      const result = await service.findProducts('contract-1');

      expect(result.data).toEqual([]);
      expect((result.paging as any).total).toBe(0);
    });

    it('should throw NotFoundException when contract not found', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue(null);

      await expect(service.findProducts('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addProduct', () => {
    it('should add a product to a contract', async () => {
      const contract = { id: 'contract-1' };
      const product = { id: 'product-1', name: 'Enterprise Plan' };
      const contractProduct = {
        id: 'cp-1',
        contractId: 'contract-1',
        productId: 'product-1',
        quantity: 10,
        product,
      };

      mockPrismaService.contract.findUnique.mockResolvedValue(contract);
      mockPrismaService.product.findUnique.mockResolvedValue(product);
      mockPrismaService.contractProduct.create.mockResolvedValue(contractProduct);

      const result = await service.addProduct('contract-1', {
        productId: 'product-1',
        quantity: 10,
      });

      expect(result.data).toEqual(contractProduct);
      expect(mockPrismaService.contractProduct.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contractId: 'contract-1',
            productId: 'product-1',
            quantity: 10,
          }),
        }),
      );
    });

    it('should throw NotFoundException when contract not found', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue(null);

      await expect(
        service.addProduct('invalid-id', { productId: 'product-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when product not found', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue({ id: 'contract-1' });
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(
        service.addProduct('contract-1', { productId: 'invalid-product' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException on P2002 (duplicate product)', async () => {
      const prismaError = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '5.0.0' },
      );

      mockPrismaService.contract.findUnique.mockResolvedValue({ id: 'contract-1' });
      mockPrismaService.product.findUnique.mockResolvedValue({ id: 'product-1' });
      mockPrismaService.contractProduct.create.mockRejectedValue(prismaError);

      await expect(
        service.addProduct('contract-1', { productId: 'product-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should rethrow non-P2002 errors from addProduct', async () => {
      const genericError = new Error('Unexpected DB error in addProduct');
      mockPrismaService.contract.findUnique.mockResolvedValue({ id: 'contract-1' });
      mockPrismaService.product.findUnique.mockResolvedValue({ id: 'product-1' });
      mockPrismaService.contractProduct.create.mockRejectedValue(genericError);

      await expect(
        service.addProduct('contract-1', { productId: 'product-1' }),
      ).rejects.toThrow('Unexpected DB error in addProduct');
    });
  });

  describe('removeProduct', () => {
    it('should delete a contract-product binding', async () => {
      const cp = {
        id: 'cp-1',
        contractId: 'contract-1',
        productId: 'product-1',
      };

      mockPrismaService.contractProduct.findUnique.mockResolvedValue(cp);
      mockPrismaService.contractProduct.delete.mockResolvedValue(cp);

      await service.removeProduct('contract-1', 'product-1');

      expect(mockPrismaService.contractProduct.delete).toHaveBeenCalledWith({
        where: {
          contractId_productId: {
            contractId: 'contract-1',
            productId: 'product-1',
          },
        },
      });
    });

    it('should throw NotFoundException when binding not found', async () => {
      mockPrismaService.contractProduct.findUnique.mockResolvedValue(null);

      await expect(
        service.removeProduct('contract-1', 'product-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    const mockContracts = [
      {
        id: 'contract-1',
        contractNumber: 'CNT-2024-0001',
        status: 'active',
        contractValue: '120000.00',
        account: {
          id: 'account-1',
          accountName: 'Test Account 1',
          status: 'active',
        },
        _count: { invoices: 5 },
      },
      {
        id: 'contract-2',
        contractNumber: 'CNT-2024-0002',
        status: 'draft',
        contractValue: '50000.00',
        account: {
          id: 'account-2',
          accountName: 'Test Account 2',
          status: 'active',
        },
        _count: { invoices: 0 },
      },
    ];

    it('should return paginated list of contracts', async () => {
      const query = { 'offset[eq]': 0, 'limit[eq]': 20 };

      mockPrismaService.contract.findMany.mockResolvedValue(mockContracts);
      mockPrismaService.contract.count.mockResolvedValue(2);

      const result = await service.findAll(query);

      expect(result.data).toEqual(mockContracts);
      expect(result.paging).toEqual({
        offset: 0,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('should filter by status using eq operator', async () => {
      const query = { 'status[eq]': 'active' };

      mockPrismaService.contract.findMany.mockResolvedValue([mockContracts[0]]);
      mockPrismaService.contract.count.mockResolvedValue(1);

      await service.findAll(query);

      expect(mockPrismaService.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'active',
          },
        }),
      );
    });

    it('should filter by contract number using like operator', async () => {
      const query = { 'contractNumber[like]': 'CNT-2024' };

      mockPrismaService.contract.findMany.mockResolvedValue(mockContracts);
      mockPrismaService.contract.count.mockResolvedValue(2);

      await service.findAll(query);

      expect(mockPrismaService.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            contractNumber: { contains: 'CNT-2024', mode: 'insensitive' },
          },
        }),
      );
    });

    it('should filter by account ID', async () => {
      const query = { 'accountId[eq]': 'account-1' };

      mockPrismaService.contract.findMany.mockResolvedValue([mockContracts[0]]);
      mockPrismaService.contract.count.mockResolvedValue(1);

      await service.findAll(query);

      expect(mockPrismaService.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            accountId: 'account-1',
          },
        }),
      );
    });

    it('should filter by multiple statuses using in operator', async () => {
      const query = { 'status[in]': 'active,draft' };

      mockPrismaService.contract.findMany.mockResolvedValue(mockContracts);
      mockPrismaService.contract.count.mockResolvedValue(2);

      await service.findAll(query);

      expect(mockPrismaService.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { in: ['active', 'draft'] },
          },
        }),
      );
    });
  });

  describe('findOne', () => {
    const mockContract = {
      id: 'contract-1',
      contractNumber: 'CNT-2024-0001',
      status: 'active',
      account: {
        id: 'account-1',
        accountName: 'Test Account',
        primaryContactEmail: 'test@example.com',
        status: 'active',
      },
      invoices: [],
      _count: { invoices: 0 },
    };

    it('should return contract by ID', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue(mockContract);

      const result = await service.findOne('contract-1');

      expect(result).toEqual({
        data: mockContract,
        paging: {
          offset: null,
          limit: null,
          total: null,
          totalPages: null,
          hasNext: null,
          hasPrev: null,
        },
      });
      expect(mockPrismaService.contract.findUnique).toHaveBeenCalledWith({
        where: { id: 'contract-1' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when contract does not exist', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('non-existent')).rejects.toThrow(
        'Contract with ID non-existent not found',
      );
    });
  });

  describe('update', () => {
    const mockContract = {
      id: 'contract-1',
      contractNumber: 'CNT-2024-0001',
      status: 'active',
      account: { id: 'account-1' },
      invoices: [],
      _count: { invoices: 0 },
    };

    const mockAccount = {
      id: 'account-1',
      accountName: 'Test Account',
    };

    const updateContractDto: UpdateContractDto = {
      contractValue: 150000,
      status: ContractStatus.ACTIVE,
    };

    beforeEach(() => {
      mockPrismaService.contract.findUnique.mockResolvedValue(mockContract);
      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
    });

    it('should update contract successfully', async () => {
      const updatedContract = { ...mockContract, ...updateContractDto };
      mockPrismaService.contract.update.mockResolvedValue(updatedContract);

      const result = await service.update('contract-1', updateContractDto);

      expect(result.data).toEqual(updatedContract);
      expect(mockPrismaService.contract.update).toHaveBeenCalledWith({
        where: { id: 'contract-1' },
        data: updateContractDto,
      });
    });

    it('should throw NotFoundException when contract does not exist', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.update('non-existent', updateContractDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate account when updating accountId', async () => {
      const updateWithAccount = { accountId: 'account-2' };

      mockPrismaService.account.findUnique.mockResolvedValueOnce({
        id: 'account-2',
      });
      mockPrismaService.contract.update.mockResolvedValue({
        ...mockContract,
        accountId: 'account-2',
      });

      await service.update('contract-1', updateWithAccount);

      expect(mockPrismaService.account.findUnique).toHaveBeenCalledWith({
        where: { id: 'account-2' },
      });
    });

    it('should throw NotFoundException when new account does not exist', async () => {
      jest.clearAllMocks();
      mockPrismaService.contract.findUnique.mockResolvedValueOnce(mockContract);
      mockPrismaService.account.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.update('contract-1', { accountId: 'non-existent' }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.contract.update).not.toHaveBeenCalled();
    });

    it('should validate dates when updating both startDate and endDate', async () => {
      const invalidUpdate = {
        startDate: '2024-12-31',
        endDate: '2024-01-01',
      };

      await expect(service.update('contract-1', invalidUpdate)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.update('contract-1', invalidUpdate)).rejects.toThrow(
        'End date must be after start date',
      );
    });

    it('should throw ConflictException when contract number already exists', async () => {
      const prismaError = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
        },
      );

      mockPrismaService.contract.update.mockRejectedValue(prismaError);

      await expect(
        service.update('contract-1', { contractNumber: 'CNT-2024-0002' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should rethrow non-P2002 prisma errors on update', async () => {
      const genericError = new Error('Generic DB error on update');
      mockPrismaService.contract.update.mockRejectedValue(genericError);

      await expect(
        service.update('contract-1', { contractNumber: 'CNT-NEW' }),
      ).rejects.toThrow('Generic DB error on update');
    });

    it('should update contract with startDate and endDate', async () => {
      const updateWithDates = {
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      };

      const updatedContract = {
        ...mockContract,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
      };

      mockPrismaService.contract.update.mockResolvedValue(updatedContract);

      const result = await service.update('contract-1', updateWithDates);

      expect(result.data).toEqual(updatedContract);
      expect(mockPrismaService.contract.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            startDate: new Date('2025-01-01'),
            endDate: new Date('2025-12-31'),
          }),
        }),
      );
    });
  });

  describe('remove', () => {
    const mockContract = {
      id: 'contract-1',
      contractNumber: 'CNT-2024-0001',
      account: {},
      invoices: [],
      _count: { invoices: 0 },
    };

    it('should delete contract successfully', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue(mockContract);
      mockPrismaService.contract.delete.mockResolvedValue(mockContract);

      await service.remove('contract-1');

      expect(mockPrismaService.contract.delete).toHaveBeenCalledWith({
        where: { id: 'contract-1' },
      });
    });

    it('should throw NotFoundException when contract does not exist', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('shareContract', () => {
    it('should share contract with another account', async () => {
      const contract = {
        id: 'contract-id',
        accountId: 'owner-id',
        account: { id: 'owner-id', accountName: 'Owner Corp' },
      };
      const targetAccount = {
        id: 'target-id',
        accountName: 'Target Corp',
        parentAccountId: 'owner-id',
      };
      const share = {
        id: 'share-id',
        contractId: 'contract-id',
        accountId: 'target-id',
        notes: 'Shared for subsidiary',
        account: { id: 'target-id', accountName: 'Target Corp' },
        contract: { id: 'contract-id', contractNumber: 'CNT-001' },
      };

      mockPrismaService.contract.findUnique.mockResolvedValue(contract);
      mockPrismaService.account.findUnique.mockResolvedValue(targetAccount);
      mockPrismaService.contractShare.findUnique.mockResolvedValue(null);
      mockPrismaService.contractShare.create.mockResolvedValue(share);

      const result = await service.shareContract(
        'contract-id',
        'target-id',
        'Shared for subsidiary',
      );

      expect(result.data).toEqual(share);
      expect(mockPrismaService.contractShare.create).toHaveBeenCalledWith({
        data: {
          contractId: 'contract-id',
          accountId: 'target-id',
          notes: 'Shared for subsidiary',
        },
        include: {
          account: { select: { id: true, accountName: true } },
          contract: { select: { id: true, contractNumber: true } },
        },
      });
    });

    it('should throw NotFoundException if contract not found', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue(null);

      await expect(
        service.shareContract('invalid-id', 'target-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if target account not found', async () => {
      const contract = { id: 'contract-id', accountId: 'owner-id' };

      mockPrismaService.contract.findUnique.mockResolvedValue(contract);
      mockPrismaService.account.findUnique.mockResolvedValue(null);

      await expect(
        service.shareContract('contract-id', 'invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if sharing with owner account', async () => {
      const contract = {
        id: 'contract-id',
        accountId: 'owner-id',
        account: { id: 'owner-id', accountName: 'Owner Corp' },
      };
      const targetAccount = { id: 'owner-id', accountName: 'Owner Corp' };

      mockPrismaService.contract.findUnique.mockResolvedValue(contract);
      mockPrismaService.account.findUnique.mockResolvedValue(targetAccount);

      await expect(
        service.shareContract('contract-id', 'owner-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if already shared', async () => {
      const contract = {
        id: 'contract-id',
        accountId: 'owner-id',
        account: { id: 'owner-id', accountName: 'Owner Corp' },
      };
      const targetAccount = { id: 'target-id', accountName: 'Target Corp' };
      const existingShare = { id: 'share-id', contractId: 'contract-id' };

      mockPrismaService.contract.findUnique.mockResolvedValue(contract);
      mockPrismaService.account.findUnique.mockResolvedValue(targetAccount);
      mockPrismaService.contractShare.findUnique.mockResolvedValue(
        existingShare,
      );

      await expect(
        service.shareContract('contract-id', 'target-id'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('unshareContract', () => {
    it('should unshare contract from account', async () => {
      const contract = { id: 'contract-id' };
      const share = { id: 'share-id', contractId: 'contract-id' };

      mockPrismaService.contract.findUnique.mockResolvedValue(contract);
      mockPrismaService.contractShare.findUnique.mockResolvedValue(share);
      mockPrismaService.contractShare.delete.mockResolvedValue(share);

      await service.unshareContract('contract-id', 'target-id');

      expect(mockPrismaService.contractShare.delete).toHaveBeenCalledWith({
        where: {
          contractId_accountId: {
            contractId: 'contract-id',
            accountId: 'target-id',
          },
        },
      });
    });

    it('should throw NotFoundException if contract not found', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue(null);

      await expect(
        service.unshareContract('invalid-id', 'target-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if share not found', async () => {
      const contract = { id: 'contract-id' };

      mockPrismaService.contract.findUnique.mockResolvedValue(contract);
      mockPrismaService.contractShare.findUnique.mockResolvedValue(null);

      await expect(
        service.unshareContract('contract-id', 'target-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getContractShares', () => {
    it('should get all accounts a contract is shared with', async () => {
      const contract = { id: 'contract-id' };
      const shares = [
        {
          id: 'share-1',
          contractId: 'contract-id',
          accountId: 'account-1',
          account: {
            id: 'account-1',
            accountName: 'Account 1',
            accountType: 'enterprise',
            status: 'active',
          },
        },
        {
          id: 'share-2',
          contractId: 'contract-id',
          accountId: 'account-2',
          account: {
            id: 'account-2',
            accountName: 'Account 2',
            accountType: 'enterprise',
            status: 'active',
          },
        },
      ];

      mockPrismaService.contract.findUnique.mockResolvedValue(contract);
      mockPrismaService.contractShare.findMany.mockResolvedValue(shares);

      const result = await service.getContractShares('contract-id');

      expect(result.data).toEqual(shares);
      expect(result.paging.total).toBe(2);
    });

    it('should throw NotFoundException if contract not found', async () => {
      mockPrismaService.contract.findUnique.mockResolvedValue(null);

      await expect(service.getContractShares('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSharedContractsForAccount', () => {
    it('should get all contracts shared with an account', async () => {
      const account = { id: 'account-id' };
      const shares = [
        {
          id: 'share-1',
          contractId: 'contract-1',
          accountId: 'account-id',
          contract: {
            id: 'contract-1',
            contractNumber: 'CNT-001',
            account: { id: 'owner-1', accountName: 'Owner 1' },
          },
        },
        {
          id: 'share-2',
          contractId: 'contract-2',
          accountId: 'account-id',
          contract: {
            id: 'contract-2',
            contractNumber: 'CNT-002',
            account: { id: 'owner-2', accountName: 'Owner 2' },
          },
        },
      ];

      mockPrismaService.account.findUnique.mockResolvedValue(account);
      mockPrismaService.contractShare.findMany.mockResolvedValue(shares);

      const result = await service.getSharedContractsForAccount('account-id');

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('contract-1');
      expect(result.data[1].id).toBe('contract-2');
      expect(result.paging.total).toBe(2);
    });

    it('should throw NotFoundException if account not found', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(null);

      await expect(
        service.getSharedContractsForAccount('invalid-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
