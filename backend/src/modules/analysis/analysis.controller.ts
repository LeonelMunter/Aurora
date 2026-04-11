import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AssetMarket } from '../../shared/enums';
import { StrategyService } from '../strategy/strategy.service';
import { AnalysisService } from './analysis.service';

@ApiTags('analysis')
@Controller('analysis')
export class AnalysisController {
  private readonly cryptoOverviewSymbols = ['BTC', 'ETH', 'SOL', 'BNB', 'ADA', 'MATIC', 'DOT', 'AVAX', 'LINK', 'UNI'];
  private readonly stocksOverviewSymbols = ['GGAL', 'YPFD', 'BMA', 'PAMP', 'TXAR', 'ALUA', 'BYMA', 'SUPV', 'TECO2', 'LOMA'];

  constructor(
    private readonly analysisService: AnalysisService,
    private readonly strategyService: StrategyService,
  ) {}

  @Get('overview/crypto')
  @ApiOperation({ summary: 'Overview del mercado cripto con top scores' })
  @ApiResponse({ status: 200, description: 'Overview cripto recuperado correctamente.' })
  getCryptoOverview() {
    return this.strategyService.getMarketOverview(this.cryptoOverviewSymbols, AssetMarket.CRYPTO);
  }

  @Get('overview/stocks-ar')
  @ApiOperation({ summary: 'Overview de acciones argentinas' })
  @ApiResponse({ status: 200, description: 'Overview de acciones argentinas recuperado correctamente.' })
  getStocksOverview() {
    return this.strategyService.getMarketOverview(this.stocksOverviewSymbols, AssetMarket.STOCK_AR);
  }

  @Get('coverage/report')
  @ApiOperation({ summary: 'Diagnostico de cobertura de datos por simbolo' })
  @ApiQuery({ name: 'symbols', required: true, example: 'BTC,ETH,BBAR,DASH' })
  @ApiQuery({ name: 'market', required: false, enum: AssetMarket, example: AssetMarket.CRYPTO })
  getCoverageReport(
    @Query('symbols') symbols: string,
    @Query('market') market?: AssetMarket,
  ) {
    const requested = symbols.split(',').map((symbol) => symbol.trim()).filter(Boolean);
    return this.analysisService.getCoverageReport(requested, market ?? AssetMarket.CRYPTO);
  }

  @Get(':symbol/candles')
  @ApiOperation({ summary: 'Velas historicas para grafico de detalle' })
  @ApiQuery({ name: 'market', required: false, enum: AssetMarket, example: AssetMarket.STOCK_AR })
  @ApiQuery({ name: 'interval', required: false, example: '1d' })
  @ApiQuery({ name: 'days', required: false, example: 365 })
  getCandles(
    @Param('symbol') symbol: string,
    @Query('market') market?: AssetMarket,
    @Query('interval') interval = '1d',
    @Query('days') days?: string,
  ) {
    const parsedDays = Number(days ?? '365');
    return this.analysisService.getCandlesForChart(
      symbol,
      market ?? AssetMarket.CRYPTO,
      Number.isFinite(parsedDays) && parsedDays > 0 ? Math.floor(parsedDays) : 365,
      interval,
    );
  }

  @Get(':symbol/recommendation')
  @ApiOperation({ summary: 'Recomendacion de estrategia con scoring' })
  @ApiQuery({ name: 'market', required: false, enum: AssetMarket, example: AssetMarket.CRYPTO })
  @ApiResponse({ status: 200, description: 'Recomendacion generada correctamente.' })
  getRecommendation(@Param('symbol') symbol: string, @Query('market') market?: AssetMarket) {
    return this.strategyService.recommendAsset(symbol.trim().toUpperCase(), market ?? AssetMarket.CRYPTO);
  }

  @Get(':symbol/full-recommendation')
  @ApiOperation({ summary: 'Recomendacion enriquecida con sentimiento de mercado' })
  @ApiQuery({ name: 'market', required: false, enum: AssetMarket, example: AssetMarket.CRYPTO })
  @ApiResponse({ status: 200, description: 'Recomendacion completa generada correctamente.' })
  getFullRecommendation(@Param('symbol') symbol: string, @Query('market') market?: AssetMarket) {
    return this.strategyService.recommendWithSentiment(symbol.trim().toUpperCase(), market ?? AssetMarket.CRYPTO);
  }

  @Get(':symbol')
  @ApiOperation({ summary: 'Analisis tecnico completo de un activo' })
  @ApiQuery({ name: 'market', required: false, enum: AssetMarket, example: AssetMarket.CRYPTO })
  @ApiQuery({ name: 'interval', required: false, example: '1d' })
  @ApiResponse({ status: 200, description: 'Analisis tecnico recuperado correctamente.' })
  @ApiResponse({ status: 400, description: 'Símbolo inválido.' })
  @ApiResponse({ status: 404, description: 'No hay datos para el símbolo solicitado.' })
  getAnalysis(
    @Param('symbol') symbol: string,
    @Query('market') market?: AssetMarket,
    @Query('interval') interval = '1d',
  ) {
    return this.analysisService.analyzeAsset(symbol, market ?? AssetMarket.CRYPTO, interval);
  }
}
