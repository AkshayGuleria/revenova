import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsDateString,
  IsNumber,
  IsPositive,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

const PAYMENT_METHODS = [
  'bank_transfer',
  'credit_card',
  'ach',
  'check',
  'wire',
  'other',
] as const;

export class CreatePaymentDto {
  @ApiProperty({ example: 'PAY-2026-001' })
  @IsString()
  paymentNumber: string;

  @ApiProperty()
  @IsUUID()
  accountId: string;

  @ApiPropertyOptional({ description: 'Invoice to apply this payment to' })
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional({ example: 'EUR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ enum: PAYMENT_METHODS, example: 'bank_transfer' })
  @IsString()
  @IsIn(PAYMENT_METHODS)
  method: string;

  @ApiPropertyOptional({ example: 'TXN-ABC-123' })
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiProperty({ example: '2026-05-31' })
  @IsDateString()
  paymentDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
