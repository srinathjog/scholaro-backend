import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './message.entity';
import { CreateMessageDto } from './dto/create-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  async sendMessage(dto: CreateMessageDto): Promise<Message> {
    // Save a new message
    const message = this.messageRepository.create(dto);
    return this.messageRepository.save(message);
  }

  async getConversation(
    tenantId: string,
    userA: string,
    userB: string,
  ): Promise<Message[]> {
    // Fetch chat history between two users, ordered by time
    return this.messageRepository.find({
      where: [
        { tenant_id: tenantId, sender_id: userA, receiver_id: userB },
        { tenant_id: tenantId, sender_id: userB, receiver_id: userA },
      ],
      order: { created_at: 'ASC' },
    });
  }

  async getUnreadCount(tenantId: string, userId: string): Promise<number> {
    // Count unread messages for a user
    return this.messageRepository.count({
      where: {
        tenant_id: tenantId,
        receiver_id: userId,
        is_read: false,
      },
    });
  }
}
