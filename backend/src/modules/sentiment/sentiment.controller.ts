import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { FindOptionsWhere, Like, Repository } from 'typeorm';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AssetMarket } from '../../shared/enums';
import { RedisPriceService } from '../ingestion/cache/redis-price.service';
import { NewsItem, NewsSentiment, NewsSource } from './entities/news-item.entity';
import { ScoreCalculatorService } from './score-calculator.service';
import { WATCHLIST_SYMBOLS } from './sentiment.constants';
import { SentimentAnalyzerService } from './sentiment-analyzer.service';
import { FearGreedSource } from './sources/fear-greed.source';
import { FearGreedData } from './sentiment.types';

class AnalyzeSentimentBodyDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsOptional()
  @IsString()
  symbol?: string;
}

@ApiTags('sentiment')
@Controller('sentiment')
export class SentimentController {
  constructor(
    @InjectRepository(NewsItem)
    private readonly newsItemRepository: Repository<NewsItem>,
    private readonly scoreCalculatorService: ScoreCalculatorService,
    private readonly sentimentAnalyzerService: SentimentAnalyzerService,
    private readonly fearGreedSource: FearGreedSource,
    private readonly redisPriceService: RedisPriceService,
  ) {}

  @Get('score/:symbol')
  @ApiOperation({ summary: 'Score de sentimiento actual del activo' })
  @ApiQuery({ name: 'market', required: false, enum: AssetMarket, example: AssetMarket.CRYPTO })
  @ApiResponse({ status: 200, description: 'Score de sentimiento recuperado correctamente.' })
  getScore(@Param('symbol') symbol: string, @Query('market') market?: AssetMarket) {
    return this.scoreCalculatorService.buildSentimentResult(
      symbol.trim().toUpperCase(),
      market ?? AssetMarket.CRYPTO,
    );
  }

  @Get('news')
  @ApiOperation({ summary: 'Feed de noticias analizadas con filtros' })
  @ApiQuery({ name: 'symbol', required: false, example: 'BTC' })
  @ApiQuery({ name: 'source', required: false, enum: NewsSource })
  @ApiQuery({ name: 'sentiment', required: false, enum: NewsSentiment })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  async getNews(
    @Query('symbol') symbol?: string,
    @Query('source') source?: NewsSource,
    @Query('sentiment') sentiment?: NewsSentiment,
    @Query('limit') limitQuery?: string,
    @Query('page') pageQuery?: string,
  ) {
    const limit = this.parsePositiveInteger(limitQuery, 20, 100);
    const page = this.parsePositiveInteger(pageQuery, 1);
    const where: FindOptionsWhere<NewsItem> = {};

    if (symbol) {
      where.symbols = Like(`%${symbol.trim().toUpperCase()}%`);
    }

    if (source) {
      where.source = source;
    }

    if (sentiment) {
      where.sentiment = sentiment;
    }

    const [data, total] = await this.newsItemRepository.findAndCount({
      where,
      order: { publishedAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return { data, total, page, limit };
  }

  @Get('overview')
  @ApiOperation({ summary: 'Overview de sentimiento del mercado' })
  getOverview() {
    return Promise.all(
      WATCHLIST_SYMBOLS.map((entry) =>
        this.scoreCalculatorService.buildSentimentResult(entry.symbol, entry.market),
      ),
    );
  }

  @Get('fear-greed')
  @ApiOperation({ summary: 'Indice Fear & Greed actual' })
  async getFearGreed(): Promise<FearGreedData | null> {
    const cached = await this.redisPriceService.getRawValue('sentiment:fear_greed');

    if (cached) {
      const parsed = JSON.parse(cached) as {
        value?: number;
        classification?: string;
        timestamp?: string;
      };

      if (typeof parsed.value === 'number') {
        return {
          value: parsed.value,
          classification: parsed.classification ?? 'Unknown',
          timestamp: parsed.timestamp ? new Date(parsed.timestamp) : new Date(),
        };
      }
    }

    return this.fearGreedSource.fetchFearGreed();
  }

  @Post('analyze')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Analizar sentimiento de texto custom' })
  @ApiBody({ type: AnalyzeSentimentBodyDto })
  async analyzeCustomText(@Body() body: AnalyzeSentimentBodyDto) {
    const result = await this.sentimentAnalyzerService.analyzeSentiment({
      title: body.text,
      summary: '',
      url: `custom://${body.symbol?.trim().toUpperCase() ?? 'TEXT'}`,
      source: 'OTHER',
      publishedAt: new Date(),
      language: 'es',
    });

    return {
      sentiment: result.sentiment ?? 'NEUTRAL',
      score: result.sentimentScore ?? 50,
      intensity: result.intensity ?? 'LOW',
      summary: result.aiSummary ?? '',
    };
  }

  private parsePositiveInteger(value: string | undefined, fallback: number, max?: number): number {
    const parsed = Number(value ?? fallback);

    if (!Number.isFinite(parsed) || parsed < 1) {
      return fallback;
    }

    if (typeof max === 'number') {
      return Math.min(max, Math.floor(parsed));
    }

    return Math.floor(parsed);
  }
}