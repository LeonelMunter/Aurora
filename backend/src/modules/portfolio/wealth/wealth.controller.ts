import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AuthenticatedRequestUser, CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { WealthService } from './wealth.service';

@ApiTags('portfolio')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('portfolio/:portfolioId/wealth')
export class WealthController {
  constructor(private readonly wealthService: WealthService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Resumen patrimonial completo con posiciones y valores actuales' })
  @ApiResponse({ status: 200, description: 'Resumen patrimonial recuperado correctamente.' })
  getWealthSummary(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('portfolioId', new ParseUUIDPipe()) portfolioId: string,
  ) {
    return this.wealthService.getWealthSummary(user.userId, portfolioId);
  }

  @Get('chart')
  @ApiOperation({ summary: 'Datos historicos para el grafico de evolucion' })
  @ApiResponse({ status: 200, description: 'Serie historica recuperada correctamente.' })
  getHistoricalChart(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('portfolioId', new ParseUUIDPipe()) portfolioId: string,
    @Query('period') period: '7D' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL' = '1M',
  ) {
    return this.wealthService.getHistoricalChart(user.userId, portfolioId, period);
  }

  @Get('comparison')
  @ApiOperation({ summary: 'Comparacion con periodos anteriores' })
  @ApiResponse({ status: 200, description: 'Comparativas recuperadas correctamente.' })
  getPeriodComparison(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('portfolioId', new ParseUUIDPipe()) portfolioId: string,
  ) {
    return this.wealthService.getPeriodComparison(user.userId, portfolioId);
  }

  @Get('staking')
  @ApiOperation({ summary: 'Metricas de rewards de staking y proyecciones' })
  @ApiResponse({ status: 200, description: 'Metricas de staking recuperadas correctamente.' })
  getStakingMetrics(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('portfolioId', new ParseUUIDPipe()) portfolioId: string,
  ) {
    return this.wealthService.getStakingMetrics(user.userId, portfolioId);
  }

  @Get('risk')
  @ApiOperation({ summary: 'Metricas de diversificacion y riesgo' })
  @ApiResponse({ status: 200, description: 'Metricas de riesgo recuperadas correctamente.' })
  getRiskMetrics(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('portfolioId', new ParseUUIDPipe()) portfolioId: string,
  ) {
    return this.wealthService.getRiskMetrics(user.userId, portfolioId);
  }
}
