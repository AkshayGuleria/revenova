import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsEnum,
  Min,
} from 'class-validator';

export enum PricingModel {
  SEAT_BASED = 'seat_based',
  FLAT_FEE = 'flat_fee',
  VOLUME_TIERED = 'volume_tiered',
  CUSTOM = 'custom',
}

export enum BillingInterval {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEMI_ANNUAL = 'semi_annual',
  ANNUAL = 'annual',
}

export enum ChargeType {
  RECURRING = 'recurring',
  ONE_TIME = 'one_time',
  USAGE_BASED = 'usage_based', // Phase 6 — field accepted, billing logic deferred
}

export enum ProductCategory {
  PLATFORM = 'platform',
  SEATS = 'seats',
  ADDON = 'addon',
  SUPPORT = 'support',
  PROFESSIONAL_SERVICES = 'professional_services',
  STORAGE = 'storage', // Phase 6
  API = 'api', // Phase 6
}

export class CreateProductDto {
  @ApiProperty({
    description: 'Product name',
    example: 'Enterprise Plan',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Product description',
    example: 'Full-featured enterprise plan with unlimited seats',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Stock Keeping Unit (SKU)',
    example: 'ENT-PLAN-001',
  })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiProperty({
    description: 'Pricing model type',
    enum: PricingModel,
    example: PricingModel.SEAT_BASED,
  })
  @IsEnum(PricingModel)
  pricingModel: PricingModel;

  @ApiPropertyOptional({
    description: 'Base price for the product',
    example: 99.99,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @ApiPropertyOptional({
    description: 'Currency code',
    example: 'USD',
    default: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description:
      'Charge type: recurring (auto-billed), one_time (first invoice only), usage_based (Phase 6)',
    enum: ChargeType,
    default: ChargeType.RECURRING,
    example: ChargeType.RECURRING,
  })
  @IsOptional()
  @IsEnum(ChargeType)
  chargeType?: ChargeType;

  @ApiPropertyOptional({
    description: 'Product category for invoice grouping and reporting',
    enum: ProductCategory,
    default: ProductCategory.PLATFORM,
    example: ProductCategory.PLATFORM,
  })
  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  @ApiPropertyOptional({
    description: 'One-time setup fee added to the first invoice only',
    example: 500.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  setupFee?: number;

  @ApiPropertyOptional({
    description: 'Number of trial days before billing begins',
    example: 14,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  trialPeriodDays?: number;

  @ApiPropertyOptional({
    description: 'Minimum contract commitment in months',
    example: 12,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minCommitmentMonths?: number;

  @ApiPropertyOptional({
    description: 'Minimum number of seats',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minSeats?: number;

  @ApiPropertyOptional({
    description: 'Maximum number of seats (null for unlimited)',
    example: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxSeats?: number;

  @ApiPropertyOptional({
    description: 'Seat increment (how many seats can be added at once)',
    example: 5,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  seatIncrement?: number;

  @ApiPropertyOptional({
    description: 'Volume discount tiers (JSON)',
    example: [
      { minQuantity: 1, maxQuantity: 10, pricePerUnit: 99.99 },
      { minQuantity: 11, maxQuantity: 50, pricePerUnit: 89.99 },
      { minQuantity: 51, maxQuantity: null, pricePerUnit: 79.99 },
    ],
  })
  @IsOptional()
  volumeTiers?: any; // JSON field - can be array or object

  @ApiPropertyOptional({
    description: 'Billing interval (required when chargeType is recurring)',
    enum: BillingInterval,
    example: BillingInterval.MONTHLY,
  })
  @IsOptional()
  @IsEnum(BillingInterval)
  billingInterval?: BillingInterval;

  @ApiPropertyOptional({
    description: 'Whether product is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Whether product is an addon',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isAddon?: boolean;

  @ApiPropertyOptional({
    description: 'Additional metadata as JSON',
    example: { category: 'subscription', features: ['feature1', 'feature2'] },
  })
  @IsOptional()
  metadata?: any; // JSON field - flexible structure
}
