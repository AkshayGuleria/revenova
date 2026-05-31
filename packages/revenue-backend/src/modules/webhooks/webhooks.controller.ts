import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto';

@ApiTags('Webhooks')
@Controller('api/webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  /**
   * POST /api/webhooks
   * Register a new webhook endpoint for an account.
   * Returns the signing secret once — it is never returned again.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register webhook endpoint' })
  create(@Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(dto);
  }

  /**
   * GET /api/webhooks
   * List webhook endpoints. Supports operator-based filtering (ADR-003).
   * Secret is never included in list responses.
   */
  @Get()
  @ApiOperation({ summary: 'List webhook endpoints' })
  findAll(@Query() query: Record<string, any>) {
    return this.webhooksService.findAll(query);
  }

  /**
   * GET /api/webhooks/:id
   * Get a single webhook endpoint by ID. Secret omitted.
   */
  @Get(':id')
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOperation({ summary: 'Get webhook endpoint' })
  findOne(@Param('id') id: string) {
    return this.webhooksService.findOne(id);
  }

  /**
   * DELETE /api/webhooks/:id
   * Soft-deactivate a webhook (sets active=false, preserves delivery history).
   */
  @Delete(':id')
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOperation({ summary: 'Deactivate webhook endpoint (soft delete)' })
  deactivate(@Param('id') id: string) {
    return this.webhooksService.deactivate(id);
  }

  /**
   * GET /api/webhooks/:id/deliveries
   * Get the last 50 delivery attempts for a webhook endpoint.
   */
  @Get(':id/deliveries')
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOperation({ summary: 'Get delivery history for webhook endpoint' })
  getDeliveries(@Param('id') id: string) {
    return this.webhooksService.getDeliveries(id);
  }
}
