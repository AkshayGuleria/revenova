import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsNumber,
  IsEnum,
  IsObject,
  Min,
} from 'class-validator';

export enum AccountType {
  ENTERPRISE = 'enterprise',
  SMB = 'smb',
  STARTUP = 'startup',
}

export enum PaymentTerms {
  NET_30 = 'net_30',
  NET_60 = 'net_60',
  NET_90 = 'net_90',
  DUE_ON_RECEIPT = 'due_on_receipt',
}

export class CreateAccountDto {
  @ApiPropertyOptional({
    description: 'Parent account ID for hierarchical accounts',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  parentAccountId?: string;

  @ApiProperty({
    description: 'Account name',
    example: 'Acme Corporation',
  })
  @IsString()
  accountName: string;

  @ApiPropertyOptional({
    description: 'Type of account',
    enum: AccountType,
    default: AccountType.ENTERPRISE,
  })
  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;

  @ApiProperty({
    description: 'Primary contact email',
    example: 'contact@acme.com',
  })
  @IsEmail()
  primaryContactEmail: string;

  @ApiPropertyOptional({
    description: 'Billing contact name',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  billingContactName?: string;

  @ApiPropertyOptional({
    description: 'Billing contact email',
    example: 'billing@acme.com',
  })
  @IsOptional()
  @IsEmail()
  billingContactEmail?: string;

  @ApiPropertyOptional({
    description: 'Billing contact phone',
    example: '+1-555-123-4567',
  })
  @IsOptional()
  @IsString()
  billingContactPhone?: string;

  @ApiPropertyOptional({
    description: 'Billing address line 1',
    example: '123 Main Street',
  })
  @IsOptional()
  @IsString()
  billingAddressLine1?: string;

  @ApiPropertyOptional({
    description: 'Billing address line 2',
    example: 'Suite 100',
  })
  @IsOptional()
  @IsString()
  billingAddressLine2?: string;

  @ApiPropertyOptional({
    description: 'Billing city',
    example: 'San Francisco',
  })
  @IsOptional()
  @IsString()
  billingCity?: string;

  @ApiPropertyOptional({
    description: 'Billing state/province',
    example: 'CA',
  })
  @IsOptional()
  @IsString()
  billingState?: string;

  @ApiPropertyOptional({
    description: 'Billing postal code',
    example: '94105',
  })
  @IsOptional()
  @IsString()
  billingPostalCode?: string;

  @ApiPropertyOptional({
    description: 'Billing country',
    example: 'USA',
  })
  @IsOptional()
  @IsString()
  billingCountry?: string;

  @ApiPropertyOptional({
    description: 'Payment terms',
    enum: PaymentTerms,
    default: PaymentTerms.NET_30,
  })
  @IsOptional()
  @IsEnum(PaymentTerms)
  paymentTerms?: PaymentTerms;

  @ApiPropertyOptional({
    description: 'Payment terms in days',
    example: 30,
    default: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  paymentTermsDays?: number;

  @ApiPropertyOptional({
    description: 'Currency code',
    example: 'USD',
    default: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Tax ID / VAT number',
    example: 'US123456789',
  })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata as JSON',
    example: { salesRep: 'Jane Smith', region: 'West' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
