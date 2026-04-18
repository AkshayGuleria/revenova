import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum InvoiceGroupType {
  DEPARTMENT = 'DEPARTMENT',
  COST_CENTER = 'COST_CENTER',
  LOCATION = 'LOCATION',
  CUSTOM = 'CUSTOM',
}

export class CreateInvoiceGroupDto {
  @ApiProperty({
    description: 'Account ID this group belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  accountId: string;

  @ApiProperty({
    description: 'Human-readable group name',
    example: 'Engineering Department',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Group classification type',
    enum: InvoiceGroupType,
    example: InvoiceGroupType.DEPARTMENT,
  })
  @IsEnum(InvoiceGroupType)
  groupType: InvoiceGroupType;

  @ApiPropertyOptional({
    description:
      'Short code identifying this group (unique per account + groupType)',
    example: 'DEPT-ENG',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata as JSON',
    example: { costCenterId: '4400', approver: 'john.doe@acme.com' },
  })
  @IsOptional()
  metadata?: any;
}
