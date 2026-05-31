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
import { AccountsService } from './accounts.service';
import {
  CreateAccountDto,
  UpdateAccountDto,
  QueryAccountsDto,
  UpdateCreditDto,
} from './dto';

@ApiTags('Accounts')
@Controller('api/accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create new account',
    description:
      'Create a new enterprise account with optional hierarchical parent. ' +
      'Returns account wrapped in standard API response structure with empty paging object.',
  })
  @ApiResponse({
    status: 201,
    description: 'Account successfully created',
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
    description: 'Invalid input data or circular hierarchy detected',
  })
  @ApiResponse({
    status: 404,
    description: 'Parent account not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Account with this email already exists',
  })
  create(@Body() createAccountDto: CreateAccountDto) {
    return this.accountsService.create(createAccountDto);
  }

  @Get()
  @ApiOperation({
    summary: 'List accounts with operator-based filtering and pagination',
    description:
      'Retrieve accounts using operator-based query parameters (ADR-003). ' +
      'Supports filtering, searching, and offset-based pagination. ' +
      'Returns paginated list with full paging metadata.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of accounts',
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
            total: { type: 'number', example: 156 },
            totalPages: { type: 'number', example: 8 },
            hasNext: { type: 'boolean', example: true },
            hasPrev: { type: 'boolean', example: false },
          },
        },
      },
      example: {
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            accountName: 'Acme Corporation',
            status: 'active',
            accountType: 'enterprise',
          },
        ],
        paging: {
          offset: 0,
          limit: 20,
          total: 156,
          totalPages: 8,
          hasNext: true,
          hasPrev: false,
        },
      },
    },
  })
  findAll(@Query() query: QueryAccountsDto) {
    return this.accountsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get account by ID',
    description:
      'Retrieve detailed account information including parent, children, and active contracts. ' +
      'Returns single resource with empty paging object.',
  })
  @ApiParam({
    name: 'id',
    description: 'Account UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Account details retrieved successfully',
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
    description: 'Account not found',
  })
  findOne(@Param('id') id: string) {
    return this.accountsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update account',
    description:
      'Update account information. Validates hierarchy changes to prevent circular references. ' +
      'Returns updated account with empty paging object.',
  })
  @ApiParam({
    name: 'id',
    description: 'Account UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Account successfully updated',
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
    description: 'Invalid data or circular hierarchy detected',
  })
  @ApiResponse({
    status: 404,
    description: 'Account or parent account not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Email conflict with existing account',
  })
  update(@Param('id') id: string, @Body() updateAccountDto: UpdateAccountDto) {
    return this.accountsService.update(id, updateAccountDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete account',
    description:
      'Soft delete an account (sets deletedAt and status to inactive). ' +
      'Returns 204 No Content on success.',
  })
  @ApiParam({
    name: 'id',
    description: 'Account UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 204,
    description: 'Account successfully deleted',
  })
  @ApiResponse({
    status: 404,
    description: 'Account not found',
  })
  async remove(@Param('id') id: string) {
    await this.accountsService.remove(id);
  }

  @Get(':id/hierarchy')
  @ApiOperation({
    summary: 'Get account hierarchy tree',
    description:
      'Retrieve full account hierarchy tree including all descendants (children, grandchildren, etc.) ' +
      'up to 5 levels deep. Returns hierarchical structure with nested children. ' +
      'Returns single resource with empty paging object.',
  })
  @ApiParam({
    name: 'id',
    description: 'Root account UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Hierarchy tree retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            accountName: { type: 'string' },
            depth: { type: 'number', example: 0 },
            children: {
              type: 'array',
              items: { type: 'object' },
            },
          },
        },
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
    description: 'Account not found',
  })
  getHierarchy(@Param('id') id: string) {
    return this.accountsService.getHierarchy(id);
  }

  @Get(':id/children')
  @ApiOperation({
    summary: 'Get direct children of account',
    description:
      'Retrieve all direct child accounts (one level below) of the specified parent account. ' +
      'Returns list with count metadata. Paging object includes only total count.',
  })
  @ApiParam({
    name: 'id',
    description: 'Parent account UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Children list retrieved successfully',
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
  getChildren(@Param('id') id: string) {
    return this.accountsService.getChildren(id);
  }

  @Get(':id/ancestors')
  @ApiOperation({
    summary: 'Get account ancestors',
    description:
      'Retrieve all ancestor accounts (parent, grandparent, etc.) up the hierarchy chain ' +
      'up to 5 levels. Returns flat list ordered from root (top) to immediate parent (bottom). ' +
      'Returns list with count metadata.',
  })
  @ApiParam({
    name: 'id',
    description: 'Account UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Ancestors list retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              accountName: { type: 'string' },
              depth: { type: 'number', example: 1 },
            },
          },
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
  getAncestors(@Param('id') id: string) {
    return this.accountsService.getAncestors(id);
  }

  @Get(':id/descendants')
  @ApiOperation({
    summary: 'Get all descendants of account',
    description:
      'Retrieve all descendant accounts (children, grandchildren, etc.) as a flat list ' +
      'up to 5 levels deep. Ordered by depth and name. Returns list with count metadata.',
  })
  @ApiParam({
    name: 'id',
    description: 'Root account UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Descendants list retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              accountName: { type: 'string' },
              depth: { type: 'number', example: 1 },
            },
          },
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
  getDescendants(@Param('id') id: string) {
    return this.accountsService.getDescendants(id);
  }

  @Get(':id/credit-status')
  @ApiOperation({
    summary: 'Get credit utilization and hold status for an account',
    description:
      'Returns current credit limit, outstanding invoice total (sent + overdue), ' +
      'available credit, utilization percentage, and credit hold status.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Credit status returned' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  getCreditStatus(@Param('id') id: string) {
    return this.accountsService.getCreditStatus(id);
  }

  @Patch(':id/credit')
  @ApiOperation({
    summary: 'Update credit limit and/or hold status for an account',
    description:
      'Partially update creditLimit (in account currency) and/or creditHold flag. ' +
      'Pass only the fields you want to change.',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Credit settings updated' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  updateCredit(@Param('id') id: string, @Body() dto: UpdateCreditDto) {
    return this.accountsService.updateCredit(id, dto);
  }
}
