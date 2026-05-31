import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AuditLogService } from './audit-log.service';

@ApiTags('Audit Log')
@Controller('api/audit-log')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({
    summary: 'List audit log entries with filtering and pagination',
  })
  @ApiQuery({ name: 'entityType[eq]', required: false, example: 'invoice' })
  @ApiQuery({
    name: 'action[eq]',
    required: false,
    example: 'status_changed',
  })
  @ApiQuery({ name: 'actorId[eq]', required: false })
  @ApiQuery({ name: 'offset[eq]', required: false, example: 0 })
  @ApiQuery({ name: 'limit[eq]', required: false, example: 20 })
  findAll(@Query() query: Record<string, any>) {
    return this.auditLogService.findAll(query);
  }

  @Get(':entityType/:entityId')
  @ApiParam({ name: 'entityType', example: 'invoice' })
  @ApiParam({ name: 'entityId', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Get full audit trail for a specific entity' })
  findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditLogService.findByEntity(entityType, entityId);
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Get single audit log entry by ID' })
  findOne(@Param('id') id: string) {
    return this.auditLogService.findOne(id);
  }
}
