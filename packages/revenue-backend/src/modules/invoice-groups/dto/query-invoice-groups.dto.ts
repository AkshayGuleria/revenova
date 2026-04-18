import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { BasePaginationDto } from '../../../common/dto/pagination.dto';
import { InvoiceGroupType } from './create-invoice-group.dto';

export class QueryInvoiceGroupsDto extends BasePaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by account ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  'accountId[eq]'?: string;

  @ApiPropertyOptional({
    description: 'Filter by group type',
    enum: InvoiceGroupType,
    example: InvoiceGroupType.DEPARTMENT,
  })
  @IsOptional()
  @IsEnum(InvoiceGroupType)
  'groupType[eq]'?: string;

  @ApiPropertyOptional({
    description: 'Filter by group code (case-insensitive substring)',
    example: 'DEPT',
  })
  @IsOptional()
  @IsString()
  'code[like]'?: string;

  @ApiPropertyOptional({
    description: 'Filter by group name (case-insensitive substring)',
    example: 'Engineering',
  })
  @IsOptional()
  @IsString()
  'name[like]'?: string;
}
