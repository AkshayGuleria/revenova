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
import { InvoiceGroupsService } from './invoice-groups.service';
import {
  CreateInvoiceGroupDto,
  UpdateInvoiceGroupDto,
  QueryInvoiceGroupsDto,
} from './dto';

@ApiTags('Invoice Groups')
@Controller('api/invoice-groups')
export class InvoiceGroupsController {
  constructor(private readonly invoiceGroupsService: InvoiceGroupsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create invoice group',
    description:
      'Create an organizational grouping (department, cost center, location, custom) ' +
      'for splitting invoices. Groups are unique per account + groupType + code combination.',
  })
  @ApiResponse({ status: 201, description: 'Invoice group created' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  @ApiResponse({
    status: 409,
    description: 'Group with same type+code already exists for this account',
  })
  create(@Body() createInvoiceGroupDto: CreateInvoiceGroupDto) {
    return this.invoiceGroupsService.create(createInvoiceGroupDto);
  }

  @Get()
  @ApiOperation({
    summary: 'List invoice groups',
    description:
      'List invoice groups with optional filtering by account, groupType, code, or name.',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of invoice groups' })
  findAll(@Query() query: QueryInvoiceGroupsDto) {
    return this.invoiceGroupsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice group by ID' })
  @ApiParam({ name: 'id', description: 'Invoice group UUID' })
  @ApiResponse({ status: 200, description: 'Invoice group details' })
  @ApiResponse({ status: 404, description: 'Invoice group not found' })
  findOne(@Param('id') id: string) {
    return this.invoiceGroupsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update invoice group',
    description: 'Update group name, code, or metadata. Account ownership cannot be changed.',
  })
  @ApiParam({ name: 'id', description: 'Invoice group UUID' })
  @ApiResponse({ status: 200, description: 'Invoice group updated' })
  @ApiResponse({ status: 404, description: 'Invoice group not found' })
  @ApiResponse({ status: 409, description: 'Duplicate type+code conflict' })
  update(
    @Param('id') id: string,
    @Body() updateInvoiceGroupDto: UpdateInvoiceGroupDto,
  ) {
    return this.invoiceGroupsService.update(id, updateInvoiceGroupDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete invoice group',
    description:
      'Delete an invoice group. Fails if any invoices are still attached to the group.',
  })
  @ApiParam({ name: 'id', description: 'Invoice group UUID' })
  @ApiResponse({ status: 204, description: 'Invoice group deleted' })
  @ApiResponse({ status: 400, description: 'Group has attached invoices' })
  @ApiResponse({ status: 404, description: 'Invoice group not found' })
  async remove(@Param('id') id: string) {
    await this.invoiceGroupsService.remove(id);
  }
}
