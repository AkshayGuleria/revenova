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
import { PurchaseOrdersService } from './purchase-orders.service';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  RejectPurchaseOrderDto,
} from './dto';

@ApiTags('Purchase Orders')
@Controller('api/purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create purchase order' })
  @ApiResponse({ status: 201, description: 'Purchase order created' })
  create(@Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrdersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List purchase orders' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of purchase orders',
  })
  findAll(@Query() query: Record<string, any>) {
    return this.purchaseOrdersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get purchase order by ID' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Purchase order details' })
  @ApiResponse({ status: 404, description: 'Purchase order not found' })
  findOne(@Param('id') id: string) {
    return this.purchaseOrdersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update purchase order (pending_approval only)' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Purchase order updated' })
  @ApiResponse({ status: 400, description: 'Cannot update non-pending PO' })
  update(@Param('id') id: string, @Body() dto: UpdatePurchaseOrderDto) {
    return this.purchaseOrdersService.update(id, dto);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve purchase order' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Purchase order approved' })
  @ApiResponse({ status: 400, description: 'Cannot approve non-pending PO' })
  approve(@Param('id') id: string) {
    return this.purchaseOrdersService.approve(id);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject purchase order' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Purchase order rejected' })
  @ApiResponse({ status: 400, description: 'Cannot reject non-pending PO' })
  reject(@Param('id') id: string, @Body() dto: RejectPurchaseOrderDto) {
    return this.purchaseOrdersService.reject(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel purchase order' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Purchase order cancelled' })
  @ApiResponse({
    status: 400,
    description: 'Cannot cancel fulfilled/cancelled PO',
  })
  cancel(@Param('id') id: string) {
    return this.purchaseOrdersService.cancel(id);
  }
}
