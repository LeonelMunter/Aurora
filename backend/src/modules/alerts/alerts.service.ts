import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { Alert } from './entities/alert.entity';
import { AlertTriggerContext, AlertType } from './alerts.types';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
  ) {}

  async create(userId: string, dto: CreateAlertDto): Promise<Alert> {
    const alert = this.alertRepository.create({
      userId,
      name: dto.name.trim(),
      type: dto.type,
      symbol: dto.symbol?.trim().toUpperCase() ?? null,
      market: dto.market ?? null,
      threshold: dto.threshold,
      channel: dto.channel,
      telegramChatId: dto.telegramChatId?.trim() ?? null,
      emailAddress: dto.emailAddress?.trim().toLowerCase() ?? null,
      cooldownMin: dto.cooldownMin ?? 60,
      currentValue: null,
      lastTriggered: null,
    });

    return this.alertRepository.save(alert);
  }

  async findAll(userId: string): Promise<Alert[]> {
    return this.alertRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(userId: string, alertId: string): Promise<Alert> {
    const alert = await this.alertRepository.findOne({
      where: { id: alertId, userId },
    });

    if (!alert) {
      throw new NotFoundException('No se encontro la alerta solicitada para el usuario.');
    }

    return alert;
  }

  async update(userId: string, alertId: string, dto: UpdateAlertDto): Promise<Alert> {
    const alert = await this.findOne(userId, alertId);

    if (dto.name !== undefined) {
      alert.name = dto.name.trim();
    }
    if (dto.type !== undefined) {
      alert.type = dto.type;
    }
    if (dto.symbol !== undefined) {
      alert.symbol = dto.symbol.trim().toUpperCase();
    }
    if (dto.market !== undefined) {
      alert.market = dto.market;
    }
    if (dto.threshold !== undefined) {
      alert.threshold = dto.threshold;
    }
    if (dto.channel !== undefined) {
      alert.channel = dto.channel;
    }
    if (dto.telegramChatId !== undefined) {
      alert.telegramChatId = dto.telegramChatId.trim();
    }
    if (dto.emailAddress !== undefined) {
      alert.emailAddress = dto.emailAddress.trim().toLowerCase();
    }
    if (dto.cooldownMin !== undefined) {
      alert.cooldownMin = Math.max(5, dto.cooldownMin);
    }
    if (dto.isActive !== undefined) {
      alert.isActive = dto.isActive;
    }

    return this.alertRepository.save(alert);
  }

  async remove(userId: string, alertId: string): Promise<void> {
    const alert = await this.findOne(userId, alertId);
    await this.alertRepository.remove(alert);
  }

  async testAlert(userId: string, alertId: string): Promise<AlertTriggerContext> {
    const alert = await this.findOne(userId, alertId);
    const currentValue = this.buildSampleValue(alert.type, alert.threshold);
    return this.buildTriggerContext(alert, currentValue, true);
  }

  buildTriggerContext(alert: Alert, currentValue: number, isTest = false): AlertTriggerContext {
    const message = this.buildMessage(alert, currentValue, isTest);

    return {
      alertId: alert.id,
      userId: alert.userId,
      type: alert.type,
      symbol: alert.symbol ?? undefined,
      market: alert.market ?? undefined,
      threshold: alert.threshold,
      currentValue,
      message,
      metadata: {
        alertName: alert.name,
        isTest,
      },
    };
  }

  private buildSampleValue(type: AlertType, threshold: number): number {
    switch (type) {
      case AlertType.PRICE_ABOVE:
        return Number((threshold + 1).toFixed(4));
      case AlertType.PRICE_BELOW:
        return Number(Math.max(0, threshold - 1).toFixed(4));
      case AlertType.SCORE_ABOVE:
        return Number(Math.min(100, threshold + 5).toFixed(4));
      case AlertType.SENTIMENT_CHANGE:
        return Number(Math.min(100, 50 + threshold + 5).toFixed(4));
      case AlertType.PORTFOLIO_PNL:
        return Number((-Math.abs(threshold) - 1).toFixed(4));
      case AlertType.TOKEN_LIMIT:
        return Number(Math.min(100, threshold + 5).toFixed(4));
      case AlertType.MARKET_OPEN:
      case AlertType.CUSTOM:
      default:
        return 0;
    }
  }

  private buildMessage(alert: Alert, currentValue: number, isTest: boolean): string {
    const prefix = isTest ? '[PRUEBA] ' : '';

    switch (alert.type) {
      case AlertType.PRICE_ABOVE:
      case AlertType.PRICE_BELOW:
        return `${prefix}El precio de ${alert.symbol ?? 'tu activo'} llego a $${currentValue.toFixed(4)} (umbral: $${alert.threshold.toFixed(4)})`;
      case AlertType.SCORE_ABOVE:
        return `${prefix}El score de ${alert.symbol ?? 'tu activo'} supero ${alert.threshold}/100. Estrategia recomendada: ver la app.`;
      case AlertType.SENTIMENT_CHANGE:
        return `${prefix}El sentimiento de ${alert.symbol ?? 'tu activo'} cambio a ${currentValue.toFixed(2)}/100`;
      case AlertType.PORTFOLIO_PNL:
        return `${prefix}Tu portfolio cayo ${currentValue.toFixed(2)}% (umbral: ${alert.threshold.toFixed(2)}%)`;
      case AlertType.TOKEN_LIMIT:
        return `${prefix}Usaste el ${currentValue.toFixed(2)}% de tu limite mensual de IA`;
      case AlertType.MARKET_OPEN:
        return `${prefix}El mercado argentino abrio y Aurora preparo tu resumen matutino.`;
      case AlertType.CUSTOM:
      default:
        return `${prefix}Se disparo la alerta "${alert.name}" para ${alert.symbol ?? 'tu cuenta'}.`;
    }
  }
}

