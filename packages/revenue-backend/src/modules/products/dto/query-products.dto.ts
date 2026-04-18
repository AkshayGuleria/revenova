import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { BasePaginationDto } from '../../../common/dto/pagination.dto';
import {
  PricingModel,
  BillingInterval,
  ChargeType,
  ProductCategory,
} from './create-product.dto';

export class QueryProductsDto extends BasePaginationDto {
  @ApiPropertyOptional({
    description: 'Search by product name (partial match)',
    example: 'Enterprise',
  })
  @IsOptional()
  @IsString()
  'name[like]'?: string;

  @ApiPropertyOptional({
    description: 'Filter by exact product name',
    example: 'Enterprise Plan',
  })
  @IsOptional()
  @IsString()
  'name[eq]'?: string;

  @ApiPropertyOptional({
    description: 'Filter by SKU (partial match)',
    example: 'ENT-',
  })
  @IsOptional()
  @IsString()
  'sku[like]'?: string;

  @ApiPropertyOptional({
    description: 'Filter by exact SKU',
    example: 'ENT-PLAN-001',
  })
  @IsOptional()
  @IsString()
  'sku[eq]'?: string;

  @ApiPropertyOptional({
    description: 'Filter by pricing model',
    enum: PricingModel,
    example: 'seat_based',
  })
  @IsOptional()
  @IsEnum(PricingModel)
  'pricingModel[eq]'?: string;

  @ApiPropertyOptional({
    description: 'Filter by multiple pricing models (comma-separated)',
    example: 'seat_based,flat_fee',
  })
  @IsOptional()
  @IsString()
  'pricingModel[in]'?: string;

  @ApiPropertyOptional({
    description: 'Filter by billing interval',
    enum: BillingInterval,
  })
  @IsOptional()
  @IsEnum(BillingInterval)
  'billingInterval[eq]'?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  'active[eq]'?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by charge type',
    enum: ChargeType,
    example: 'recurring',
  })
  @IsOptional()
  @IsEnum(ChargeType)
  'chargeType[eq]'?: string;

  @ApiPropertyOptional({
    description: 'Filter by multiple charge types (comma-separated)',
    example: 'recurring,one_time',
  })
  @IsOptional()
  @IsString()
  'chargeType[in]'?: string;

  @ApiPropertyOptional({
    description: 'Filter by product category',
    enum: ProductCategory,
    example: 'addon',
  })
  @IsOptional()
  @IsEnum(ProductCategory)
  'category[eq]'?: string;

  @ApiPropertyOptional({
    description: 'Filter by multiple categories (comma-separated)',
    example: 'addon,support',
  })
  @IsOptional()
  @IsString()
  'category[in]'?: string;

  @ApiPropertyOptional({
    description: 'Filter addon products',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  'isAddon[eq]'?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by base price greater than',
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  'basePrice[gt]'?: number;

  @ApiPropertyOptional({
    description: 'Filter by base price less than',
    example: 200,
  })
  @IsOptional()
  @Type(() => Number)
  'basePrice[lt]'?: number;

  @ApiPropertyOptional({
    description: 'Filter products with null base price',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  'basePrice[null]'?: boolean;
}
