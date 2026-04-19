import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsObject,
  IsDateString,
  Min,
  IsEnum,
  IsArray,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateContractProductDto } from './contract-product.dto';

export enum BillingFrequency {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEMI_ANNUAL = 'semi_annual',
  ANNUAL = 'annual',
}

export enum ContractStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  RENEWED = 'renewed',
}

export enum PaymentTerms {
  NET_30 = 'net_30',
  NET_60 = 'net_60',
  NET_90 = 'net_90',
  DUE_ON_RECEIPT = 'due_on_receipt',
}

export class CreateContractDto {
  @ApiProperty({
    description: 'Unique contract number',
    example: 'CNT-2024-0001',
  })
  @IsString()
  contractNumber: string;

  @ApiProperty({
    description: 'Account ID this contract belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  accountId: string;

  @ApiProperty({
    description: 'Contract start date',
    example: '2024-01-01',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'Contract end date',
    example: '2024-12-31',
  })
  @IsDateString()
  endDate: string;

  @ApiProperty({
    description: 'Total contract value',
    example: 120000.0,
  })
  @IsNumber()
  @Min(0)
  contractValue: number;

  @ApiPropertyOptional({
    description: 'Billing frequency',
    enum: BillingFrequency,
    default: BillingFrequency.ANNUAL,
  })
  @IsOptional()
  @IsEnum(BillingFrequency)
  billingFrequency?: BillingFrequency;

  @ApiPropertyOptional({
    description: 'Current seat count',
    example: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  seatCount?: number;

  @ApiPropertyOptional({
    description: 'Committed seats in contract',
    example: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  committedSeats?: number;

  @ApiPropertyOptional({
    description: 'Price per seat',
    example: 99.99,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  seatPrice?: number;

  @ApiPropertyOptional({
    description: 'Payment terms',
    enum: PaymentTerms,
    default: PaymentTerms.NET_30,
  })
  @IsOptional()
  @IsEnum(PaymentTerms)
  paymentTerms?: PaymentTerms;

  @ApiPropertyOptional({
    description: 'Bill in advance or arrears',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  billingInAdvance?: boolean;

  @ApiPropertyOptional({
    description: 'Auto-renew contract on expiration',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @ApiPropertyOptional({
    description: 'Days before renewal to send notice',
    example: 90,
    default: 90,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  renewalNoticeDays?: number;

  @ApiPropertyOptional({
    description: 'Contract notes',
    example: 'Enterprise tier with volume discount',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata as JSON',
    example: { salesRep: 'Jane Smith', discountApplied: '10%' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Products attached to this contract (min 1 required)',
    type: [CreateContractProductDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateContractProductDto)
  products: CreateContractProductDto[];
}
