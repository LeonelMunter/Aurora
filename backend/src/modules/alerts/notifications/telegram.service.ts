import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import TelegramBot from 'node-telegram-bot-api';

import { AlertTriggerContext, AlertType, NotificationPayload } from '../alerts.types';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private bot: TelegramBot | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const token =
      this.configService.get<string>('TELEGRAM_BOT_TOKEN') ??
      this.configService.get<string>('telegram.botToken');

    if (!token) {
      this.logger.warn('Telegram Bot no configurado. Se continua sin notificaciones de Telegram.');
      return;
    }

    try {
      this.bot = new TelegramBot(token, { polling: true });
      this.bot.onText(/^\/start(?:@\w+)?$/, (message) => {
        const chatId = message.chat.id.toString();
        void this.sendMessage(chatId, {
          emoji: '??',
          title: 'Aurora Finance Bot',
          message:
            `Tu Chat ID es: ${chatId}\n` +
            'Copia este numero y pegalo en la configuracion de alertas en la app para recibir notificaciones aqui.',
        });
      });
      this.bot.onText(/^\/status(?:@\w+)?$/, (message) => {
        void this.sendMessage(message.chat.id.toString(), {
          emoji: '?',
          title: 'Estado del sistema',
          message: 'Aurora Finance Bot esta online y listo para enviar alertas.',
        });
      });
      this.logger.log('Telegram Bot inicializado en modo polling.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`No se pudo inicializar Telegram Bot: ${message}`);
      this.bot = null;
    }
  }

  async sendMessage(chatId: string, payload: NotificationPayload): Promise<boolean> {
    if (!this.bot) {
      return false;
    }

    const timestamp = new Date().toLocaleString('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Argentina/Buenos_Aires',
    });
    const text =
      `${this.escapeMarkdown(payload.emoji)} *${this.escapeMarkdown(payload.title)}*\n\n` +
      `${this.escapeMarkdown(payload.message)}\n\n` +
      `_${this.escapeMarkdown(timestamp)}_`;

    try {
      await this.bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`Fallo el envio a Telegram para chatId=${chatId}: ${message}`);
      return false;
    }
  }

  async sendAlert(chatId: string, context: AlertTriggerContext): Promise<boolean> {
    const payload = this.buildPayload(context);
    return this.sendMessage(chatId, payload);
  }

  isConfigured(): boolean {
    return this.bot !== null;
  }

  private buildPayload(context: AlertTriggerContext): NotificationPayload {
    switch (context.type) {
      case AlertType.PRICE_ABOVE:
        return {
          emoji: '??',
          title: `${context.symbol ?? 'Activo'} - Alerta de precio`,
          message: `El precio de ${context.symbol ?? 'tu activo'} llego a $${context.currentValue} (umbral: $${context.threshold})`,
          metadata: context.metadata,
        };
      case AlertType.PRICE_BELOW:
        return {
          emoji: '??',
          title: `${context.symbol ?? 'Activo'} - Alerta de precio`,
          message: `El precio de ${context.symbol ?? 'tu activo'} llego a $${context.currentValue} (umbral: $${context.threshold})`,
          metadata: context.metadata,
        };
      case AlertType.SCORE_ABOVE:
        return {
          emoji: '??',
          title: `${context.symbol ?? 'Activo'} - Score de estrategia`,
          message: `El score de ${context.symbol ?? 'tu activo'} supero ${context.threshold}/100. Estrategia recomendada: ver la app.`,
          metadata: context.metadata,
        };
      case AlertType.SENTIMENT_CHANGE:
        return {
          emoji: '??',
          title: `Cambio de sentimiento - ${context.symbol ?? 'mercado'}`,
          message: `El sentimiento de ${context.symbol ?? 'tu activo'} cambio a ${context.currentValue}/100`,
          metadata: context.metadata,
        };
      case AlertType.PORTFOLIO_PNL:
        return {
          emoji: '??',
          title: 'Alerta de portfolio',
          message: `Tu portfolio cayo ${context.currentValue}% (umbral: ${context.threshold}%)`,
          metadata: context.metadata,
        };
      case AlertType.TOKEN_LIMIT:
        return {
          emoji: '??',
          title: 'Limite de tokens IA',
          message: `Usaste el ${context.currentValue}% de tu limite mensual de IA`,
          metadata: context.metadata,
        };
      case AlertType.MARKET_OPEN:
        return {
          emoji: '??',
          title: 'Mercado argentino abierto',
          message: context.message,
          metadata: context.metadata,
        };
      case AlertType.CUSTOM:
      default:
        return {
          emoji: '??',
          title: context.symbol ? `${context.symbol} - Alerta` : 'Alerta Aurora Finance',
          message: context.message,
          metadata: context.metadata,
        };
    }
  }

  private escapeMarkdown(value: string): string {
    return value.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
  }
}
