import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Portfolio } from '../entities/portfolio.entity';
import { WealthService } from './wealth.service';

@Injectable()
export class WealthScheduler {
  private readonly logger = new Logger(WealthScheduler.name);

  constructor(
    @InjectRepository(Portfolio)
    private readonly portfolioRepository: Repository<Portfolio>,
    private readonly wealthService: WealthService,
  ) {}

  @Cron('0 23 * * *')
  async takeAllSnapshots(): Promise<void> {
    const portfolios = await this.portfolioRepository.find();
    let savedSnapshots = 0;

    for (const portfolio of portfolios) {
      try {
        await this.wealthService.getWealthSummary(portfolio.userId, portfolio.id);
        savedSnapshots += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        this.logger.warn(`No se pudo generar el snapshot del portfolio ${portfolio.id}: ${message}`);
      }
    }

    this.logger.log(`Snapshots patrimoniales procesados: ${savedSnapshots}`);
  }
}
