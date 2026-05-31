import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsPositive, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCreditDto {
  @ApiPropertyOptional({
    description: 'Credit limit in account currency. Set to 0 to remove limit.',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  creditLimit?: number;

  @ApiPropertyOptional({
    description: 'Whether account is on credit hold',
  })
  @IsOptional()
  @IsBoolean()
  creditHold?: boolean;
}
