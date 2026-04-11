import { Injectable } from '@nestjs/common';

import { AssetMarket } from '../../shared/enums';
import { AnalysisService } from '../analysis/analysis.service';
import { TechnicalAnalysis } from '../analysis/analysis.types';
import { RedisPriceService } from '../ingestion/cache/redis-price.service';
import { MacroArService } from '../ingestion/macro/macro-ar.service';
import { StocksArService } from '../ingestion/stocks/stocks-ar.service';
import { ScoreCalculatorService } from '../sentiment/score-calculator.service';
import { MarketOverview, StrategyRecommendation, StrategyScore } from './strategy.types';

@Injectable()
export class StrategyService {
  private readonly stakingAssets = new Set(['ETH', 'SOL', 'ADA', 'DOT', 'MATIC', 'AVAX', 'ATOM']);

  constructor(
    private readonly analysisService: AnalysisService,
    private readonly redisPriceService: RedisPriceService,
    private readonly scoreCalculatorService: ScoreCalculatorService,
    private readonly macroArService: MacroArService,
    private readonly stocksArService: StocksArService,
  ) {}

  scoreHolding(analysis: TechnicalAnalysis): number {
    let score = 0;

    if (analysis.rsi.value !== null && analysis.rsi.value >= 40 && analysis.rsi.value <= 60) {
      score += 20;
    }

    if (analysis.trend.direction === 'UP') {
      score += analysis.trend.strength === 'STRONG' ? 25 : analysis.trend.strength === 'MODERATE' ? 15 : 5;
    }

    if (analysis.macd.trend === 'BULLISH') {
      score += 20;
    }

    if (analysis.bollinger.position === 'INSIDE') {
      score += 15;
    }

    if ((analysis.volume.relativeVolume ?? 0) > 1.2) {
      score += 10;
    }

    if (analysis.atr.volatility === 'LOW') {
      score += 10;
    }

    return this.clampScore(score);
  }

  scoreGridBot(analysis: TechnicalAnalysis): number {
    let score = 0;

    if (analysis.trend.direction === 'LATERAL') {
      score += 35;
    }

    if (analysis.atr.volatility === 'HIGH') {
      score += 25;
    }

    if ((analysis.bollinger.width ?? 0) > 5) {
      score += 20;
    }

    if (analysis.rsi.value !== null && analysis.rsi.value >= 40 && analysis.rsi.value <= 60) {
      score += 10;
    }

    const relativeVolume = analysis.volume.relativeVolume ?? 0;
    if (relativeVolume >= 0.8 && relativeVolume <= 1.5) {
      score += 10;
    }

    return this.clampScore(score);
  }

  scoreLong(analysis: TechnicalAnalysis): number {
    let score = 0;

    if (analysis.rsi.value !== null && analysis.rsi.value < 35) {
      score += 30;
    }

    if ((analysis.macd.histogram ?? 0) > 0) {
      score += 25;
    }

    if (analysis.bollinger.position === 'BELOW' || this.isNearLowerBollinger(analysis)) {
      score += 20;
    }

    if ((analysis.trend.days7 ?? 0) > 0) {
      score += 15;
    }

    if ((analysis.volume.relativeVolume ?? 0) > 1.3) {
      score += 10;
    }

    return this.clampScore(score);
  }

  scoreShort(analysis: TechnicalAnalysis): number {
    let score = 0;

    if (analysis.rsi.value !== null && analysis.rsi.value > 65) {
      score += 30;
    }

    if ((analysis.macd.histogram ?? 0) < 0) {
      score += 25;
    }

    if (analysis.bollinger.position === 'ABOVE' || this.isNearUpperBollinger(analysis)) {
      score += 20;
    }

    if ((analysis.trend.days7 ?? 0) < 0) {
      score += 15;
    }

    if ((analysis.volume.relativeVolume ?? 0) > 1.3) {
      score += 10;
    }

    return this.clampScore(score);
  }

  scoreStaking(analysis: TechnicalAnalysis): number {
    if (analysis.market !== AssetMarket.CRYPTO || !this.stakingAssets.has(analysis.symbol)) {
      return 0;
    }

    let score = 0;

    if (analysis.atr.volatility === 'LOW' || analysis.atr.volatility === 'MEDIUM') {
      score += 40;
    }

    if (!(analysis.trend.direction === 'DOWN' && analysis.trend.strength === 'STRONG')) {
      score += 30;
    }

    if (analysis.rsi.value !== null && analysis.rsi.value >= 30 && analysis.rsi.value <= 70) {
      score += 30;
    }

    return this.clampScore(score);
  }

