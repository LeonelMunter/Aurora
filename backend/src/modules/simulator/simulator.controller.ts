import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { SimulatorConfig, SimulatorResult } from './simulator.types';
import { BacktestEngineService } from './backtest-engine.service';

@Controller('simulator')
export class SimulatorController {
  constructor(private readonly backtestEngine: BacktestEngineService) {}

  @Post('run')
  async runBacktest(@Body() config: SimulatorConfig): Promise<SimulatorResult> {
    return this.backtestEngine.run(config);
  }

  @Post('compare')
  async compareStrategies(@Body() body: { configs: SimulatorConfig[] }): Promise<SimulatorResult[]> {
    if (!body.configs || body.configs.length === 0) {
      throw new BadRequestException('Se debe proporcionar al menos una configuracion.');
    }

    if (body.configs.length > 3) {
      throw new BadRequestException('Se pueden comparar como maximo 3 estrategias.');
    }

    return Promise.all(body.configs.map((config) => this.backtestEngine.run(config)));
  }

  @Get('presets/:symbol')
  async getPresets(
    @Param('symbol') symbol: string,
    @Query('market') market = 'CRYPTO',
  ): Promise<SimulatorConfig[]> {
    const today = new Date();
    const oneYearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
    const threeMonthsAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    return [
      {
        symbol,
        market: market as any,
        strategy: 'HOLDING',
        capital: 1000,
        startDate: formatDate(oneYearAgo),
        endDate: formatDate(today),
        holdingParams: {},
      },
      {
        symbol,
        market: market as any,
        strategy: 'GRID_BOT',
        capital: 1000,
        startDate: formatDate(threeMonthsAgo),
        endDate: formatDate(today),
        gridParams: {
          rangeMin: 0,
          rangeMax: 0,
          gridCount: 20,
          useAutoRange: true,
        },
      },
      {
        symbol,
        market: market as any,
        strategy: 'DCA',
        capital: 1000,
        startDate: formatDate(sixMonthsAgo),
        endDate: formatDate(today),
        dcaParams: {
          intervalDays: 30,
          amountPerBuy: 100,
        },
      },
    ];
  }
}
