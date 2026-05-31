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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ExchangeRatesService } from './exchange-rates.service';
import {
  CreateExchangeRateDto,
  UpdateExchangeRateDto,
  ConvertCurrencyDto,
  QueryExchangeRatesDto,
} from './dto';

@ApiTags('Exchange Rates')
@Controller('api/exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create or update exchange rate (upsert)',
    description:
      'Upserts an exchange rate for a currency pair on a specific effective date. ' +
      'If a rate already exists for the same fromCurrency + toCurrency + effectiveDate, it is updated.',
  })
  @ApiResponse({ status: 201, description: 'Exchange rate created or updated' })
  @ApiResponse({ status: 400, description: 'Validation error or same-currency pair' })
  upsert(@Body() dto: CreateExchangeRateDto) {
    return this.exchangeRatesService.upsert(dto);
  }

  @Get('convert')
  @ApiOperation({
    summary: 'Convert an amount between two currencies',
    description:
      'Returns the converted amount using the most-recent rate on or before the given date. ' +
      'If from === to, the original amount is returned immediately without a DB lookup.',
  })
  @ApiQuery({ name: 'amount', type: Number, example: 1000 })
  @ApiQuery({ name: 'from', type: String, example: 'USD' })
  @ApiQuery({ name: 'to', type: String, example: 'EUR' })
  @ApiQuery({ name: 'date', type: String, required: false, example: '2026-05-31' })
  @ApiResponse({ status: 200, description: 'Conversion result' })
  @ApiResponse({ status: 404, description: 'No exchange rate found for the currency pair on or before the requested date' })
  convert(@Query() dto: ConvertCurrencyDto) {
    return this.exchangeRatesService.convert(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List exchange rates',
    description:
      'Returns a paginated list of exchange rates. Supports operator-based filtering ' +
      '(fromCurrency[eq], toCurrency[eq], source[eq], effectiveDate[gte], effectiveDate[lte]).',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of exchange rates' })
  findAll(@Query() query: QueryExchangeRatesDto) {
    return this.exchangeRatesService.findAll(query);
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: 'string', description: 'Exchange rate UUID' })
  @ApiOperation({ summary: 'Get exchange rate by ID' })
  @ApiResponse({ status: 200, description: 'Exchange rate details' })
  @ApiResponse({ status: 404, description: 'Exchange rate not found' })
  findOne(@Param('id') id: string) {
    return this.exchangeRatesService.findOne(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: 'string', description: 'Exchange rate UUID' })
  @ApiOperation({
    summary: 'Update exchange rate',
    description: 'Updates the rate value and/or source. Currency pair and effectiveDate are immutable.',
  })
  @ApiResponse({ status: 200, description: 'Exchange rate updated' })
  @ApiResponse({ status: 404, description: 'Exchange rate not found' })
  update(@Param('id') id: string, @Body() dto: UpdateExchangeRateDto) {
    return this.exchangeRatesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', type: 'string', description: 'Exchange rate UUID' })
  @ApiOperation({ summary: 'Delete exchange rate' })
  @ApiResponse({ status: 204, description: 'Exchange rate deleted' })
  @ApiResponse({ status: 404, description: 'Exchange rate not found' })
  async remove(@Param('id') id: string) {
    await this.exchangeRatesService.remove(id);
  }
}
