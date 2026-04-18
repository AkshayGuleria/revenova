import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateInvoiceItemDto } from './create-invoice-item.dto';
import { InvoiceStatus } from './create-invoice.dto';

/**
 * DTO for creating a sub-invoice under an existing parent invoice.
 * accountId and billingType are inherited from the parent — not provided here.
 */
export class CreateSubInvoiceDto {
  @ApiPropertyOptional({
    description: 'Contract ID (defaults to parent contract if omitted)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  contractId?: string;

  @ApiPropertyOptional({
    description: 'Invoice group this sub-invoice belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  invoiceGroupId?: string;

  @ApiPropertyOptional({
    description: 'Issue date (defaults to parent issue date)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional({
    description: 'Due date (defaults to parent due date)',
    example: '2026-01-31',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    description: 'Billing period start date',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional({
    description: 'Billing period end date',
    example: '2026-01-31',
  })
  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @ApiProperty({
    description: 'Subtotal amount (before tax and discount)',
    example: 5000.0,
  })
  @IsNumber()
  @Min(0)
  subtotal: number;

  @ApiPropertyOptional({
    description: 'Tax amount',
    example: 400.0,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;

  @ApiPropertyOptional({
    description: 'Discount amount',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiProperty({
    description: 'Total amount (subtotal + tax - discount)',
    example: 5400.0,
  })
  @IsNumber()
  @Min(0)
  total: number;

  @ApiPropertyOptional({
    description: 'Currency code (defaults to parent currency)',
    example: 'EUR',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Invoice status (defaults to parent status)',
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({
    description: 'Public invoice notes',
    example: 'Engineering department allocation',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Internal notes (not visible to customer)',
  })
  @IsOptional()
  @IsString()
  internalNotes?: string;

  @ApiPropertyOptional({
    description: 'Line items for this sub-invoice',
    type: [CreateInvoiceItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items?: CreateInvoiceItemDto[];

  @ApiPropertyOptional({
    description: 'Additional metadata as JSON',
  })
  @IsOptional()
  metadata?: any;
}
