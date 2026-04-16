import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateInvoiceItemDto } from './create-invoice-item.dto';

export enum PaymentMode {
  PARENT_PAYS = 'PARENT_PAYS',
  CHILD_PAYS = 'CHILD_PAYS',
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
  VOID = 'void',
}

export enum BillingType {
  RECURRING = 'recurring',
  ONE_TIME = 'one_time',
}

export class CreateInvoiceDto {
  @ApiProperty({
    description: 'Unique invoice number',
    example: 'INV-2024-0001',
  })
  @IsString()
  invoiceNumber: string;

  @ApiProperty({
    description: 'Account ID this invoice belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  accountId: string;

  @ApiPropertyOptional({
    description: 'Contract ID (optional)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  contractId?: string;

  @ApiPropertyOptional({
    description: 'Purchase order number',
    example: 'PO-2024-1234',
  })
  @IsOptional()
  @IsString()
  purchaseOrderNumber?: string;

  @ApiProperty({
    description: 'Invoice issue date',
    example: '2024-01-01',
  })
  @IsDateString()
  issueDate: string;

  @ApiProperty({
    description: 'Invoice due date',
    example: '2024-01-31',
  })
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({
    description: 'Billing period start date',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional({
    description: 'Billing period end date',
    example: '2024-01-31',
  })
  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @ApiProperty({
    description: 'Subtotal amount (before tax and discount)',
    example: 10000.0,
  })
  @IsNumber()
  @Min(0)
  subtotal: number;

  @ApiPropertyOptional({
    description: 'Tax amount',
    example: 800.0,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;

  @ApiPropertyOptional({
    description: 'Discount amount',
    example: 500.0,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiProperty({
    description: 'Total amount (subtotal + tax - discount)',
    example: 10300.0,
  })
  @IsNumber()
  @Min(0)
  total: number;

  @ApiPropertyOptional({
    description: 'Currency code',
    example: 'USD',
    default: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Invoice status',
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({
    description: 'Paid amount',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  @ApiPropertyOptional({
    description: 'Date when invoice was paid',
    example: '2024-01-15',
  })
  @IsOptional()
  @IsDateString()
  paidDate?: string;

  @ApiPropertyOptional({
    description: 'Billing type',
    enum: BillingType,
    default: BillingType.RECURRING,
  })
  @IsOptional()
  @IsEnum(BillingType)
  billingType?: BillingType;

  @ApiPropertyOptional({
    description: 'Whether this is a consolidated invoice',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  consolidated?: boolean;

  @ApiPropertyOptional({
    description: 'Parent invoice ID (for consolidated billing)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  parentInvoiceId?: string;

  @ApiPropertyOptional({
    description: 'Invoice group ID for departmental/cost center allocation',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  invoiceGroupId?: string;

  @ApiPropertyOptional({
    description:
      'Payment mode for parent invoices: PARENT_PAYS cascades payment to children, CHILD_PAYS requires each sub-invoice to be paid independently',
    enum: PaymentMode,
  })
  @IsOptional()
  @IsEnum(PaymentMode)
  paymentMode?: PaymentMode;

  @ApiPropertyOptional({
    description: 'Public invoice notes',
    example: 'Thank you for your business',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Internal notes (not visible to customer)',
    example: 'Negotiated discount applied',
  })
  @IsOptional()
  @IsString()
  internalNotes?: string;

  @ApiPropertyOptional({
    description: 'Invoice line items',
    type: [CreateInvoiceItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items?: CreateInvoiceItemDto[];

  @ApiPropertyOptional({
    description: 'Additional metadata as JSON',
    example: { salesRep: 'Jane Smith', region: 'West' },
  })
  @IsOptional()
  metadata?: any;
}
