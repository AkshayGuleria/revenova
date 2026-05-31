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
  UseGuards,
} from '@nestjs/common';
import { CreditHoldGuard } from '../credit-management/credit-hold.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  QueryInvoicesDto,
  CreateInvoiceItemDto,
  CreateSubInvoiceDto,
} from './dto';

@ApiTags('Invoices')
@Controller('api/invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @UseGuards(CreditHoldGuard)
  @ApiOperation({
    summary: 'Create new invoice',
    description:
      'Create a new invoice for an account with optional contract reference. ' +
      'Validates account exists, contract belongs to account, and amount calculations. ' +
      'Can include line items in the create request. ' +
      'Returns invoice wrapped in standard API response structure with empty paging object.',
  })
  @ApiResponse({
    status: 201,
    description: 'Invoice successfully created',
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
    description:
      'Invalid input data, due date before issue date, or total amount mismatch',
  })
  @ApiResponse({
    status: 404,
    description: 'Account or contract not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Invoice number already exists',
  })
  create(@Body() createInvoiceDto: CreateInvoiceDto) {
    return this.invoicesService.create(createInvoiceDto);
  }

  @Get()
  @ApiOperation({
    summary: 'List invoices with operator-based filtering and pagination',
    description:
      'Retrieve invoices using operator-based query parameters (ADR-003). ' +
      'Supports filtering by status, account, contract, dates, amounts, and more. ' +
      'Returns paginated list with account and contract details.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of invoices',
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
            invoiceNumber: 'INV-2024-0001',
            status: 'paid',
            total: '10300.00',
            issueDate: '2024-01-01',
            dueDate: '2024-01-31',
            account: {
              id: '123e4567-e89b-12d3-a456-426614174001',
              accountName: 'Acme Corporation',
              status: 'active',
            },
            _count: {
              items: 3,
            },
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
  findAll(@Query() query: QueryInvoicesDto) {
    return this.invoicesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get invoice by ID',
    description:
      'Retrieve detailed invoice information including account, contract, and all line items. ' +
      'Returns single resource with empty paging object.',
  })
  @ApiParam({
    name: 'id',
    description: 'Invoice UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice details retrieved successfully',
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
    description: 'Invoice not found',
  })
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update invoice',
    description:
      'Update invoice information. Validates account and contract if changed. ' +
      'Returns updated invoice with empty paging object.',
  })
  @ApiParam({
    name: 'id',
    description: 'Invoice UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice successfully updated',
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
    description: 'Invalid data or date validation failed',
  })
  @ApiResponse({
    status: 404,
    description: 'Invoice, account, or contract not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Invoice number conflict',
  })
  update(@Param('id') id: string, @Body() updateInvoiceDto: UpdateInvoiceDto) {
    return this.invoicesService.update(id, updateInvoiceDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete invoice',
    description:
      'Hard delete an invoice from the system. Cascade deletes all line items. ' +
      'Returns 204 No Content on success.',
  })
  @ApiParam({
    name: 'id',
    description: 'Invoice UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 204,
    description: 'Invoice successfully deleted',
  })
  @ApiResponse({
    status: 404,
    description: 'Invoice not found',
  })
  async remove(@Param('id') id: string) {
    await this.invoicesService.remove(id);
  }

  @Post(':id/items')
  @ApiOperation({
    summary: 'Add line item to invoice',
    description:
      'Add a new line item to an existing invoice. ' +
      'Returns the created line item wrapped in standard API response structure.',
  })
  @ApiParam({
    name: 'id',
    description: 'Invoice UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 201,
    description: 'Line item successfully added',
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
    description: 'Invoice not found',
  })
  addLineItem(
    @Param('id') id: string,
    @Body() createInvoiceItemDto: CreateInvoiceItemDto,
  ) {
    return this.invoicesService.addLineItem(id, createInvoiceItemDto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove line item from invoice',
    description:
      'Remove a line item from an invoice. ' +
      'Validates the item belongs to the invoice. ' +
      'Returns 204 No Content on success.',
  })
  @ApiParam({
    name: 'id',
    description: 'Invoice UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'itemId',
    description: 'Invoice item UUID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @ApiResponse({
    status: 204,
    description: 'Line item successfully removed',
  })
  @ApiResponse({
    status: 404,
    description: 'Invoice or line item not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Line item does not belong to invoice',
  })
  async removeLineItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    await this.invoicesService.removeLineItem(id, itemId);
  }

  // ---------------------------------------------------------------------------
  // Sub-Invoice Endpoints (Phase 4)
  // ---------------------------------------------------------------------------

  @Get(':id/sub-invoices')
  @ApiOperation({
    summary: 'List sub-invoices of a parent invoice',
    description:
      'Retrieve all sub-invoices belonging to a parent invoice. ' +
      'Returns a paginated list with account and invoice group details.',
  })
  @ApiParam({ name: 'id', description: 'Parent invoice UUID' })
  @ApiResponse({ status: 200, description: 'Paginated list of sub-invoices' })
  @ApiResponse({ status: 404, description: 'Parent invoice not found' })
  getSubInvoices(@Param('id') id: string, @Query() query: QueryInvoicesDto) {
    return this.invoicesService.getSubInvoices(id, query);
  }

  @Post(':id/sub-invoices')
  @ApiOperation({
    summary: 'Create a sub-invoice under a parent invoice',
    description:
      'Create a sub-invoice linked to a parent invoice. ' +
      'The sub-invoice inherits accountId and billingType from the parent. ' +
      'Invoice number is auto-generated as <parentNumber>-A, -B, -C, etc. ' +
      'Optionally link to an invoice group for departmental/cost-center allocation.',
  })
  @ApiParam({ name: 'id', description: 'Parent invoice UUID' })
  @ApiResponse({ status: 201, description: 'Sub-invoice created' })
  @ApiResponse({
    status: 400,
    description: 'Validation error or invoice group mismatch',
  })
  @ApiResponse({
    status: 404,
    description: 'Parent invoice or group not found',
  })
  createSubInvoice(
    @Param('id') id: string,
    @Body() createSubInvoiceDto: CreateSubInvoiceDto,
  ) {
    return this.invoicesService.createSubInvoice(id, createSubInvoiceDto);
  }
}
