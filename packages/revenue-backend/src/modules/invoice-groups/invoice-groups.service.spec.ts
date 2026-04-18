import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceGroupsService } from './invoice-groups.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import {
  CreateInvoiceGroupDto,
  InvoiceGroupType,
  UpdateInvoiceGroupDto,
} from './dto';

describe('InvoiceGroupsService', () => {
  let service: InvoiceGroupsService;

  const mockPrismaService = {
    invoiceGroup: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    account: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceGroupsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<InvoiceGroupsService>(InvoiceGroupsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    const createDto: CreateInvoiceGroupDto = {
      accountId: 'account-id-1',
      name: 'Engineering Department',
      groupType: InvoiceGroupType.DEPARTMENT,
      code: 'DEPT-ENG',
    };

    const mockGroup = {
      id: 'group-id-1',
      ...createDto,
      createdAt: new Date(),
      updatedAt: new Date(),
      account: { id: 'account-id-1', accountName: 'Acme Corp' },
      _count: { invoices: 0 },
    };

    it('creates a group successfully', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({
        id: 'account-id-1',
      });
      mockPrismaService.invoiceGroup.create.mockResolvedValue(mockGroup);

      const result = await service.create(createDto);

      expect(result.data).toEqual(mockGroup);
      expect(result.paging).toMatchObject({ offset: null, total: null });
      expect(mockPrismaService.invoiceGroup.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountId: 'account-id-1',
            name: 'Engineering Department',
          }),
        }),
      );
    });

    it('throws NotFoundException when account does not exist', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException on duplicate type+code', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({
        id: 'account-id-1',
      });
      mockPrismaService.invoiceGroup.create.mockRejectedValue(
        new PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: '5.0',
        }),
      );

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('re-throws non-P2002 Prisma errors from create without wrapping', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({
        id: 'account-id-1',
      });
      const dbError = new PrismaClientKnownRequestError('Foreign key violation', {
        code: 'P2003',
        clientVersion: '5.0',
      });
      mockPrismaService.invoiceGroup.create.mockRejectedValue(dbError);

      await expect(service.create(createDto)).rejects.toThrow(dbError);
      await expect(service.create(createDto)).rejects.not.toThrow(
        ConflictException,
      );
    });

    it('re-throws non-Prisma errors from create as-is', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({
        id: 'account-id-1',
      });
      const unexpectedError = new Error('Unexpected DB connection error');
      mockPrismaService.invoiceGroup.create.mockRejectedValue(unexpectedError);

      await expect(service.create(createDto)).rejects.toThrow(
        'Unexpected DB connection error',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------

  describe('findAll', () => {
    it('returns paginated list of groups', async () => {
      const mockGroups = [
        { id: 'group-1', name: 'Eng', account: {}, _count: { invoices: 2 } },
      ];
      mockPrismaService.invoiceGroup.findMany.mockResolvedValue(mockGroups);
      mockPrismaService.invoiceGroup.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.data).toEqual(mockGroups);
      expect((result.paging as any).total).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------

  describe('findOne', () => {
    it('returns a group when found', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Eng',
        account: {},
        _count: { invoices: 1 },
      };
      mockPrismaService.invoiceGroup.findUnique.mockResolvedValue(mockGroup);

      const result = await service.findOne('group-1');

      expect(result.data).toEqual(mockGroup);
    });

    it('throws NotFoundException when group does not exist', async () => {
      mockPrismaService.invoiceGroup.findUnique.mockResolvedValue(null);

      await expect(service.findOne('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  describe('update', () => {
    it('updates a group successfully', async () => {
      const existing = {
        id: 'group-1',
        name: 'Eng',
        account: {},
        _count: { invoices: 0 },
      };
      const updated = { ...existing, name: 'Engineering Dept' };
      mockPrismaService.invoiceGroup.findUnique.mockResolvedValue(existing);
      mockPrismaService.invoiceGroup.update.mockResolvedValue(updated);

      const dto: UpdateInvoiceGroupDto = { name: 'Engineering Dept' };
      const result = await service.update('group-1', dto);

      expect(result.data).toEqual(updated);
      expect(mockPrismaService.invoiceGroup.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'group-1' }, data: dto }),
      );
    });

    it('throws NotFoundException when group does not exist', async () => {
      mockPrismaService.invoiceGroup.findUnique.mockResolvedValue(null);

      await expect(service.update('bad-id', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException on P2002 during update (duplicate code)', async () => {
      const existing = {
        id: 'group-1',
        name: 'Eng',
        account: {},
        _count: { invoices: 0 },
      };
      mockPrismaService.invoiceGroup.findUnique.mockResolvedValue(existing);
      mockPrismaService.invoiceGroup.update.mockRejectedValue(
        new PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: '5.0',
        }),
      );

      await expect(service.update('group-1', { code: 'TAKEN' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('re-throws non-P2002 Prisma errors from update without wrapping', async () => {
      const existing = {
        id: 'group-1',
        name: 'Eng',
        account: {},
        _count: { invoices: 0 },
      };
      const dbError = new PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0',
      });
      mockPrismaService.invoiceGroup.findUnique.mockResolvedValue(existing);
      mockPrismaService.invoiceGroup.update.mockRejectedValue(dbError);

      await expect(service.update('group-1', { name: 'X' })).rejects.toThrow(
        dbError,
      );
      await expect(
        service.update('group-1', { name: 'X' }),
      ).rejects.not.toThrow(ConflictException);
    });

    it('re-throws non-Prisma errors from update as-is', async () => {
      const existing = {
        id: 'group-1',
        name: 'Eng',
        account: {},
        _count: { invoices: 0 },
      };
      mockPrismaService.invoiceGroup.findUnique.mockResolvedValue(existing);
      mockPrismaService.invoiceGroup.update.mockRejectedValue(
        new Error('Unexpected error'),
      );

      await expect(service.update('group-1', { name: 'X' })).rejects.toThrow(
        'Unexpected error',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // remove
  // ---------------------------------------------------------------------------

  describe('remove', () => {
    it('deletes a group with no attached invoices', async () => {
      mockPrismaService.invoiceGroup.findUnique.mockResolvedValue({
        id: 'group-1',
        name: 'Eng',
        _count: { invoices: 0 },
      });
      mockPrismaService.invoiceGroup.delete.mockResolvedValue({});

      await expect(service.remove('group-1')).resolves.toBeUndefined();
      expect(mockPrismaService.invoiceGroup.delete).toHaveBeenCalledWith({
        where: { id: 'group-1' },
      });
    });

    it('throws BadRequestException when group has attached invoices', async () => {
      mockPrismaService.invoiceGroup.findUnique.mockResolvedValue({
        id: 'group-1',
        name: 'Eng',
        _count: { invoices: 3 },
      });

      await expect(service.remove('group-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.invoiceGroup.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when group does not exist', async () => {
      mockPrismaService.invoiceGroup.findUnique.mockResolvedValue(null);

      await expect(service.remove('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
