import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// FR-012: in-app only, fetched on demand - no push/websockets in v1
// (system-architecture.md's own "Notification architecture" decision).
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        message: true,
        readAt: true,
        createdAt: true,
        announcement: {
          select: {
            id: true,
            title: true,
            body: true,
            hostelId: true,
            tournamentId: true,
          },
        },
      },
    });
    const unreadCount = notifications.filter((n) => !n.readAt).length;
    return { notifications, unreadCount };
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) throw new NotFoundException('Notification not found.');
    if (notification.userId !== userId) {
      throw new ForbiddenException('This is not your notification.');
    }
    if (!notification.readAt) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { readAt: new Date() },
      });
    }
    return { read: true };
  }
}
