import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

import { AlertTriggerContext, AlertType } from '../alerts.types';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const port = Number(this.configService.get<string>('SMTP_PORT') ?? '587');

    if (!host || !user || !pass) {
      this.logger.log(
        'Email no configurado. Configura SMTP en backend/.env para habilitar notificaciones por email.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });

    try {
      await this.transporter.verify();
      this.logger.log('Servicio de email listo para enviar notificaciones.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.warn(`SMTP no disponible, se continua sin email: ${message}`);
      this.transporter = null;
    }
  }

  async sendAlert(email: string, context: AlertTriggerContext): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    const title = this.resolveTitle(context);
    const htmlContent = this.buildHtml(title, context);

    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('SMTP_USER'),
        to: email,
        subject: `[Aurora Finance] ${title}`,
        html: htmlContent,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`No se pudo enviar email a ${email}: ${message}`);
      return false;
    }
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }

  private resolveTitle(context: AlertTriggerContext): string {
    switch (context.type) {
      case AlertType.PRICE_ABOVE:
      case AlertType.PRICE_BELOW:
        return `${context.symbol ?? 'Activo'} - Alerta de precio`;
      case AlertType.SCORE_ABOVE:
        return `${context.symbol ?? 'Activo'} - Score de estrategia`;
      case AlertType.SENTIMENT_CHANGE:
        return `Cambio de sentimiento - ${context.symbol ?? 'activo'}`;
      case AlertType.PORTFOLIO_PNL:
        return 'Alerta de portfolio';
      case AlertType.TOKEN_LIMIT:
        return 'Limite de tokens IA';
      case AlertType.MARKET_OPEN:
        return 'Mercado argentino abierto';
      case AlertType.CUSTOM:
      default:
        return 'Nueva alerta de Aurora Finance';
    }
  }

  private buildHtml(title: string, context: AlertTriggerContext): string {
    const appUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const rows = [
      ['Tipo', context.type],
      ['Activo', context.symbol ?? 'N/D'],
      ['Mercado', context.market ?? 'N/D'],
      ['Umbral', context.threshold.toString()],
      ['Valor actual', context.currentValue.toString()],
      ['Mensaje', context.message],
    ]
      .map(
        ([label, value]) =>
          `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;"><strong>${label}</strong></td><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${value}</td></tr>`,
      )
      .join('');

    return `
      <div style="font-family:Arial,sans-serif;background:#f4f7fb;padding:24px;color:#111827;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:#0f172a;color:#ffffff;padding:24px 28px;">
            <h1 style="margin:0;font-size:24px;">Aurora Finance</h1>
            <p style="margin:8px 0 0 0;opacity:0.85;">Notificacion automatica de alertas</p>
          </div>
          <div style="padding:28px;">
            <h2 style="margin:0 0 16px 0;font-size:22px;">${title}</h2>
            <p style="margin:0 0 20px 0;line-height:1.6;">${context.message}</p>
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
              ${rows}
            </table>
            <p style="margin:0 0 12px 0;">
              <a href="${appUrl}" style="color:#2563eb;text-decoration:none;">Abrir Aurora Finance</a>
            </p>
            <p style="margin:0;color:#6b7280;font-size:13px;">
              Si no queres seguir recibiendo esta alerta, podes desactivarla desde la seccion de alertas de la app.
            </p>
          </div>
        </div>
      </div>
    `;
  }
}
