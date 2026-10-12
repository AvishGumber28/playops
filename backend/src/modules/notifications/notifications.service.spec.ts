import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: {
    notification: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      notification: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('listMine', () => {
    it('counts unread correctly', async () => {
      prisma.notification.findMany.mockResolvedValue([
        { id: 'n1', readAt: null },
        { id: 'n2', readAt: new Date() },
        { id: 'n3', readAt: null },
      ]);

      const result = await service.listMine('u1');

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' } }),
      );
      expect(result.unreadCount).toBe(2);
      expect(result.notifications).toHaveLength(3);
    });
  });

  describe('markRead', () => {
    it('throws NotFoundException if the notification does not exist', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);
      await expect(service.markRead('u1', 'n1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ForbiddenException if it isn't the caller's own notification", async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'n1',
        userId: 'someone-else',
        readAt: null,
      });
      await expect(service.markRead('u1', 'n1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('marks an unread notification as read', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'n1',
        userId: 'u1',
        readAt: null,
      });

      const result = await service.markRead('u1', 'n1');

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { readAt: expect.any(Date) as Date },
      });
      expect(result).toEqual({ read: true });
    });

    it('is a no-op (idempotent) if already read', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'n1',
        userId: 'u1',
        readAt: new Date(),
      });

      const result = await service.markRead('u1', 'n1');

      expect(prisma.notification.update).not.toHaveBeenCalled();
      expect(result).toEqual({ read: true });
    });
  });
});
