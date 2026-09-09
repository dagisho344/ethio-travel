import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { EventEmitter } from 'node:events';

export interface CreatedNotificationEvent {
  id: string;
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class NotificationsEvents {
  private readonly emitter = new EventEmitter();

  notificationCreated(notification: CreatedNotificationEvent): void {
    this.emitter.emit('notification.created', notification);
  }

  onNotificationCreated(
    listener: (notification: CreatedNotificationEvent) => void,
  ): void {
    this.emitter.on('notification.created', listener);
  }
}
