import { Body, BadRequestException, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AssetMarket } from '../../shared/enums';
import { ARStockPrice, BondPrice } from './ar-market/ar-market.types';
import { BondsService } from './ar-market/bonds.service';
import { DolarService } from './ar-market/dolar.service';
import { IngestionService } from './ingestion.service';
import { MacroArService } from './macro/macro-ar.service';
import { StocksArService } from './stocks/stocks-ar.service';

@ApiTags('market')
@Controller('market')
export class IngestionController {
  constructor(
    private readonly ingestionService: IngestionService,
    private readonly stocksArService: StocksArService,
    private readonly bondsService: BondsService,
    private readonly dolarService: DolarService,
    private readonly macroArService: MacroArService,
  ) {}

  @Get('prices')
  @ApiOperation({ summary: 'Obtener precios live de multiples activos' })
  @ApiQuery({ name: 'symbols', required: true, example: 'BTC,ETH,SOL' })
  @ApiQuery({ name: 'market', required: false, enum: AssetMarket, example: AssetMarket.CRYPTO })
  @ApiResponse({ status: 200, description: 'Precios live obtenidos correctamente.' })
  async getPrices(
    @Query('symbols') symbols: string,
    @Query('market') market?: AssetMarket,
  ): Promise<Array<{ symbol: string; market: AssetMarket; priceUsd: number | null; change24h: number | null; volume24h: number | null; lastUpdated: Date | null }>> {
    if (!symbols) {
      throw new BadRequestException('Debes indicar al menos un simbolo en el query param symbols.');
    }

    const parsedMarket = this.parseMarket(market);
    const symbolList = symbols.split(',').map((symbol) => symbol.trim().toUpperCase()).filter(Boolean);

    return this.ingestionService.getPrices(symbolList, parsedMarket);
  }

  @Get('prices/:symbol')
  @ApiOperation({ summary: 'Obtener precio live de un activo' })
  @ApiQuery({ name: 'market', required: false, enum: AssetMarket, example: AssetMarket.CRYPTO })
  @ApiResponse({ status: 200, description: 'Precio live obtenido correctamente.' })
  getPriceBySymbol(
    @Param('symbol') symbol: string,
    @Query('market') market?: AssetMarket,
  ) {
    return this.ingestionService.getPriceBySymbol(symbol.trim().toUpperCase(), this.parseMarket(market));
  }

  @Get('macro/ar')
  @ApiOperation({ summary: 'Obtener datos macroeconomicos de Argentina' })
  @ApiResponse({ status: 200, description: 'Datos macroeconomicos recuperados correctamente.' })
  getMacroAr() {
    return this.ingestionService.getMacroAr();
  }

  @Get('ar/stocks')
  @ApiOperation({ summary: 'Precios de acciones y CEDEARs argentinos' })
  @ApiQuery({ name: 'symbols', required: false, example: 'GGAL,YPFD,AAPL' })
  async getArStocks(@Query('symbols') symbols?: string): Promise<ARStockPrice[]> {
    if (!symbols) {
      return this.stocksArService.fetchAllPrices();
    }

    const requested = symbols.split(',').map((symbol) => symbol.trim().toUpperCase()).filter(Boolean);
    const results = await Promise.allSettled(requested.map((symbol) => this.stocksArService.fetchPrice(symbol)));

    return results
      .filter((result): result is PromiseFulfilledResult<ARStockPrice | null> => result.status === 'fulfilled')
      .map((result) => result.value)
      .filter((value): value is ARStockPrice => value !== null);
  }

  @Get('ar/stocks/:symbol')
  @ApiOperation({ summary: 'Precio de una accion o CEDEAR argentino' })
  getArStockBySymbol(@Param('symbol') symbol: string): Promise<ARStockPrice | null> {
    return this.stocksArService.fetchPrice(symbol.trim().toUpperCase());
  }

  @Get('ar/bonds')
  @ApiOperation({ summary: 'Precios de bonos soberanos y corporativos' })
  getArBonds(): Promise<BondPrice[]> {
    return this.bondsService.fetchBondPrices();
  }

  @Get('ar/bonds/:symbol')
  @ApiOperation({ summary: 'Precio de un bono argentino' })
  getArBondBySymbol(@Param('symbol') symbol: string): Promise<BondPrice | null> {
    return this.bondsService.getBondPrice(symbol.trim().toUpperCase());
  }

  @Get('ar/dolar')
  @ApiOperation({ summary: 'Cotizaciones del dolar argentino' })
  getDolarData() {
    return this.dolarService.getDolarData();
  }

  @Get('ar/macro')
  @ApiOperation({ summary: 'Indicadores macroeconomicos de Argentina' })
  getMacroData() {
    return this.macroArService.getMacroData();
  }

  @Get('ar/overview')
  @ApiOperation({ summary: 'Overview completo del mercado argentino en una sola llamada' })
  async getArOverview() {
    const [stocks, bonds, dolar, macro] = await Promise.all([
      this.stocksArService.fetchAllPrices(),
      this.bondsService.fetchBondPrices(),
      this.dolarService.getDolarData(),
      this.macroArService.getMacroData(),
    ]);

    return { stocks, bonds, dolar, macro };
  }

  @Get('diagnostic')
  @ApiOperation({ summary: 'Diagnostico de conectividad de fuentes de mercado' })
  getDiagnostic() {
    return this.ingestionService.getDiagnostic();
  }

  @Post('load-history')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Forzar carga historica para un simbolo puntual' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['symbol', 'market', 'days'],
      properties: {
        symbol: { type: 'string', example: 'BTC' },
        market: { type: 'string', enum: Object.values(AssetMarket), example: AssetMarket.CRYPTO },
        days: { type: 'number', example: 365 },
      },
    },
  })
  loadHistory(@Body() body: { symbol: string; market: AssetMarket; days: number }) {
    if (!body?.symbol || !body?.market || !Number.isFinite(body?.days) || body.days <= 0) {
      throw new BadRequestException('Body invalido. Debes enviar symbol, market y days.');
    }

    return this.ingestionService.loadHistory(body.symbol, body.market, Math.floor(body.days));
  }

  private parseMarket(market?: AssetMarket): AssetMarket {
    if (!market) {
      return AssetMarket.CRYPTO;
    }

    if (!Object.values(AssetMarket).includes(market)) {
      throw new BadRequestException('El mercado solicitado no es valido.');
    }

    return market;
  }
}
