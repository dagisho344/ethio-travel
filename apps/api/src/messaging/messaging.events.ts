import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

export interface CreatedMessageEvent {
  id: string;
  conversationId: string;
  body: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  sender: { id: string; displayName: string };
}

@Injectable()
export class MessagingEvents {
  private readonly emitter = new EventEmitter();

  messageCreated(message: CreatedMessageEvent): void {
    this.emitter.emit('conversation.message.created', message);
  }

  onMessageCreated(listener: (message: CreatedMessageEvent) => void): void {
    this.emitter.on('conversation.message.created', listener);
  }
}
