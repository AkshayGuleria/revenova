import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { TaxRatesService } from './tax-rates.service';
import { CreateTaxRateDto, UpdateTaxRateDto, CalculateTaxDto } from './dto';

@ApiTags('Tax Rates')
@Controller('api/tax-rates')
export class TaxRatesController {
  constructor(private readonly taxRatesService: TaxRatesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create tax rate for a jurisdiction' })
  create(@Body() dto: CreateTaxRateDto) {
    return this.taxRatesService.create(dto);
  }

  @Get('calculate')
  @ApiOperation({ summary: 'Calculate tax for an amount and jurisdiction' })
  calculate(@Query() dto: CalculateTaxDto) {
    return this.taxRatesService.calculateTax(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List tax rates with filtering and pagination' })
  findAll(@Query() query: Record<string, any>) {
    return this.taxRatesService.findAll(query);
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Get tax rate by ID' })
  findOne(@Param('id') id: string) {
    return this.taxRatesService.findOne(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Update tax rate' })
  update(@Param('id') id: string, @Body() dto: UpdateTaxRateDto) {
    return this.taxRatesService.update(id, dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiOperation({ summary: 'Deactivate tax rate (soft delete)' })
  deactivate(@Param('id') id: string) {
    return this.taxRatesService.deactivate(id);
  }
}
