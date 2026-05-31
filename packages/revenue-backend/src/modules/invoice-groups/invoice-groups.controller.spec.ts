import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceGroupsController } from './invoice-groups.controller';
import { InvoiceGroupsService } from './invoice-groups.service';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  CreateInvoiceGroupDto,
  UpdateInvoiceGroupDto,
  QueryInvoiceGroupsDto,
  InvoiceGroupType,
} from './dto';

describe('InvoiceGroupsController', () => {
  let controller: InvoiceGroupsController;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockGroup = {
    id: 'group-id-1',
    accountId: 'account-id-1',
    name: 'Engineering Department',
    groupType: InvoiceGroupType.DEPARTMENT,
    code: 'DEPT-ENG',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    account: { id: 'account-id-1', accountName: 'Acme Corp' },
    _count: { invoices: 0 },
  };

  const singleResponse = {
    data: mockGroup,
    paging: {
      offset: null,
      limit: null,
      total: null,
      totalPages: null,
      hasNext: null,
      hasPrev: null,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoiceGroupsController],
      providers: [{ provide: InvoiceGroupsService, useValue: mockService }],
    }).compile();

    controller = module.get<InvoiceGroupsController>(InvoiceGroupsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // POST /api/invoice-groups
  // ---------------------------------------------------------------------------

  describe('create', () => {
    const dto: CreateInvoiceGroupDto = {
      accountId: 'account-id-1',
      name: 'Engineering Department',
      groupType: InvoiceGroupType.DEPARTMENT,
      code: 'DEPT-ENG',
    };

    it('delegates to service and returns result', async () => {
      mockService.create.mockResolvedValue(singleResponse);

      const result = await controller.create(dto);

      expect(mockService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(singleResponse);
    });

    it('propagates NotFoundException when account does not exist', async () => {
      mockService.create.mockRejectedValue(
        new NotFoundException('Account with ID account-id-1 not found'),
      );

      await expect(controller.create(dto)).rejects.toThrow(NotFoundException);
    });

    it('propagates ConflictException on duplicate type+code', async () => {
      mockService.create.mockRejectedValue(
        new ConflictException(
          'An invoice group with this groupType and code already exists',
        ),
      );

      await expect(controller.create(dto)).rejects.toThrow(ConflictException);
    });

    it('creates group without optional fields (code, metadata)', async () => {
      const minimalDto: CreateInvoiceGroupDto = {
        accountId: 'account-id-1',
        name: 'Custom Group',
        groupType: InvoiceGroupType.CUSTOM,
      };
      mockService.create.mockResolvedValue({
        data: { id: 'g-2', ...minimalDto },
        paging: singleResponse.paging,
      });

      const result = await controller.create(minimalDto);

      expect(mockService.create).toHaveBeenCalledWith(minimalDto);
      expect(result.data).toMatchObject({ name: 'Custom Group' });
    });

    it('passes metadata through to service', async () => {
      const dtoWithMeta: CreateInvoiceGroupDto = {
        ...dto,
        metadata: { costCenterId: '4400', approver: 'john@acme.com' },
      };
      mockService.create.mockResolvedValue(singleResponse);

      await controller.create(dtoWithMeta);

      expect(mockService.create).toHaveBeenCalledWith(dtoWithMeta);
    });

    it('supports all group types', async () => {
      const types = [
        InvoiceGroupType.DEPARTMENT,
        InvoiceGroupType.COST_CENTER,
        InvoiceGroupType.LOCATION,
        InvoiceGroupType.CUSTOM,
      ];
      mockService.create.mockResolvedValue(singleResponse);

      for (const groupType of types) {
        await controller.create({ ...dto, groupType });
        expect(mockService.create).toHaveBeenCalledWith(
          expect.objectContaining({ groupType }),
        );
      }
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/invoice-groups
  // ---------------------------------------------------------------------------

  describe('findAll', () => {
    const paginatedResponse = {
      data: [mockGroup],
      paging: {
        offset: 0,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    };

    it('delegates to service with query and returns paginated result', async () => {
      mockService.findAll.mockResolvedValue(paginatedResponse);
      const query: QueryInvoiceGroupsDto = {};

      const result = await controller.findAll(query);

      expect(mockService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(paginatedResponse);
    });

    it('passes accountId filter to service', async () => {
      mockService.findAll.mockResolvedValue(paginatedResponse);
      const query: QueryInvoiceGroupsDto = { 'accountId[eq]': 'account-id-1' };

      await controller.findAll(query);

      expect(mockService.findAll).toHaveBeenCalledWith(query);
    });

    it('passes groupType filter to service', async () => {
      mockService.findAll.mockResolvedValue(paginatedResponse);
      const query: QueryInvoiceGroupsDto = {
        'groupType[eq]': InvoiceGroupType.COST_CENTER,
      };

      await controller.findAll(query);

      expect(mockService.findAll).toHaveBeenCalledWith(query);
    });

    it('passes name and code like filters to service', async () => {
      mockService.findAll.mockResolvedValue(paginatedResponse);
      const query: QueryInvoiceGroupsDto = {
        'name[like]': 'Engineering',
        'code[like]': 'DEPT',
      };

      await controller.findAll(query);

      expect(mockService.findAll).toHaveBeenCalledWith(query);
    });

    it('passes pagination params to service', async () => {
      mockService.findAll.mockResolvedValue(paginatedResponse);
      const query: QueryInvoiceGroupsDto = {
        'offset[eq]': '40',
        'limit[eq]': '10',
      } as any;

      await controller.findAll(query);

      expect(mockService.findAll).toHaveBeenCalledWith(query);
    });

    it('returns empty list when no groups exist', async () => {
      mockService.findAll.mockResolvedValue({
        data: [],
        paging: {
          offset: 0,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      });

      const result = await controller.findAll({});

      expect(result.data).toHaveLength(0);
      expect((result.paging as any).total).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/invoice-groups/:id
  // ---------------------------------------------------------------------------

  describe('findOne', () => {
    it('delegates to service and returns single group', async () => {
      mockService.findOne.mockResolvedValue(singleResponse);

      const result = await controller.findOne('group-id-1');

      expect(mockService.findOne).toHaveBeenCalledWith('group-id-1');
      expect(result).toEqual(singleResponse);
    });

    it('propagates NotFoundException when group does not exist', async () => {
      mockService.findOne.mockRejectedValue(
        new NotFoundException('Invoice group with ID bad-id not found'),
      );

      await expect(controller.findOne('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('passes the exact id parameter to service', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      mockService.findOne.mockResolvedValue(singleResponse);

      await controller.findOne(uuid);

      expect(mockService.findOne).toHaveBeenCalledWith(uuid);
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/invoice-groups/:id
  // ---------------------------------------------------------------------------

  describe('update', () => {
    const updateDto: UpdateInvoiceGroupDto = { name: 'Updated Name' };

    it('delegates to service and returns updated group', async () => {
      const updatedResponse = {
        ...singleResponse,
        data: { ...mockGroup, name: 'Updated Name' },
      };
      mockService.update.mockResolvedValue(updatedResponse);

      const result = await controller.update('group-id-1', updateDto);

      expect(mockService.update).toHaveBeenCalledWith('group-id-1', updateDto);
      expect(result).toEqual(updatedResponse);
    });

    it('propagates NotFoundException when group does not exist', async () => {
      mockService.update.mockRejectedValue(
        new NotFoundException('Invoice group with ID bad-id not found'),
      );

      await expect(controller.update('bad-id', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('propagates ConflictException on duplicate code conflict', async () => {
      mockService.update.mockRejectedValue(
        new ConflictException(
          'An invoice group with this groupType and code already exists',
        ),
      );

      await expect(
        controller.update('group-id-1', { code: 'DUPLICATE' }),
      ).rejects.toThrow(ConflictException);
    });

    it('passes partial update (only code) through to service', async () => {
      mockService.update.mockResolvedValue(singleResponse);
      const partialDto: UpdateInvoiceGroupDto = { code: 'DEPT-QA' };

      await controller.update('group-id-1', partialDto);

      expect(mockService.update).toHaveBeenCalledWith('group-id-1', partialDto);
    });

    it('passes metadata update through to service', async () => {
      mockService.update.mockResolvedValue(singleResponse);
      const dto: UpdateInvoiceGroupDto = {
        metadata: { costCenterId: '9900', approver: 'new@acme.com' },
      };

      await controller.update('group-id-1', dto);

      expect(mockService.update).toHaveBeenCalledWith('group-id-1', dto);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/invoice-groups/:id
  // ---------------------------------------------------------------------------

  describe('remove', () => {
    it('delegates to service and returns undefined (204 No Content)', async () => {
      mockService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('group-id-1');

      expect(mockService.remove).toHaveBeenCalledWith('group-id-1');
      expect(result).toBeUndefined();
    });

    it('propagates NotFoundException when group does not exist', async () => {
      mockService.remove.mockRejectedValue(
        new NotFoundException('Invoice group with ID bad-id not found'),
      );

      await expect(controller.remove('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('propagates BadRequestException when group has attached invoices', async () => {
      mockService.remove.mockRejectedValue(
        new BadRequestException(
          'Cannot delete invoice group "Eng" — it has 3 attached invoice(s).',
        ),
      );

      await expect(controller.remove('group-id-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('passes the exact id to service', async () => {
      mockService.remove.mockResolvedValue(undefined);
      const uuid = '550e8400-e29b-41d4-a716-446655440000';

      await controller.remove(uuid);

      expect(mockService.remove).toHaveBeenCalledWith(uuid);
    });
  });
});
