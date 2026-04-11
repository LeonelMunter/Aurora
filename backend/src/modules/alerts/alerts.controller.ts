import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AuthenticatedRequestUser, CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { NotificationChannel } from './alerts.types';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { NotificationFilterDto } from './dto/notification-filter.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { VerifyTelegramDto } from './dto/verify-telegram.dto';
import { NotificationService } from './notification.service';
import { TelegramService } from './notifications/telegram.service';

@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly alertsService: AlertsService,
    private readonly notificationService: NotificationService,
    private readonly telegramService: TelegramService,
  ) {}

  @Get('telegram/setup-instructions')
  @ApiOperation({ summary: 'Instrucciones para configurar el bot de Telegram' })
  getTelegramSetupInstructions(): { instructions: string } {
    return {
      instructions:
        '1. Busca el bot de Aurora Finance en Telegram. 2. Envia /start. 3. Copia tu Chat ID de la respuesta. 4. Pegalo en la configuracion de alertas de la app. 5. Usa verificar para confirmar que llega un mensaje.',
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear nueva alerta' })
  @ApiResponse({ status: 201, description: 'Alerta creada correctamente.' })
  create(@CurrentUser() user: AuthenticatedRequestUser, @Body() dto: CreateAlertDto) {
    return this.alertsService.create(user.userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar alertas del usuario' })
  findAll(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.alertsService.findAll(user.userId);
  }

  @Get('notifications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar notificaciones del usuario' })
  getNotifications(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Query() filters: NotificationFilterDto,
  ) {
    return this.notificationService.getNotifications(user.userId, filters);
  }

  @Patch('notifications/read-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leidas' })
  async markAllAsRead(@CurrentUser() user: AuthenticatedRequestUser) {
    const count = await this.notificationService.markAllAsRead(user.userId);
    return {
      message: `${count} notificaciones marcadas como leidas`,
    };
  }

  @Get('notifications/unread-count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener cantidad de notificaciones no leidas' })
  async getUnreadCount(@CurrentUser() user: AuthenticatedRequestUser) {
    return {
      count: await this.notificationService.getUnreadCount(user.userId),
    };
  }

  @Patch('notifications/:notificationId/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Marcar notificacion como leida' })
  markAsRead(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationService.markAsRead(user.userId, notificationId);
  }

  @Post('telegram/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar un chatId de Telegram enviando un mensaje de prueba' })
  async verifyTelegram(@Body() dto: VerifyTelegramDto) {
    const valid = await this.telegramService.sendMessage(dto.chatId, {
      emoji: '??',
      title: 'Verificacion de Telegram',
      message: 'Aurora Finance pudo enviarte este mensaje. Tu chatId quedo validado.',
    });

    return {
      valid,
      message: valid
        ? 'Mensaje de prueba enviado correctamente.'
        : 'No se pudo enviar el mensaje de prueba. Revisa el chatId o la configuracion del bot.',
    };
  }

  @Get(':alertId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detalle de una alerta' })
  findOne(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('alertId') alertId: string,
  ) {
    return this.alertsService.findOne(user.userId, alertId);
  }

  @Patch(':alertId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar alerta existente' })
  update(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('alertId') alertId: string,
    @Body() dto: UpdateAlertDto,
  ) {
    return this.alertsService.update(user.userId, alertId, dto);
  }

  @Delete(':alertId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar alerta' })
  async remove(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('alertId') alertId: string,
  ) {
    await this.alertsService.remove(user.userId, alertId);
    return { message: 'Alerta eliminada' };
  }

  @Post(':alertId/test')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disparar una notificacion de prueba' })
  async testAlert(
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('alertId') alertId: string,
  ) {
    const alert = await this.alertsService.findOne(user.userId, alertId);
    const context = await this.alertsService.testAlert(user.userId, alertId);
    await this.notificationService.send(user.userId, context, alert.channel ?? NotificationChannel.IN_APP);

    return {
      message: 'Notificacion de prueba enviada',
    };
  }
}
