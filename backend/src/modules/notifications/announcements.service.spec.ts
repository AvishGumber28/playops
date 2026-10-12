import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;
  let prisma: {
    hostel: { findFirst: jest.Mock };
    tournament: { findUnique: jest.Mock };
    teamPlayer: { findMany: jest.Mock };
    user: { findMany: jest.Mock };
    announcement: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
    };
    notification: { deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };

  const dto = { title: 'Heads up', body: 'Ground booking moved to tomorrow.' };

  beforeEach(async () => {
    prisma = {
      hostel: { findFirst: jest.fn() },
      tournament: { findUnique: jest.fn() },
      teamPlayer: { findMany: jest.fn() },
      user: { findMany: jest.fn() },
      announcement: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      notification: { deleteMany: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnouncementsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AnnouncementsService>(AnnouncementsService);
  });

  describe('postAnnouncement', () => {
    it('throws ForbiddenException if the caller is not a Sports Secretary', async () => {
      prisma.hostel.findFirst.mockResolvedValue(null);
      await expect(service.postAnnouncement('u1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('fans out to every resident of the hostel when no tournamentId is given', async () => {
      prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-1' });
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
      const tx = {
        announcement: {
          create: jest.fn().mockResolvedValue({
            id: 'ann-1',
            hostelId: 'hostel-1',
            tournamentId: null,
            title: dto.title,
            body: dto.body,
          }),
        },
        notification: { createMany: jest.fn() },
      };
      prisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) =>
        fn(tx),
      );

      const result = await service.postAnnouncement('sec-1', dto);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { hostelId: 'hostel-1' },
        select: { id: true },
      });
      expect(tx.announcement.create).toHaveBeenCalledWith({
        data: {
          hostelId: 'hostel-1',
          tournamentId: null,
          title: dto.title,
          body: dto.body,
          createdById: 'sec-1',
        },
      });
      expect(tx.notification.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 'u1', announcementId: 'ann-1', message: dto.title },
          { userId: 'u2', announcementId: 'ann-1', message: dto.title },
        ],
      });
      expect(result.recipientCount).toBe(2);
    });

    it('throws NotFoundException if the given tournament does not exist', async () => {
      prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-1' });
      prisma.tournament.findUnique.mockResolvedValue(null);
      await expect(
        service.postAnnouncement('sec-1', { ...dto, tournamentId: 'tour-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if the tournament belongs to a different hostel', async () => {
      prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-1' });
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        hostelId: 'hostel-OTHER',
      });
      await expect(
        service.postAnnouncement('sec-1', { ...dto, tournamentId: 'tour-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("narrows to only that tournament's approved, registered players when tournamentId is given", async () => {
      prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-1' });
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        hostelId: 'hostel-1',
      });
      prisma.teamPlayer.findMany.mockResolvedValue([
        { userId: 'p1' },
        { userId: 'p2' },
        { userId: 'p1' }, // same user on two teams shouldn't double-notify
      ]);
      const tx = {
        announcement: {
          create: jest.fn().mockResolvedValue({ id: 'ann-1' }),
        },
        notification: { createMany: jest.fn() },
      };
      prisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) =>
        fn(tx),
      );

      const result = await service.postAnnouncement('sec-1', {
        ...dto,
        tournamentId: 'tour-1',
      });

      expect(prisma.teamPlayer.findMany).toHaveBeenCalledWith({
        where: {
          tournamentId: 'tour-1',
          team: { registrationStatus: 'approved' },
        },
        select: { userId: true },
      });
      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(result.recipientCount).toBe(2);
    });

    it('creates the announcement with zero recipients without erroring', async () => {
      prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-1' });
      prisma.user.findMany.mockResolvedValue([]);
      const tx = {
        announcement: { create: jest.fn().mockResolvedValue({ id: 'ann-1' }) },
        notification: { createMany: jest.fn() },
      };
      prisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) =>
        fn(tx),
      );

      const result = await service.postAnnouncement('sec-1', dto);

      expect(tx.notification.createMany).not.toHaveBeenCalled();
      expect(result.recipientCount).toBe(0);
    });
  });

  describe('listMyAnnouncements', () => {
    it('throws ForbiddenException if the caller is not a Sports Secretary', async () => {
      prisma.hostel.findFirst.mockResolvedValue(null);
      await expect(service.listMyAnnouncements('u1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("scopes to the secretary's own hostel, newest first", async () => {
      prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-1' });
      prisma.announcement.findMany.mockResolvedValue([]);

      await service.listMyAnnouncements('sec-1');

      expect(prisma.announcement.findMany).toHaveBeenCalledWith({
        where: { hostelId: 'hostel-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  // D-029.
  describe('deleteAnnouncement', () => {
    it('throws ForbiddenException if the caller is not a Sports Secretary', async () => {
      prisma.hostel.findFirst.mockResolvedValue(null);
      await expect(service.deleteAnnouncement('u1', 'ann-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException if the announcement does not exist', async () => {
      prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-1' });
      prisma.announcement.findUnique.mockResolvedValue(null);
      await expect(
        service.deleteAnnouncement('sec-1', 'ann-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if the announcement belongs to a different hostel', async () => {
      prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-1' });
      prisma.announcement.findUnique.mockResolvedValue({
        id: 'ann-1',
        hostelId: 'hostel-OTHER',
      });
      await expect(
        service.deleteAnnouncement('sec-1', 'ann-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deletes the fanned-out notifications and the announcement together', async () => {
      prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-1' });
      prisma.announcement.findUnique.mockResolvedValue({
        id: 'ann-1',
        hostelId: 'hostel-1',
      });
      prisma.$transaction.mockResolvedValue([]);

      const result = await service.deleteAnnouncement('sec-1', 'ann-1');

      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { announcementId: 'ann-1' },
      });
      expect(prisma.announcement.delete).toHaveBeenCalledWith({
        where: { id: 'ann-1' },
      });
      expect(result).toEqual({ deleted: true });
    });
  });
});