  generateReasoning(analysis: TechnicalAnalysis, scores: StrategyScore[]): string[] {
    const reasons: string[] = [];
    const topStrategy = scores[0]?.strategy;

    if (analysis.rsi.value !== null && analysis.rsi.value < 35) {
      reasons.push(`RSI en ${analysis.rsi.value.toFixed(2)} - zona de sobreventa, posible rebote.`);
    } else if (analysis.rsi.value !== null && analysis.rsi.value > 65) {
      reasons.push(`RSI en ${analysis.rsi.value.toFixed(2)} - zona de sobrecompra, posible correccion.`);
    }

    if (analysis.macd.trend === 'BULLISH') {
      reasons.push('MACD cruzando al alza - momentum positivo.');
    } else if (analysis.macd.trend === 'BEARISH') {
      reasons.push('MACD cruzando a la baja - momentum debil.');
    }

    if (topStrategy === 'GRID_BOT' && analysis.trend.direction === 'LATERAL') {
      reasons.push('Mercado lateral reciente - ideal para una estrategia grid bot.');
    }

    if ((analysis.bollinger.width ?? 0) > 5) {
      reasons.push(`Bandas de Bollinger amplias (${analysis.bollinger.width?.toFixed(2)}%) - rango atractivo para capturar oscilaciones.`);
    }

    if ((analysis.volume.relativeVolume ?? 0) > 1.3) {
      reasons.push(`Volumen ${analysis.volume.relativeVolume?.toFixed(2)}x sobre el promedio - confirmacion de movimiento.`);
    }

    if (analysis.atr.value !== null) {
      const atrPct = (analysis.atr.value / analysis.lastPrice) * 100;
      reasons.push(`ATR alto (${atrPct.toFixed(2)}%) - volatilidad ${analysis.atr.volatility.toLowerCase()}.`);
    }

    return reasons.slice(0, 5);
  }

  calculateEntryTarget(
    analysis: TechnicalAnalysis,
    strategy: StrategyScore['strategy'],
  ): { entryPrice: number | null; targetPrice: number | null; stopLoss: number | null; riskReward: number | null } {
    const entry = analysis.lastPrice;

    if (strategy === 'LONG') {
      const target = this.round(entry * 1.05);
      const stopLoss = this.round(entry * 0.97);
      return {
        entryPrice: entry,
        targetPrice: target,
        stopLoss,
        riskReward: this.round((target - entry) / (entry - stopLoss)),
      };
    }

    if (strategy === 'SHORT') {
      const target = this.round(entry * 0.95);
      const stopLoss = this.round(entry * 1.03);
      return {
        entryPrice: entry,
        targetPrice: target,
        stopLoss,
        riskReward: this.round((entry - target) / (stopLoss - entry)),
      };
    }

    if (strategy === 'GRID_BOT') {
      return {
        entryPrice: analysis.bollinger.lower,
        targetPrice: analysis.bollinger.upper,
        stopLoss: null,
        riskReward: null,
      };
    }

    return {
      entryPrice: null,
      targetPrice: null,
      stopLoss: null,
      riskReward: null,
    };
  }

  async recommendAsset(symbol: string, market: AssetMarket): Promise<StrategyRecommendation> {
    const analysis = await this.analysisService.analyzeAsset(symbol, market);
    const rawScores = await Promise.all([
      Promise.resolve(this.buildScore('HOLDING', this.scoreHolding(analysis))),
      Promise.resolve(this.buildScore('STAKING', this.scoreStaking(analysis))),
      Promise.resolve(this.buildScore('GRID_BOT', this.scoreGridBot(analysis))),
      Promise.resolve(this.buildScore('LONG', this.scoreLong(analysis))),
      Promise.resolve(this.buildScore('SHORT', this.scoreShort(analysis))),
    ]);

    const allScores = rawScores.sort((left, right) => right.score - left.score);
    const topStrategy = allScores[0];
    const technicalReasoning = this.generateReasoning(analysis, allScores);
    const macroReasoning = await this.buildMacroReasoning(market);
    const reasoning = [...technicalReasoning, ...macroReasoning];
    const levels = this.calculateEntryTarget(analysis, topStrategy.strategy);

    return {
      symbol: analysis.symbol,
      market,
      topStrategy,
      allScores,
      reasoning,
      entryPrice: levels.entryPrice,
      targetPrice: levels.targetPrice,
      stopLoss: levels.stopLoss,
      riskReward: levels.riskReward,
      suggestedCapital: {
        min: this.round(analysis.lastPrice * 10),
        recommended: Math.min(10_000, this.round(analysis.lastPrice * 50)),
      },
      generatedAt: new Date(),
    };
  }

