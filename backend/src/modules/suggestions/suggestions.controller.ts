import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser, AuthenticatedRequestUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AssetMarket } from '../../shared/enums';
import { RedisPriceService } from '../ingestion/cache/redis-price.service';
import { EmergingDetectorService } from './emerging-detector.service';
import { SuggestionBotService } from './suggestion-bot.service';
import { RiskLevel, SuggestionCategory, SuggestionFilters, TimeHorizon } from './suggestions.types';
import { SuggestionsService } from './suggestions.service';

interface SuggestionChatBody {
  message: string;
  sessionId: string;
  symbol?: string;
  market?: AssetMarket;
}

@ApiTags('suggestions')
@Controller('suggestions')
export class SuggestionsController {
  constructor(
    private readonly suggestionsService: SuggestionsService,
    private readonly emergingDetectorService: EmergingDetectorService,
    private readonly redisPriceService: RedisPriceService,
    private readonly suggestionBotService: SuggestionBotService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Sugerencias filtradas ordenadas por conviction score' })
  @ApiResponse({ status: 200, description: 'Sugerencias activas recuperadas correctamente.' })
  getSuggestions(
    @Query('market') market?: AssetMarket,
    @Query('category') category?: SuggestionCategory,
    @Query('riskLevel') riskLevel?: RiskLevel,
    @Query('timeHorizon') timeHorizon?: TimeHorizon,
    @Query('minScore') minScore?: string,
    @Query('limit') limit?: string,
  ) {
    const filters: SuggestionFilters = {
      market,
      category,
      riskLevel,
      timeHorizon,
      minScore: this.parseNumber(minScore),
      limit: this.parseInteger(limit),
    };
    return this.suggestionsService.getSuggestions(filters);
  }

  @Get('top')
  @ApiOperation({ summary: 'Top sugerencias del momento' })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  getTopSuggestions(@Query('limit') limit?: string) {
    return this.suggestionsService.getTopSuggestions(this.parseInteger(limit) ?? 10);
  }

  @Get('by-category')
  @ApiOperation({ summary: 'Sugerencias agrupadas por categoria' })
  getSuggestionsByCategory() {
    return this.suggestionsService.getSuggestionsByCategory();
  }

  @Get('emerging')
  @ApiOperation({ summary: 'Activos emergentes detectados' })
  getEmergingAssets() {
    return this.emergingDetectorService.getEmergingAssets();
  }

  @Post('chat')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chat con el bot de sugerencias' })
  async chat(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Body() body: SuggestionChatBody,
  ) {
    const result = await this.suggestionBotService.chat(
      user.userId,
      body.sessionId,
      body.message,
      body.symbol,
      body.market,
    );

    return {
      response: result.response,
      sessionId: body.sessionId,
      tokensUsed: result.tokensUsed,
    };
  }

  @Get('chat/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Historial del chat de sugerencias' })
  getChatHistory(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('sessionId') sessionId: string,
  ) {
    return this.suggestionBotService.getHistory(user.userId, sessionId);
  }

  @Delete('chat/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Limpiar historial del chat de sugerencias' })
  async clearChatSession(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('sessionId') sessionId: string,
  ) {
    await this.suggestionBotService.clearSession(user.userId, sessionId);
    return { message: 'Sesion limpiada' };
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async refreshSuggestions() {
    void this.suggestionsService.refreshSuggestions();
    return { message: 'Refresh iniciado' };
  }

  @Get('morning-brief')
  @ApiOperation({ summary: 'Top 5 sugerencias del dia desde Redis' })
  async getMorningBrief() {
    const cached = await this.redisPriceService.getRawValue('suggestions:morning_brief');
    return cached ? JSON.parse(cached) : [];
  }

  @Get(':symbol')
  @ApiOperation({ summary: 'Detalle completo de una sugerencia' })
  @ApiQuery({ name: 'market', required: false, enum: AssetMarket, example: AssetMarket.CRYPTO })
  getSuggestionDetail(
    @Param('symbol') symbol: string,
    @Query('market') market?: AssetMarket,
  ) {
    return this.suggestionsService.getSuggestionDetail(symbol, market ?? AssetMarket.CRYPTO);
  }

  private parseNumber(value?: string): number | undefined {
    if (!value) {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private parseInteger(value?: string): number | undefined {
    if (!value) {
      return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}
