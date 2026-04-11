import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

interface PriceUpdatedPayload {
  symbol: string;
  market: string;
  price: number;
  change24h?: number | null;
  volume24h?: number | null;
}

interface NotificationRealtimePayload {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: Date;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AppGateway.name);
  private readonly userSockets = new Map<string, Set<string>>();

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket): void {
    const userId = this.extractUserId(client);

    if (!userId) {
      return;
    }

    const sockets = this.userSockets.get(userId) ?? new Set<string>();
    sockets.add(client.id);
    this.userSockets.set(userId, sockets);
    this.logger.debug(`Socket conectado para userId=${userId} socketId=${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    for (const [userId, sockets] of this.userSockets.entries()) {
      if (!sockets.has(client.id)) {
        continue;
      }

      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
      this.logger.debug(`Socket desconectado para userId=${userId} socketId=${client.id}`);
      break;
    }
  }

  emitPriceUpdated(payload: PriceUpdatedPayload): void {
    this.server.emit('price.updated', payload);
  }

  emitNotificationNew(userId: string, payload: NotificationRealtimePayload): void {
    this.emitToUser(userId, 'notification.new', payload);
  }

  emitAlertTriggered(userId: string, payload: unknown): void {
    this.emitToUser(userId, 'alert.triggered', payload);
  }

  emitUnreadCount(userId: string, count: number): void {
    this.emitToUser(userId, 'unread.count', { count });
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    const sockets = this.userSockets.get(userId);

    if (!sockets || sockets.size === 0) {
      return;
    }

    for (const socketId of sockets) {
      this.server.to(socketId).emit(event, data);
    }
  }

  private extractUserId(client: Socket): string | null {
    const authUserId = client.handshake.auth.userId;
    if (typeof authUserId === 'string' && authUserId.trim().length > 0) {
      return authUserId;
    }

    const queryUserId = client.handshake.query.userId;
    if (typeof queryUserId === 'string' && queryUserId.trim().length > 0) {
      return queryUserId;
    }

    return null;
  }
}
