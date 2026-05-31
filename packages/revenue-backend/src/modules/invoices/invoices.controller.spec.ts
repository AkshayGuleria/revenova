import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { CreditHoldGuard } from '../credit-management/credit-hold.guard';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  QueryInvoicesDto,
  CreateInvoiceItemDto,
  CreateSubInvoiceDto,
} from './dto';

describe('InvoicesController', () => {
  let controller: InvoicesController;
  let service: InvoicesService;

  const mockInvoicesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    addLineItem: jest.fn(),
    removeLineItem: jest.fn(),
    getSubInvoices: jest.fn(),
    createSubInvoice: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [
        {
          provide: InvoicesService,
          useValue: mockInvoicesService,
        },
      ],
    })
      .overrideGuard(CreditHoldGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InvoicesController>(InvoicesController);
    service = module.get<InvoicesService>(InvoicesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with dto', async () => {
      const dto: CreateInvoiceDto = {
        invoiceNumber: 'INV-001',
        accountId: 'account-123',
        contractId: 'contract-123',
        issueDate: '2024-01-01',
        dueDate: '2024-01-31',
      };

      const result = { data: { id: '123' }, paging: {} };
      mockInvoicesService.create.mockResolvedValue(result);

      expect(await controller.create(dto)).toBe(result);
      expect(service.create).toHaveBeenCalledWith(dto);
      expect(service.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with query', async () => {
      const query: QueryInvoicesDto = {};
      const result = { data: [], paging: {} };
      mockInvoicesService.findAll.mockResolvedValue(result);

      expect(await controller.findAll(query)).toBe(result);
      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(service.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with id', async () => {
      const id = '123';
      const result = { data: { id: '123' }, paging: {} };
      mockInvoicesService.findOne.mockResolvedValue(result);

      expect(await controller.findOne(id)).toBe(result);
      expect(service.findOne).toHaveBeenCalledWith(id);
      expect(service.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('should call service.update with id and dto', async () => {
      const id = '123';
      const dto: UpdateInvoiceDto = { status: 'paid' as any };
      const result = { data: { id: '123' }, paging: {} };
      mockInvoicesService.update.mockResolvedValue(result);

      expect(await controller.update(id, dto)).toBe(result);
      expect(service.update).toHaveBeenCalledWith(id, dto);
      expect(service.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove', () => {
    it('should call service.remove with id', async () => {
      const id = '123';
      mockInvoicesService.remove.mockResolvedValue(undefined);

      await controller.remove(id);
      expect(service.remove).toHaveBeenCalledWith(id);
      expect(service.remove).toHaveBeenCalledTimes(1);
    });
  });

  describe('addLineItem', () => {
    it('should call service.addLineItem with id and dto', async () => {
      const id = '123';
      const dto: CreateInvoiceItemDto = {
        description: 'Test item',
        quantity: 1,
        unitPrice: 100,
        amount: 100,
      };
      const result = { data: { id: 'item-123' }, paging: {} };
      mockInvoicesService.addLineItem.mockResolvedValue(result);

      expect(await controller.addLineItem(id, dto)).toBe(result);
      expect(service.addLineItem).toHaveBeenCalledWith(id, dto);
      expect(service.addLineItem).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeLineItem', () => {
    it('should call service.removeLineItem with invoiceId and itemId', async () => {
      const invoiceId = '123';
      const itemId = 'item-456';
      mockInvoicesService.removeLineItem.mockResolvedValue(undefined);

      await controller.removeLineItem(invoiceId, itemId);
      expect(service.removeLineItem).toHaveBeenCalledWith(invoiceId, itemId);
      expect(service.removeLineItem).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Sub-invoice endpoints
  // ---------------------------------------------------------------------------

  describe('getSubInvoices', () => {
    it('should call service.getSubInvoices with parent id and query', async () => {
      const parentId = 'parent-invoice-123';
      const query: QueryInvoicesDto = {};
      const result = {
        data: [
          {
            id: 'sub-1',
            invoiceNumber: 'INV-001-A',
            parentInvoiceId: parentId,
          },
        ],
        paging: {
          offset: 0,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };
      mockInvoicesService.getSubInvoices.mockResolvedValue(result);

      expect(await controller.getSubInvoices(parentId, query)).toBe(result);
      expect(service.getSubInvoices).toHaveBeenCalledWith(parentId, query);
      expect(service.getSubInvoices).toHaveBeenCalledTimes(1);
    });
  });

  describe('createSubInvoice', () => {
    it('should call service.createSubInvoice with parent id and dto', async () => {
      const parentId = 'parent-invoice-123';
      const dto: CreateSubInvoiceDto = {
        subtotal: 5000,
        tax: 400,
        discount: 0,
        total: 5400,
      };
      const result = {
        data: {
          id: 'sub-1',
          invoiceNumber: 'INV-001-A',
          parentInvoiceId: parentId,
          ...dto,
        },
        paging: {
          offset: null,
          limit: null,
          total: null,
          totalPages: null,
          hasNext: null,
          hasPrev: null,
        },
      };
      mockInvoicesService.createSubInvoice.mockResolvedValue(result);

      expect(await controller.createSubInvoice(parentId, dto)).toBe(result);
      expect(service.createSubInvoice).toHaveBeenCalledWith(parentId, dto);
      expect(service.createSubInvoice).toHaveBeenCalledTimes(1);
    });
  });
});
