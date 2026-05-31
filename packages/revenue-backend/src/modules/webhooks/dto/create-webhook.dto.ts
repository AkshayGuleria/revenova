import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUrl,
  IsArray,
  IsUUID,
  IsOptional,
  ArrayMinSize,
} from 'class-validator';

export const VALID_EVENTS = [
  'invoice.created',
  'invoice.paid',
  'invoice.overdue',
  'payment.received',
  'payment.voided',
  'contract.created',
  'contract.renewed',
  'contract.expiring',
  'purchase_order.approved',
  'purchase_order.rejected',
  'account.credit_hold',
] as const;

export type ValidEvent = (typeof VALID_EVENTS)[number];

export class CreateWebhookDto {
  @ApiProperty({ description: 'Account UUID this webhook belongs to' })
  @IsUUID()
  accountId: string;

  @ApiProperty({ example: 'https://example.com/webhooks' })
  @IsUrl()
  url: string;

  @ApiProperty({
    example: ['invoice.created', 'payment.received'],
    description: `Supported events: ${VALID_EVENTS.join(', ')}`,
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  events: string[];

  @ApiPropertyOptional({ example: 'Production billing webhook' })
  @IsOptional()
  @IsString()
  description?: string;
}
