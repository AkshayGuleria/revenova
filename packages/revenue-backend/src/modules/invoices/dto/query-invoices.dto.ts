import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BasePaginationDto } from '../../../common/dto/pagination.dto';

enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

enum BillingType {
  ONE_TIME = 'one_time',
  RECURRING = 'recurring',
}

/**
 * Query DTO for filtering and paginating invoices
 * Uses operator-based query parameters per ADR-003
 */
export class QueryInvoicesDto extends BasePaginationDto {
  // LIKE operator - Search
  @ApiPropertyOptional({
    description: 'Search by invoice number (case-insensitive substring)',
    example: 'INV-2024',
  })
  @IsOptional()
  @IsString()
  'invoiceNumber[like]'?: string;

  @ApiPropertyOptional({
    description: 'Search by purchase order number (case-insensitive substring)',
    example: 'PO-2024',
  })
  @IsOptional()
  @IsString()
  'purchaseOrderNumber[like]'?: string;

  // EQ operator - Exact match filters
  @ApiPropertyOptional({
    description: 'Filter by exact invoice number',
    example: 'INV-2024-0001',
  })
  @IsOptional()
  @IsString()
  'invoiceNumber[eq]'?: string;

  @ApiPropertyOptional({
    description: 'Filter by account ID (exact match)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  'accountId[eq]'?: string;

  @ApiPropertyOptional({
    description: 'Filter by contract ID (exact match)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  'contractId[eq]'?: string;

  @ApiPropertyOptional({
    description: 'Filter by invoice status (exact match)',
    enum: InvoiceStatus,
    example: 'paid',
  })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  'status[eq]'?: string;

  @ApiPropertyOptional({
    description: 'Filter by billing type (exact match)',
    enum: BillingType,
    example: 'recurring',
  })
  @IsOptional()
  @IsEnum(BillingType)
  'billingType[eq]'?: string;

  @ApiPropertyOptional({
    description: 'Filter by currency (exact match)',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  'currency[eq]'?: string;

  @ApiPropertyOptional({
    description: 'Filter by consolidated status (exact match)',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  'consolidated[eq]'?: boolean;

  // IN operator - Multiple values
  @ApiPropertyOptional({
    description: 'Filter by multiple statuses (comma-separated)',
    example: 'paid,sent',
  })
  @IsOptional()
  @IsString()
  'status[in]'?: string;

  // Comparison operators for dates
  @ApiPropertyOptional({
    description: 'Filter invoices issued on or after date',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  'issueDate[gte]'?: string;

  @ApiPropertyOptional({
    description: 'Filter invoices issued on or before date',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  'issueDate[lte]'?: string;

  @ApiPropertyOptional({
    description: 'Filter invoices due on or after date',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  'dueDate[gte]'?: string;

  @ApiPropertyOptional({
    description: 'Filter invoices due on or before date',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  'dueDate[lte]'?: string;

  @ApiPropertyOptional({
    description: 'Filter invoices paid on or after date',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  'paidDate[gte]'?: string;

  @ApiPropertyOptional({
    description: 'Filter invoices paid on or before date',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  'paidDate[lte]'?: string;

  // Comparison operators for amounts
  @ApiPropertyOptional({
    description: 'Filter by total amount greater than',
    example: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  'total[gt]'?: number;

  @ApiPropertyOptional({
    description: 'Filter by total amount greater than or equal',
    example: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  'total[gte]'?: number;

  @ApiPropertyOptional({
    description: 'Filter by total amount less than',
    example: 10000,
  })
  @IsOptional()
  @Type(() => Number)
  'total[lt]'?: number;

  @ApiPropertyOptional({
    description: 'Filter by total amount less than or equal',
    example: 10000,
  })
  @IsOptional()
  @Type(() => Number)
  'total[lte]'?: number;

  // Sub-invoice filters (Phase 4)
  @ApiPropertyOptional({
    description: 'Filter by parent invoice ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  'parentInvoiceId[eq]'?: string;

  @ApiPropertyOptional({
    description: 'Filter by invoice group ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  'invoiceGroupId[eq]'?: string;

  // NULL operator
  @ApiPropertyOptional({
    description:
      'Filter invoices with or without contract (true = no contract, false = has contract)',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  'contractId[null]'?: boolean;

  @ApiPropertyOptional({
    description:
      'Filter invoices with or without paid date (true = not paid, false = paid)',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  'paidDate[null]'?: boolean;

  @ApiPropertyOptional({
    description:
      'Filter top-level invoices only (true = no parent) or sub-invoices only (false = has parent)',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  'parentInvoiceId[null]'?: boolean;
}
