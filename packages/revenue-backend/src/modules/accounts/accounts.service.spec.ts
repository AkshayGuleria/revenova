import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { CreateAccountDto, UpdateAccountDto } from './dto';
import { AccountType, PaymentTerms } from './dto/create-account.dto';
import { AccountStatus } from './dto/update-account.dto';

describe('AccountsService', () => {
  let service: AccountsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    account: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    invoice: {
      aggregate: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('EUR'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
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

    service = module.get<AccountsService>(AccountsService);
    prisma = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue('EUR');
  });

  describe('create', () => {
    const createAccountDto: CreateAccountDto = {
      accountName: 'Acme Corporation',
      primaryContactEmail: 'contact@acme.com',
      accountType: AccountType.ENTERPRISE,
      paymentTerms: PaymentTerms.NET_30,
      currency: 'EUR',
    };

    const mockCreatedAccount = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      ...createAccountDto,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    it('should create a new account successfully', async () => {
      mockPrismaService.account.create.mockResolvedValue(mockCreatedAccount);

      const result = await service.create(createAccountDto);

      expect(result).toEqual({
        data: mockCreatedAccount,
        paging: {
          offset: null,
          limit: null,
          total: null,
          totalPages: null,
          hasNext: null,
          hasPrev: null,
        },
      });
      expect(mockPrismaService.account.create).toHaveBeenCalledWith({
        data: {
          ...createAccountDto,
          parentAccountId: undefined,
        },
      });
    });

    it('should create account with parent', async () => {
      const parentId = 'parent-123';
      const createWithParent = {
        ...createAccountDto,
        parentAccountId: parentId,
      };
      const mockParent = { id: parentId, accountName: 'Parent Corp' };

      mockPrismaService.account.findUnique.mockResolvedValue(mockParent);
      mockPrismaService.account.create.mockResolvedValue({
        ...mockCreatedAccount,
        parentAccountId: parentId,
      });

      const result = await service.create(createWithParent);

      expect(mockPrismaService.account.findUnique).toHaveBeenCalledWith({
        where: { id: parentId },
      });
      expect(result.data.parentAccountId).toBe(parentId);
    });

    it('should throw NotFoundException when parent account does not exist', async () => {
      const createWithParent = {
        ...createAccountDto,
        parentAccountId: 'non-existent-parent',
      };

      mockPrismaService.account.findUnique.mockResolvedValue(null);

      await expect(service.create(createWithParent)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(createWithParent)).rejects.toThrow(
        'Parent account with ID non-existent-parent not found',
      );
    });

    it('should throw ConflictException when email already exists', async () => {
      const prismaError = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
        },
      );

      mockPrismaService.account.create.mockRejectedValue(prismaError);

      await expect(service.create(createAccountDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createAccountDto)).rejects.toThrow(
        'Account with this email already exists',
      );
    });

    it('should apply EUR default when currency is omitted', async () => {
      const dtoWithoutCurrency: CreateAccountDto = {
        accountName: 'No Currency Corp',
        primaryContactEmail: 'test@nocurrency.com',
        accountType: AccountType.ENTERPRISE,
      };
      const mockAccount = {
        id: 'account-no-currency',
        ...dtoWithoutCurrency,
        currency: 'EUR',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockPrismaService.account.create.mockResolvedValue(mockAccount);

      const result = await service.create(dtoWithoutCurrency);

      expect(result.data.currency).toBe('EUR');
      expect(mockPrismaService.account.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currency: 'EUR' }),
        }),
      );
    });

    it('should use explicitly provided currency when given', async () => {
      const dtoWithGbp: CreateAccountDto = {
        accountName: 'GBP Corp',
        primaryContactEmail: 'test@gbp.com',
        accountType: AccountType.ENTERPRISE,
        currency: 'GBP',
      };
      const mockAccount = {
        id: 'account-gbp',
        ...dtoWithGbp,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockPrismaService.account.create.mockResolvedValue(mockAccount);

      const result = await service.create(dtoWithGbp);

      expect(result.data.currency).toBe('GBP');
      expect(mockPrismaService.account.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currency: 'GBP' }),
        }),
      );
    });

    it('should rethrow non-P2002 prisma errors on create', async () => {
      const genericError = new Error('Generic DB error');
      mockPrismaService.account.create.mockRejectedValue(genericError);

      await expect(service.create(createAccountDto)).rejects.toThrow(
        'Generic DB error',
      );
    });

    it('should throw BadRequestException when parentAccountId equals primaryContactEmail (circular hierarchy guard)', async () => {
      // This covers the check: `if (parentAccountId === data.primaryContactEmail)`
      // which is a guard to prevent a degenerate circular hierarchy case
      const circularEmail = 'circular@test.com';
      const dtoWithCircular = {
        accountName: 'Circular Corp',
        primaryContactEmail: circularEmail,
        accountType: AccountType.ENTERPRISE,
        parentAccountId: circularEmail, // same as primaryContactEmail
      };

      // The parent account "exists" (to pass the first check)
      mockPrismaService.account.findUnique.mockResolvedValue({
        id: circularEmail,
        accountName: 'Some Account',
      });

      await expect(service.create(dtoWithCircular as any)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(dtoWithCircular as any)).rejects.toThrow(
        'Cannot create circular account hierarchy',
      );
    });
  });

  describe('findAll', () => {
    const mockAccounts = [
      {
        id: 'account-1',
        accountName: 'Acme Corp',
        status: 'active',
        accountType: 'enterprise',
        parent: null,
        _count: { children: 2, contracts: 5, invoices: 10 },
      },
      {
        id: 'account-2',
        accountName: 'Tech Startup',
        status: 'active',
        accountType: 'startup',
        parent: null,
        _count: { children: 0, contracts: 1, invoices: 3 },
      },
    ];

    it('should return paginated list of accounts', async () => {
      const query = { 'offset[eq]': 0, 'limit[eq]': 20 };

      mockPrismaService.account.findMany.mockResolvedValue(mockAccounts);
      mockPrismaService.account.count.mockResolvedValue(2);

      const result = await service.findAll(query);

      expect(result.data).toEqual(mockAccounts);
      expect(result.paging).toEqual({
        offset: 0,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
      expect(mockPrismaService.account.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should filter by status using eq operator', async () => {
      const query = { 'status[eq]': 'active' };

      mockPrismaService.account.findMany.mockResolvedValue([mockAccounts[0]]);
      mockPrismaService.account.count.mockResolvedValue(1);

      await service.findAll(query);

      expect(mockPrismaService.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'active',
            deletedAt: null,
          },
        }),
      );
    });

    it('should filter by account name using like operator', async () => {
      const query = { 'accountName[like]': 'acme' };

      mockPrismaService.account.findMany.mockResolvedValue([mockAccounts[0]]);
      mockPrismaService.account.count.mockResolvedValue(1);

      await service.findAll(query);

      expect(mockPrismaService.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            accountName: { contains: 'acme', mode: 'insensitive' },
            deletedAt: null,
          },
        }),
      );
    });

    it('should filter by multiple statuses using in operator', async () => {
      const query = { 'status[in]': 'active,suspended' };

      mockPrismaService.account.findMany.mockResolvedValue(mockAccounts);
      mockPrismaService.account.count.mockResolvedValue(2);

      await service.findAll(query);

      expect(mockPrismaService.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { in: ['active', 'suspended'] },
            deletedAt: null,
          },
        }),
      );
    });

    it('should filter accounts without parent using null operator', async () => {
      const query = { 'parentAccountId[null]': true };

      mockPrismaService.account.findMany.mockResolvedValue(mockAccounts);
      mockPrismaService.account.count.mockResolvedValue(2);

      await service.findAll(query);

      expect(mockPrismaService.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            parentAccountId: null,
            deletedAt: null,
          },
        }),
      );
    });

    it('should handle pagination correctly', async () => {
      const query = { 'offset[eq]': 20, 'limit[eq]': 10 };

      mockPrismaService.account.findMany.mockResolvedValue(mockAccounts);
      mockPrismaService.account.count.mockResolvedValue(45);

      const result = await service.findAll(query);

      expect(result.paging).toEqual({
        offset: 20,
        limit: 10,
        total: 45,
        totalPages: 5,
        hasNext: true,
        hasPrev: true,
      });
    });

    it('should always exclude soft-deleted accounts', async () => {
      const query = {};

      mockPrismaService.account.findMany.mockResolvedValue([]);
      mockPrismaService.account.count.mockResolvedValue(0);

      await service.findAll(query);

      expect(mockPrismaService.account.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    const mockAccount = {
      id: 'account-1',
      accountName: 'Acme Corp',
      status: 'active',
      deletedAt: null,
      parent: null,
      children: [],
      contracts: [],
      _count: { children: 0, contracts: 0, invoices: 0 },
    };

    it('should return account by ID', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);

      const result = await service.findOne('account-1');

      expect(result).toEqual({
        data: mockAccount,
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
        where: { id: 'account-1' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when account does not exist', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('non-existent')).rejects.toThrow(
        'Account with ID non-existent not found',
      );
    });

    it('should throw NotFoundException when account is soft-deleted', async () => {
      const deletedAccount = {
        ...mockAccount,
        deletedAt: new Date(),
      };
      mockPrismaService.account.findUnique.mockResolvedValue(deletedAccount);

      await expect(service.findOne('account-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const mockAccount = {
      id: 'account-1',
      accountName: 'Acme Corp',
      status: 'active',
      deletedAt: null,
    };

    const updateAccountDto: UpdateAccountDto = {
      accountName: 'Acme Corporation Updated',
      status: AccountStatus.ACTIVE,
    };

    beforeEach(() => {
      // Mock findOne call that update() uses internally
      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
    });

    it('should update account successfully', async () => {
      const updatedAccount = { ...mockAccount, ...updateAccountDto };
      mockPrismaService.account.update.mockResolvedValue(updatedAccount);

      const result = await service.update('account-1', updateAccountDto);

      expect(result.data).toEqual(updatedAccount);
      expect(mockPrismaService.account.update).toHaveBeenCalledWith({
        where: { id: 'account-1' },
        data: updateAccountDto,
      });
    });

    it('should throw NotFoundException when account does not exist', async () => {
      mockPrismaService.account.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.update('non-existent', updateAccountDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate parent account when updating parentAccountId', async () => {
      const parentId = 'parent-123';
      const mockParent = { id: parentId, accountName: 'Parent Corp' };

      mockPrismaService.account.findUnique
        .mockResolvedValueOnce(mockAccount) // findOne check
        .mockResolvedValueOnce(mockParent) // parent validation
        .mockResolvedValueOnce({ parentAccountId: null }); // circular check

      mockPrismaService.account.update.mockResolvedValue({
        ...mockAccount,
        parentAccountId: parentId,
      });

      await service.update('account-1', { parentAccountId: parentId });

      expect(mockPrismaService.account.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when parent account does not exist', async () => {
      jest.clearAllMocks(); // Clear previous mocks
      mockPrismaService.account.findUnique
        .mockResolvedValueOnce(mockAccount) // findOne check
        .mockResolvedValueOnce(null); // parent validation (returns null, should throw)

      await expect(
        service.update('account-1', { parentAccountId: 'non-existent' }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.account.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when trying to set self as parent', async () => {
      mockPrismaService.account.findUnique.mockResolvedValueOnce(mockAccount);

      await expect(
        service.update('account-1', { parentAccountId: 'account-1' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update('account-1', { parentAccountId: 'account-1' }),
      ).rejects.toThrow('Account cannot be its own parent');
    });

    it('should detect circular hierarchy', async () => {
      const childId = 'child-123';

      jest.clearAllMocks(); // Clear previous mocks

      // Mock account structure: trying to set account-1's parent to child-123
      // where child-123 has account-1 as its parent (creating a circle)
      mockPrismaService.account.findUnique
        .mockResolvedValueOnce(mockAccount) // findOne check
        .mockResolvedValueOnce({ id: childId }) // parent validation - child exists
        .mockResolvedValueOnce({ parentAccountId: 'account-1' }); // circular check - child's parent is account-1

      await expect(
        service.update('account-1', { parentAccountId: childId }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.account.update).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when email already exists', async () => {
      const prismaError = new PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
        },
      );

      mockPrismaService.account.update.mockRejectedValue(prismaError);

      await expect(
        service.update('account-1', {
          primaryContactEmail: 'existing@email.com',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should rethrow non-P2002 prisma errors on update', async () => {
      const genericError = new Error('Generic DB error on update');
      mockPrismaService.account.update.mockRejectedValue(genericError);

      await expect(
        service.update('account-1', { accountName: 'New Name' }),
      ).rejects.toThrow('Generic DB error on update');
    });

    it('should update account when parentAccountId is explicitly set to null', async () => {
      mockPrismaService.account.update.mockResolvedValue({
        ...mockAccount,
        parentAccountId: null,
      });

      const result = await service.update('account-1', {
        parentAccountId: null,
      });

      expect(result.data.parentAccountId).toBeNull();
    });
  });

  describe('remove', () => {
    const mockAccount = {
      id: 'account-1',
      accountName: 'Acme Corp',
      status: 'active',
      deletedAt: null,
    };

    it('should soft delete account', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.account.update.mockResolvedValue({
        ...mockAccount,
        deletedAt: new Date(),
        status: 'inactive',
      });

      await service.remove('account-1');

      expect(mockPrismaService.account.update).toHaveBeenCalledWith({
        where: { id: 'account-1' },
        data: {
          deletedAt: expect.any(Date),
          status: 'inactive',
        },
      });
    });

    it('should throw NotFoundException when account does not exist', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when account is already deleted', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({
        ...mockAccount,
        deletedAt: new Date(),
      });

      await expect(service.remove('account-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('checkCircularHierarchy', () => {
    it('should allow valid parent-child relationship', async () => {
      mockPrismaService.account.findUnique
        .mockResolvedValueOnce({ id: 'account-1', deletedAt: null }) // findOne
        .mockResolvedValueOnce({ id: 'parent-1' }) // parent validation
        .mockResolvedValueOnce({ parentAccountId: null }); // circular check

      mockPrismaService.account.update.mockResolvedValue({
        id: 'account-1',
        parentAccountId: 'parent-1',
      });

      await expect(
        service.update('account-1', { parentAccountId: 'parent-1' }),
      ).resolves.toBeDefined();
    });

    it('should detect multi-level circular hierarchy', async () => {
      // Structure: A -> B -> C, trying to set C's parent to A
      mockPrismaService.account.findUnique
        .mockResolvedValueOnce({ id: 'account-A', deletedAt: null }) // findOne
        .mockResolvedValueOnce({ id: 'account-C' }) // parent validation
        .mockResolvedValueOnce({ parentAccountId: 'account-B' }) // C's parent is B
        .mockResolvedValueOnce({ parentAccountId: 'account-A' }); // B's parent is A

      await expect(
        service.update('account-A', { parentAccountId: 'account-C' }),
      ).rejects.toThrow('Cannot create circular account hierarchy');
    });
  });

  describe('getHierarchy', () => {
    it('should get full account hierarchy tree', async () => {
      const rootAccount = {
        id: 'root-id',
        accountName: 'Root Account',
        parentAccountId: null,
        deletedAt: null,
      };

      const children = [
        {
          id: 'child-1',
          accountName: 'Child 1',
          parentAccountId: 'root-id',
          _count: { children: 0, contracts: 2, invoices: 5 },
        },
        {
          id: 'child-2',
          accountName: 'Child 2',
          parentAccountId: 'root-id',
          _count: { children: 1, contracts: 1, invoices: 3 },
        },
      ];

      jest
        .spyOn(prisma.account, 'findUnique')
        .mockResolvedValueOnce(rootAccount as any);
      jest
        .spyOn(prisma.account, 'findMany')
        .mockResolvedValueOnce(children as any);
      jest.spyOn(prisma.account, 'findMany').mockResolvedValueOnce([] as any); // child-1 has no children
      jest.spyOn(prisma.account, 'findMany').mockResolvedValueOnce([] as any); // child-2 has no children

      const result = await service.getHierarchy('root-id');

      expect(result.data).toBeDefined();
      expect(result.data.id).toBe('root-id');
      expect(result.data.children).toHaveLength(2);
      expect(result.paging.offset).toBeNull();
    });

    it('should throw NotFoundException if account not found', async () => {
      jest.spyOn(prisma.account, 'findUnique').mockResolvedValueOnce(null);

      await expect(service.getHierarchy('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getChildren', () => {
    it('should get direct children of an account', async () => {
      const parent = { id: 'parent-id', deletedAt: null };
      const children = [
        {
          id: 'child-1',
          accountName: 'Child 1',
          parentAccountId: 'parent-id',
          _count: { children: 0, contracts: 2, invoices: 5 },
        },
        {
          id: 'child-2',
          accountName: 'Child 2',
          parentAccountId: 'parent-id',
          _count: { children: 1, contracts: 1, invoices: 3 },
        },
      ];

      jest
        .spyOn(prisma.account, 'findUnique')
        .mockResolvedValueOnce(parent as any);
      jest
        .spyOn(prisma.account, 'findMany')
        .mockResolvedValueOnce(children as any);

      const result = await service.getChildren('parent-id');

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('child-1');
      expect(result.data[1].id).toBe('child-2');
      expect(result.paging.total).toBe(2);
    });

    it('should return empty array if no children', async () => {
      const parent = { id: 'parent-id', deletedAt: null };

      jest
        .spyOn(prisma.account, 'findUnique')
        .mockResolvedValueOnce(parent as any);
      jest.spyOn(prisma.account, 'findMany').mockResolvedValueOnce([]);

      const result = await service.getChildren('parent-id');

      expect(result.data).toHaveLength(0);
      expect(result.paging.total).toBe(0);
    });

    it('should throw NotFoundException if parent not found', async () => {
      jest.spyOn(prisma.account, 'findUnique').mockResolvedValueOnce(null);

      await expect(service.getChildren('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAncestors', () => {
    it('should get all ancestors of an account', async () => {
      const account = {
        id: 'child-id',
        parentAccountId: 'parent-id',
        deletedAt: null,
      };
      const parent = {
        id: 'parent-id',
        accountName: 'Parent',
        parentAccountId: 'grandparent-id',
        deletedAt: null,
      };
      const grandparent = {
        id: 'grandparent-id',
        accountName: 'Grandparent',
        parentAccountId: null,
        deletedAt: null,
      };

      jest
        .spyOn(prisma.account, 'findUnique')
        .mockResolvedValueOnce(account as any)
        .mockResolvedValueOnce(parent as any)
        .mockResolvedValueOnce(grandparent as any);

      const result = await service.getAncestors('child-id');

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('grandparent-id'); // Top-most ancestor first
      expect(result.data[1].id).toBe('parent-id');
      expect(result.paging.total).toBe(2);
    });

    it('should return empty array if no ancestors', async () => {
      const account = { id: 'root-id', parentAccountId: null, deletedAt: null };

      jest
        .spyOn(prisma.account, 'findUnique')
        .mockResolvedValueOnce(account as any);

      const result = await service.getAncestors('root-id');

      expect(result.data).toHaveLength(0);
      expect(result.paging.total).toBe(0);
    });

    it('should throw NotFoundException if account not found', async () => {
      jest.spyOn(prisma.account, 'findUnique').mockResolvedValueOnce(null);

      await expect(service.getAncestors('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should stop traversal if a parent account is deleted', async () => {
      const account = {
        id: 'child-id',
        parentAccountId: 'parent-id',
        deletedAt: null,
      };
      const deletedParent = {
        id: 'parent-id',
        parentAccountId: null,
        deletedAt: new Date(),
      };

      jest
        .spyOn(prisma.account, 'findUnique')
        .mockResolvedValueOnce(account as any)
        .mockResolvedValueOnce(deletedParent as any);

      const result = await service.getAncestors('child-id');

      // Deleted parent should be excluded
      expect(result.data).toHaveLength(0);
    });
  });

  describe('getDescendants', () => {
    it('should get all descendants as flat list', async () => {
      const account = { id: 'root-id', deletedAt: null };
      const children = [
        { id: 'child-1', accountName: 'Child 1', parentAccountId: 'root-id' },
        { id: 'child-2', accountName: 'Child 2', parentAccountId: 'root-id' },
      ];
      const grandchildren = [
        {
          id: 'grandchild-1',
          accountName: 'Grandchild 1',
          parentAccountId: 'child-1',
        },
      ];

      jest
        .spyOn(prisma.account, 'findUnique')
        .mockResolvedValueOnce(account as any);
      jest
        .spyOn(prisma.account, 'findMany')
        .mockResolvedValueOnce(children as any)
        .mockResolvedValueOnce(grandchildren as any)
        .mockResolvedValueOnce([]) // child-1 has no more descendants
        .mockResolvedValueOnce([]); // child-2 has no descendants

      const result = await service.getDescendants('root-id');

      expect(result.data).toHaveLength(3);
      expect(result.data.some((d) => d.id === 'child-1')).toBe(true);
      expect(result.data.some((d) => d.id === 'child-2')).toBe(true);
      expect(result.data.some((d) => d.id === 'grandchild-1')).toBe(true);
    });

    it('should return empty array if no descendants', async () => {
      const account = { id: 'leaf-id', deletedAt: null };

      jest
        .spyOn(prisma.account, 'findUnique')
        .mockResolvedValueOnce(account as any);
      jest.spyOn(prisma.account, 'findMany').mockResolvedValueOnce([]);

      const result = await service.getDescendants('leaf-id');

      expect(result.data).toHaveLength(0);
      expect(result.paging.total).toBe(0);
    });

    it('should throw NotFoundException if account not found for getDescendants', async () => {
      jest.spyOn(prisma.account, 'findUnique').mockResolvedValueOnce(null);

      await expect(service.getDescendants('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should stop descendant traversal at maxDepth (5 levels)', async () => {
      // This covers the `if (currentDepth >= maxDepth) return;` branch (line 423)
      // by setting up 5 levels of children so the 6th level call exits early
      const rootAccount = { id: 'root-id', deletedAt: null };

      // Save originals
      const originalFindUnique = mockPrismaService.account.findUnique;
      const originalFindMany = mockPrismaService.account.findMany;

      mockPrismaService.account.findUnique = jest
        .fn()
        .mockResolvedValue(rootAccount);

      // Build 5 levels: each level has one child
      const levels = [
        [{ id: 'l1', accountName: 'L1', parentAccountId: 'root-id' }],
        [{ id: 'l2', accountName: 'L2', parentAccountId: 'l1' }],
        [{ id: 'l3', accountName: 'L3', parentAccountId: 'l2' }],
        [{ id: 'l4', accountName: 'L4', parentAccountId: 'l3' }],
        [{ id: 'l5', accountName: 'L5', parentAccountId: 'l4' }],
        // At depth=5 (maxDepth), collectDescendants returns early without calling findMany
      ];
      let callCount = 0;
      mockPrismaService.account.findMany = jest.fn().mockImplementation(() => {
        const result = levels[callCount] ?? [];
        callCount++;
        return Promise.resolve(result);
      });

      const result = await service.getDescendants('root-id');

      // Restore originals
      mockPrismaService.account.findUnique = originalFindUnique;
      mockPrismaService.account.findMany = originalFindMany;

      // All 5 descendants should be collected
      expect(result.data).toHaveLength(5);
      // Exactly 5 findMany calls (depths 0-4); depth 5 returns early without a findMany call
      expect(callCount).toBe(5);
    });
  });

  describe('getHierarchy — maxDepth boundary', () => {
    it('should stop recursion at maxDepth', async () => {
      const rootAccount = {
        id: 'root-id',
        accountName: 'Root Account',
        parentAccountId: null,
        deletedAt: null,
      };

      // getHierarchy with maxDepth=0 should return children: []
      jest
        .spyOn(prisma.account, 'findUnique')
        .mockResolvedValueOnce(rootAccount as any);

      const result = await service.getHierarchy('root-id', 0);

      expect(result.data).toBeDefined();
      // At maxDepth=0, buildAccountTree returns { ...account, children: [] }
      expect(result.data.children).toHaveLength(0);
    });
  });

  describe('getCreditStatus', () => {
    const mockAccountWithCredit = {
      id: 'acc-credit-1',
      accountName: 'Acme Corp',
      creditLimit: '100000',
      creditHold: false,
      currency: 'EUR',
    };

    it('should return credit status with utilization percentage', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(
        mockAccountWithCredit,
      );
      mockPrismaService.invoice.aggregate.mockResolvedValue({
        _sum: { total: '25000' },
      });

      const result = await service.getCreditStatus('acc-credit-1');

      expect(result.data).toMatchObject({
        accountId: 'acc-credit-1',
        accountName: 'Acme Corp',
        currency: 'EUR',
        creditLimit: 100000,
        creditHold: false,
        totalOutstanding: 25000,
        availableCredit: 75000,
        utilizationPercent: 25,
      });
      expect(result.paging.offset).toBeNull();
    });

    it('should return null availableCredit and utilizationPercent when no credit limit set', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({
        ...mockAccountWithCredit,
        creditLimit: null,
      });
      mockPrismaService.invoice.aggregate.mockResolvedValue({
        _sum: { total: '5000' },
      });

      const result = await service.getCreditStatus('acc-credit-1');

      expect(result.data.creditLimit).toBeNull();
      expect(result.data.availableCredit).toBeNull();
      expect(result.data.utilizationPercent).toBeNull();
      expect(result.data.totalOutstanding).toBe(5000);
    });

    it('should return zero outstanding when no invoices exist', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(
        mockAccountWithCredit,
      );
      mockPrismaService.invoice.aggregate.mockResolvedValue({
        _sum: { total: null },
      });

      const result = await service.getCreditStatus('acc-credit-1');

      expect(result.data.totalOutstanding).toBe(0);
      expect(result.data.availableCredit).toBe(100000);
      expect(result.data.utilizationPercent).toBe(0);
    });

    it('should query aggregate with correct status filter', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(
        mockAccountWithCredit,
      );
      mockPrismaService.invoice.aggregate.mockResolvedValue({
        _sum: { total: null },
      });

      await service.getCreditStatus('acc-credit-1');

      expect(mockPrismaService.invoice.aggregate).toHaveBeenCalledWith({
        where: { accountId: 'acc-credit-1', status: { in: ['sent', 'overdue'] } },
        _sum: { total: true },
      });
    });

    it('should throw NotFoundException for unknown account', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(null);

      await expect(service.getCreditStatus('unknown-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getCreditStatus('unknown-id')).rejects.toThrow(
        'Account unknown-id not found',
      );
    });

    it('should return null utilizationPercent when creditLimit is zero', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({
        ...mockAccountWithCredit,
        creditLimit: '0',
      });
      mockPrismaService.invoice.aggregate.mockResolvedValue({
        _sum: { total: '1000' },
      });

      const result = await service.getCreditStatus('acc-credit-1');

      expect(result.data.utilizationPercent).toBeNull();
    });
  });

  describe('updateCredit', () => {
    const mockAccount = {
      id: 'acc-update-1',
      accountName: 'Test Corp',
      creditLimit: '50000',
      creditHold: false,
    };

    it('should update creditLimit successfully', async () => {
      const updatedAccount = { ...mockAccount, creditLimit: '200000' };
      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.account.update.mockResolvedValue(updatedAccount);

      const result = await service.updateCredit('acc-update-1', {
        creditLimit: 200000,
      });

      expect(mockPrismaService.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-update-1' },
        data: { creditLimit: 200000 },
      });
      expect(result.data).toEqual(updatedAccount);
      expect(result.paging.offset).toBeNull();
    });

    it('should set creditHold to true', async () => {
      const updatedAccount = { ...mockAccount, creditHold: true };
      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.account.update.mockResolvedValue(updatedAccount);

      const result = await service.updateCredit('acc-update-1', {
        creditHold: true,
      });

      expect(mockPrismaService.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-update-1' },
        data: { creditHold: true },
      });
      expect(result.data.creditHold).toBe(true);
    });

    it('should set creditHold to false (release hold)', async () => {
      const accountOnHold = { ...mockAccount, creditHold: true };
      const updatedAccount = { ...mockAccount, creditHold: false };
      mockPrismaService.account.findUnique.mockResolvedValue(accountOnHold);
      mockPrismaService.account.update.mockResolvedValue(updatedAccount);

      const result = await service.updateCredit('acc-update-1', {
        creditHold: false,
      });

      expect(mockPrismaService.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-update-1' },
        data: { creditHold: false },
      });
      expect(result.data.creditHold).toBe(false);
    });

    it('should update both creditLimit and creditHold simultaneously', async () => {
      const updatedAccount = {
        ...mockAccount,
        creditLimit: '150000',
        creditHold: true,
      };
      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.account.update.mockResolvedValue(updatedAccount);

      await service.updateCredit('acc-update-1', {
        creditLimit: 150000,
        creditHold: true,
      });

      expect(mockPrismaService.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-update-1' },
        data: { creditLimit: 150000, creditHold: true },
      });
    });

    it('should not include undefined fields in update data', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.account.update.mockResolvedValue(mockAccount);

      await service.updateCredit('acc-update-1', {});

      expect(mockPrismaService.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-update-1' },
        data: {},
      });
    });

    it('should throw NotFoundException for unknown account', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(null);

      await expect(
        service.updateCredit('unknown-id', { creditHold: true }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateCredit('unknown-id', { creditHold: true }),
      ).rejects.toThrow('Account unknown-id not found');
    });
  });
});
