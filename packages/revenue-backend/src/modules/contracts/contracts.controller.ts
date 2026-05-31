import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import {
  CreateContractDto,
  UpdateContractDto,
  QueryContractsDto,
  ShareContractDto,
  CreateContractProductDto,
} from './dto';

@ApiTags('Contracts')
@Controller('api/contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create new contract',
    description:
      'Create a new contract for an account. Validates account exists and date ranges. ' +
      'Returns contract wrapped in standard API response structure with empty paging object.',
  })
  @ApiResponse({
    status: 201,
    description: 'Contract successfully created',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'object' },
        paging: {
          type: 'object',
          properties: {
            offset: { type: 'null' },
            limit: { type: 'null' },
            total: { type: 'null' },
            totalPages: { type: 'null' },
            hasNext: { type: 'null' },
            hasPrev: { type: 'null' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or end date before start date',
  })
  @ApiResponse({
    status: 404,
    description: 'Account not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Contract number already exists',
  })
  create(@Body() createContractDto: CreateContractDto) {
    return this.contractsService.create(createContractDto);
  }

  @Get()
  @ApiOperation({
    summary: 'List contracts with operator-based filtering and pagination',
    description:
      'Retrieve contracts using operator-based query parameters (ADR-003). ' +
      'Supports filtering by status, account, dates, value, and more. ' +
      'Returns paginated list with account details and invoice counts.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of contracts',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { type: 'object' },
        },
        paging: {
          type: 'object',
          properties: {
            offset: { type: 'number', example: 0 },
            limit: { type: 'number', example: 20 },
            total: { type: 'number', example: 45 },
            totalPages: { type: 'number', example: 3 },
            hasNext: { type: 'boolean', example: true },
            hasPrev: { type: 'boolean', example: false },
          },
        },
      },
      example: {
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            contractNumber: 'CNT-2024-0001',
            status: 'active',
            contractValue: '120000.00',
            startDate: '2024-01-01',
            endDate: '2024-12-31',
            account: {
              id: '123e4567-e89b-12d3-a456-426614174001',
              accountName: 'Acme Corporation',
              status: 'active',
            },
            _count: {
              invoices: 12,
            },
          },
        ],
        paging: {
          offset: 0,
          limit: 20,
          total: 45,
          totalPages: 3,
          hasNext: true,
          hasPrev: false,
        },
      },
    },
  })
  findAll(@Query() query: QueryContractsDto) {
    return this.contractsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get contract by ID',
    description:
      'Retrieve detailed contract information including account details and invoices. ' +
      'Returns single resource with empty paging object.',
  })
  @ApiParam({
    name: 'id',
    description: 'Contract UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Contract details retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'object' },
        paging: {
          type: 'object',
          properties: {
            offset: { type: 'null' },
            limit: { type: 'null' },
            total: { type: 'null' },
            totalPages: { type: 'null' },
            hasNext: { type: 'null' },
            hasPrev: { type: 'null' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Contract not found',
  })
  findOne(@Param('id') id: string) {
    return this.contractsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update contract',
    description:
      'Update contract information. Validates account and date ranges if changed. ' +
      'Returns updated contract with empty paging object.',
  })
  @ApiParam({
    name: 'id',
    description: 'Contract UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Contract successfully updated',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'object' },
        paging: {
          type: 'object',
          properties: {
            offset: { type: 'null' },
            limit: { type: 'null' },
            total: { type: 'null' },
            totalPages: { type: 'null' },
            hasNext: { type: 'null' },
            hasPrev: { type: 'null' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or end date before start date',
  })
  @ApiResponse({
    status: 404,
    description: 'Contract or account not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Contract number conflict',
  })
  update(
    @Param('id') id: string,
    @Body() updateContractDto: UpdateContractDto,
  ) {
    return this.contractsService.update(id, updateContractDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete contract',
    description:
      'Hard delete a contract from the system. Returns 204 No Content on success.',
  })
  @ApiParam({
    name: 'id',
    description: 'Contract UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 204,
    description: 'Contract successfully deleted',
  })
  @ApiResponse({
    status: 404,
    description: 'Contract not found',
  })
  async remove(@Param('id') id: string) {
    await this.contractsService.remove(id);
  }

  // ---------------------------------------------------------------------------
  // Contract-Product sub-endpoints (CP6)
  // ---------------------------------------------------------------------------

  @Get(':id/products')
  @ApiOperation({ summary: 'List products attached to a contract' })
  @ApiParam({ name: 'id', description: 'Contract UUID' })
  @ApiResponse({ status: 200, description: 'List of contract products' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  findProducts(@Param('id') id: string) {
    return this.contractsService.findProducts(id);
  }

  @Post(':id/products')
  @ApiOperation({ summary: 'Add a product to a contract' })
  @ApiParam({ name: 'id', description: 'Contract UUID' })
  @ApiResponse({ status: 201, description: 'Product added to contract' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 404, description: 'Contract or product not found' })
  @ApiResponse({ status: 409, description: 'Product already on this contract' })
  addProduct(@Param('id') id: string, @Body() dto: CreateContractProductDto) {
    return this.contractsService.addProduct(id, dto);
  }

  @Delete(':id/products/:productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a product from a contract' })
  @ApiParam({ name: 'id', description: 'Contract UUID' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiResponse({ status: 204, description: 'Product removed from contract' })
  @ApiResponse({
    status: 404,
    description: 'Contract or product binding not found',
  })
  async removeProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
  ) {
    await this.contractsService.removeProduct(id, productId);
  }

  // ---------------------------------------------------------------------------
  // Shared Contracts (Phase 3)
  // ---------------------------------------------------------------------------

  @Post(':id/shares')
  @ApiOperation({
    summary: 'Share contract with another account',
    description:
      'Share a contract with a subsidiary account. The shared account can use this contract for billing. ' +
      'Returns share details with empty paging object.',
  })
  @ApiParam({
    name: 'id',
    description: 'Contract UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 201,
    description: 'Contract successfully shared',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'object' },
        paging: {
          type: 'object',
          properties: {
            offset: { type: 'null' },
            limit: { type: 'null' },
            total: { type: 'null' },
            totalPages: { type: 'null' },
            hasNext: { type: 'null' },
            hasPrev: { type: 'null' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or cannot share with owner account',
  })
  @ApiResponse({
    status: 404,
    description: 'Contract or account not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Contract is already shared with this account',
  })
  shareContract(@Param('id') id: string, @Body() dto: ShareContractDto) {
    return this.contractsService.shareContract(id, dto.accountId, dto.notes);
  }

  @Delete(':id/shares/:accountId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Unshare contract from account',
    description:
      'Remove contract share from a subsidiary account. Returns 204 No Content on success.',
  })
  @ApiParam({
    name: 'id',
    description: 'Contract UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'accountId',
    description: 'Account UUID to unshare from',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @ApiResponse({
    status: 204,
    description: 'Contract successfully unshared',
  })
  @ApiResponse({
    status: 404,
    description: 'Contract or share not found',
  })
  async unshareContract(
    @Param('id') id: string,
    @Param('accountId') accountId: string,
  ) {
    await this.contractsService.unshareContract(id, accountId);
  }

  @Get(':id/shares')
  @ApiOperation({
    summary: 'Get all accounts a contract is shared with',
    description:
      'Retrieve list of all accounts this contract has been shared with. ' +
      'Returns list with count metadata.',
  })
  @ApiParam({
    name: 'id',
    description: 'Contract UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'List of shared accounts retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { type: 'object' },
        },
        paging: {
          type: 'object',
          properties: {
            offset: { type: 'number', example: 0 },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number', example: 1 },
            hasNext: { type: 'boolean', example: false },
            hasPrev: { type: 'boolean', example: false },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Contract not found',
  })
  getContractShares(@Param('id') id: string) {
    return this.contractsService.getContractShares(id);
  }

  @Get('shared/:accountId')
  @ApiOperation({
    summary: 'Get all contracts shared with an account',
    description:
      'Retrieve list of all contracts shared with a specific account. ' +
      'Returns list with count metadata.',
  })
  @ApiParam({
    name: 'accountId',
    description: 'Account UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'List of shared contracts retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { type: 'object' },
        },
        paging: {
          type: 'object',
          properties: {
            offset: { type: 'number', example: 0 },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number', example: 1 },
            hasNext: { type: 'boolean', example: false },
            hasPrev: { type: 'boolean', example: false },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Account not found',
  })
  getSharedContractsForAccount(@Param('accountId') accountId: string) {
    return this.contractsService.getSharedContractsForAccount(accountId);
  }
}
