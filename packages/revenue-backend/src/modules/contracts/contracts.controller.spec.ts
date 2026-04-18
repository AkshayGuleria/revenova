import { Test, TestingModule } from '@nestjs/testing';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import {
  CreateContractDto,
  UpdateContractDto,
  QueryContractsDto,
  ContractStatus,
  ShareContractDto,
} from './dto';
import { CreateContractProductDto } from './dto/contract-product.dto';

describe('ContractsController', () => {
  let controller: ContractsController;
  let service: ContractsService;

  const mockContractsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findProducts: jest.fn(),
    addProduct: jest.fn(),
    removeProduct: jest.fn(),
    shareContract: jest.fn(),
    unshareContract: jest.fn(),
    getContractShares: jest.fn(),
    getSharedContractsForAccount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContractsController],
      providers: [
        {
          provide: ContractsService,
          useValue: mockContractsService,
        },
      ],
    }).compile();

    controller = module.get<ContractsController>(ContractsController);
    service = module.get<ContractsService>(ContractsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with dto', async () => {
      const dto: CreateContractDto = {
        contractNumber: 'CNT-001',
        accountId: 'account-123',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        contractValue: 120000,
        products: [{ productId: 'product-uuid-123', quantity: 10 }],
      };

      const result = { data: { id: '123' }, paging: {} };
      mockContractsService.create.mockResolvedValue(result);

      expect(await controller.create(dto)).toBe(result);
      expect(service.create).toHaveBeenCalledWith(dto);
      expect(service.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with query', async () => {
      const query: QueryContractsDto = {};
      const result = { data: [], paging: {} };
      mockContractsService.findAll.mockResolvedValue(result);

      expect(await controller.findAll(query)).toBe(result);
      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(service.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with id', async () => {
      const id = '123';
      const result = { data: { id: '123' }, paging: {} };
      mockContractsService.findOne.mockResolvedValue(result);

      expect(await controller.findOne(id)).toBe(result);
      expect(service.findOne).toHaveBeenCalledWith(id);
      expect(service.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('should call service.update with id and dto', async () => {
      const id = '123';
      const dto: UpdateContractDto = { status: ContractStatus.ACTIVE };
      const result = { data: { id: '123' }, paging: {} };
      mockContractsService.update.mockResolvedValue(result);

      expect(await controller.update(id, dto)).toBe(result);
      expect(service.update).toHaveBeenCalledWith(id, dto);
      expect(service.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove', () => {
    it('should call service.remove with id', async () => {
      const id = '123';
      mockContractsService.remove.mockResolvedValue(undefined);

      await controller.remove(id);
      expect(service.remove).toHaveBeenCalledWith(id);
      expect(service.remove).toHaveBeenCalledTimes(1);
    });
  });

  describe('shareContract', () => {
    it('should call service.shareContract with contract id, account id and notes', async () => {
      const contractId = 'contract-123';
      const dto: ShareContractDto = {
        accountId: 'account-456',
        notes: 'Shared for subsidiary',
      };
      const result = { data: { id: 'share-1' }, paging: {} };
      mockContractsService.shareContract.mockResolvedValue(result);

      expect(await controller.shareContract(contractId, dto)).toBe(result);
      expect(service.shareContract).toHaveBeenCalledWith(
        contractId,
        dto.accountId,
        dto.notes,
      );
      expect(service.shareContract).toHaveBeenCalledTimes(1);
    });
  });

  describe('unshareContract', () => {
    it('should call service.unshareContract with contract id and account id', async () => {
      const contractId = 'contract-123';
      const accountId = 'account-456';
      mockContractsService.unshareContract.mockResolvedValue(undefined);

      await controller.unshareContract(contractId, accountId);
      expect(service.unshareContract).toHaveBeenCalledWith(
        contractId,
        accountId,
      );
      expect(service.unshareContract).toHaveBeenCalledTimes(1);
    });
  });

  describe('getContractShares', () => {
    it('should call service.getContractShares with contract id', async () => {
      const contractId = 'contract-123';
      const result = { data: [], paging: { total: 0 } };
      mockContractsService.getContractShares.mockResolvedValue(result);

      expect(await controller.getContractShares(contractId)).toBe(result);
      expect(service.getContractShares).toHaveBeenCalledWith(contractId);
      expect(service.getContractShares).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSharedContractsForAccount', () => {
    it('should call service.getSharedContractsForAccount with account id', async () => {
      const accountId = 'account-123';
      const result = { data: [], paging: { total: 0 } };
      mockContractsService.getSharedContractsForAccount.mockResolvedValue(
        result,
      );

      expect(await controller.getSharedContractsForAccount(accountId)).toBe(
        result,
      );
      expect(service.getSharedContractsForAccount).toHaveBeenCalledWith(
        accountId,
      );
      expect(service.getSharedContractsForAccount).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Contract-Product sub-endpoints
  // ---------------------------------------------------------------------------

  describe('findProducts', () => {
    it('should call service.findProducts with contract id and return result', async () => {
      const contractId = 'contract-123';
      const result = {
        data: [{ id: 'cp-1', productId: 'product-1', quantity: 10 }],
        paging: { total: 1, offset: null, limit: null, totalPages: null, hasNext: null, hasPrev: null },
      };
      mockContractsService.findProducts.mockResolvedValue(result);

      expect(await controller.findProducts(contractId)).toBe(result);
      expect(service.findProducts).toHaveBeenCalledWith(contractId);
      expect(service.findProducts).toHaveBeenCalledTimes(1);
    });
  });

  describe('addProduct', () => {
    it('should call service.addProduct with contract id and dto', async () => {
      const contractId = 'contract-123';
      const dto: CreateContractProductDto = { productId: 'product-456', quantity: 5 };
      const result = {
        data: { id: 'cp-1', contractId, productId: 'product-456', quantity: 5 },
        paging: { offset: null, limit: null, total: null, totalPages: null, hasNext: null, hasPrev: null },
      };
      mockContractsService.addProduct.mockResolvedValue(result);

      expect(await controller.addProduct(contractId, dto)).toBe(result);
      expect(service.addProduct).toHaveBeenCalledWith(contractId, dto);
      expect(service.addProduct).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeProduct', () => {
    it('should call service.removeProduct with contract id and product id', async () => {
      const contractId = 'contract-123';
      const productId = 'product-456';
      mockContractsService.removeProduct.mockResolvedValue(undefined);

      await controller.removeProduct(contractId, productId);
      expect(service.removeProduct).toHaveBeenCalledWith(contractId, productId);
      expect(service.removeProduct).toHaveBeenCalledTimes(1);
    });
  });
});