  async recommendWithSentiment(symbol: string, market: AssetMarket): Promise<StrategyRecommendation> {
    const recommendation = await this.recommendAsset(symbol, market);
    const sentiment = await this.scoreCalculatorService.buildSentimentResult(symbol, market);
    const adjustedScores = recommendation.allScores
      .map((score) => {
        let adjustedScore = score.score;

        if (score.strategy === 'LONG' && sentiment.score > 60) {
          adjustedScore += 10;
        }

        if (score.strategy === 'SHORT' && sentiment.score < 40) {
          adjustedScore += 10;
        }

        if (score.strategy === 'HOLDING' && sentiment.score > 55) {
          adjustedScore += 5;
        }

        return this.buildScore(score.strategy, adjustedScore);
      })
      .sort((left, right) => right.score - left.score);

    return {
      ...recommendation,
      topStrategy: adjustedScores[0],
      allScores: adjustedScores,
      reasoning: [
        ...recommendation.reasoning,
        `Sentimiento del mercado: ${sentiment.signal} (${sentiment.score}/100)`,
      ],
      sentiment,
      generatedAt: new Date(),
    };
  }

  async getMarketOverview(symbols: string[], market: AssetMarket): Promise<MarketOverview[]> {
    const results = await Promise.allSettled(
      symbols.map(async (symbol) => {
        const [recommendation, liveEntry, historicalPerformance, stockPrice] = await Promise.all([
          this.recommendAsset(symbol, market),
          this.redisPriceService.getPriceEntry(symbol, market),
          this.analysisService.getHistoricalPerformance(symbol, market),
          market === AssetMarket.STOCK_AR ? this.stocksArService.fetchPrice(symbol) : Promise.resolve(null),
        ]);

        return {
          recommendation,
          liveEntry,
          historicalPerformance,
          stockPrice,
        };
      }),
    );

    return results
      .filter((result): result is PromiseFulfilledResult<{ recommendation: StrategyRecommendation; liveEntry: Awaited<ReturnType<RedisPriceService['getPriceEntry']>>; historicalPerformance: Awaited<ReturnType<AnalysisService['getHistoricalPerformance']>>; stockPrice: Awaited<ReturnType<StocksArService['fetchPrice']>> }> => result.status === 'fulfilled')
      .map((result) => ({
        symbol: result.value.recommendation.symbol,
        market: result.value.recommendation.market,
        priceUsd: result.value.liveEntry?.price ?? result.value.stockPrice?.priceUsd ?? result.value.recommendation.entryPrice,
        change24h: result.value.liveEntry?.change24h ?? result.value.stockPrice?.change24h ?? null,
        change7d: result.value.historicalPerformance.change7d,
        change30d: result.value.historicalPerformance.change30d,
        change6m: result.value.stockPrice?.change6m ?? result.value.historicalPerformance.change6m,
        change1y: result.value.stockPrice?.change1y ?? result.value.historicalPerformance.change1y,
        topStrategy: result.value.recommendation.topStrategy.strategy,
        topScore: result.value.recommendation.topStrategy.score,
        confidence: result.value.recommendation.topStrategy.confidence,
        lastAnalyzed: result.value.recommendation.generatedAt,
      }));
  }

  private async buildMacroReasoning(market: AssetMarket): Promise<string[]> {
    if (!(market === AssetMarket.STOCK_AR || market === AssetMarket.BOND)) {
      return [];
    }

    const [macro, dolarMep, context] = await Promise.all([
      this.macroArService.getMacroData(),
      this.macroArService.getDolarMep(),
      this.macroArService.getMacroContext(),
    ]);

    const reasons: string[] = [];

    if (macro.inflacionMensual !== null && macro.inflacionMensual > 5) {
      reasons.push(`Inflacion alta (${macro.inflacionMensual.toFixed(2)}% mensual) - considerar activos dolarizados.`);
    }

    if (
      macro.tcOficial !== null &&
      dolarMep !== null &&
      macro.tcOficial > 0 &&
      dolarMep > macro.tcOficial * 1.15
    ) {
      const brecha = ((dolarMep / macro.tcOficial) - 1) * 100;
      reasons.push(`Brecha cambiaria alta (${brecha.toFixed(2)}%) - riesgo de devaluacion.`);
    }

    if (macro.reservasUsd !== null && macro.reservasUsd < 30_000) {
      reasons.push('Reservas bajas - mayor riesgo soberano.');
    }

    return reasons.length > 0 ? [context, ...reasons] : [];
  }

  private buildScore(strategy: StrategyScore['strategy'], score: number): StrategyScore {
    return {
      strategy,
      score: this.clampScore(score),
      confidence: score > 75 ? 'HIGH' : score > 50 ? 'MEDIUM' : 'LOW',
    };
  }

  private clampScore(score: number): number {
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private isNearLowerBollinger(analysis: TechnicalAnalysis): boolean {
    if (analysis.bollinger.lower === null) {
      return false;
    }

    return analysis.lastPrice <= analysis.bollinger.lower * 1.02;
  }

  private isNearUpperBollinger(analysis: TechnicalAnalysis): boolean {
    if (analysis.bollinger.upper === null) {
      return false;
    }

    return analysis.lastPrice >= analysis.bollinger.upper * 0.98;
  }

  private round(value: number): number {
    return Number(value.toFixed(4));
  }
}

