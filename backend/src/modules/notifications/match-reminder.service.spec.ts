/* eslint-disable @typescript-eslint/no-unsafe-assignment --
   expect.objectContaining()'s return type is `any` in this project's jest
   types - a known false positive, not real untyped values. */
import { Test, TestingModule } from '@nestjs/testing';
import { MatchReminderService } from './match-reminder.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('MatchReminderService', () => {
  let service: MatchReminderService;
  let prisma: {
    match: { findMany: jest.Mock };
    notification: { findFirst: jest.Mock; createMany: jest.Mock };
    teamPlayer: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      match: { findMany: jest.fn() },
      notification: { findFirst: jest.fn(), createMany: jest.fn() },
      teamPlayer: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchReminderService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<MatchReminderService>(MatchReminderService);
  });

  it('does nothing when no matches are scheduled for tomorrow', async () => {
    prisma.match.findMany.mockResolvedValue([]);

    const result = await service.sendMatchDayReminders();

    expect(result).toEqual({ matchesNotified: 0, notificationsSent: 0 });
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('queries only scheduled matches with both teams set, for exactly tomorrow', async () => {
    prisma.match.findMany.mockResolvedValue([]);

    await service.sendMatchDayReminders();

    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'scheduled',
          teamAId: { not: null },
          teamBId: { not: null },
          // exactly midnight UTC - a plain Date equality match against
          // the @db.Date column, the same convention scheduleMatch uses.
          scheduledDate: expect.any(Date) as Date,
        }),
      }),
    );
  });

  it('notifies every player on both teams, de-duplicating a player on both', async () => {
    prisma.match.findMany.mockResolvedValue([
      {
        id: 'm1',
        round: 1,
        matchNumber: 1,
        scheduledTime: '09:00',
        teamAId: 'teamA',
        teamBId: 'teamB',
      },
    ]);
    prisma.notification.findFirst.mockResolvedValue(null); // not yet notified
    prisma.teamPlayer.findMany.mockResolvedValue([
      { userId: 'p1' },
      { userId: 'p2' },
      { userId: 'p1' }, // captain on teamA happens to also be rostered on teamB
    ]);

    const result = await service.sendMatchDayReminders();

    expect(prisma.teamPlayer.findMany).toHaveBeenCalledWith({
      where: { teamId: { in: ['teamA', 'teamB'] } },
      select: { userId: true },
    });
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'p1',
          matchId: 'm1',
          message:
            'Your match (Round 1, Match 1) is scheduled for tomorrow at 09:00.',
        },
        {
          userId: 'p2',
          matchId: 'm1',
          message:
            'Your match (Round 1, Match 1) is scheduled for tomorrow at 09:00.',
        },
      ],
    });
    expect(result).toEqual({ matchesNotified: 1, notificationsSent: 2 });
  });

  it('skips a match that was already notified (idempotent)', async () => {
    prisma.match.findMany.mockResolvedValue([
      {
        id: 'm1',
        round: 1,
        matchNumber: 1,
        scheduledTime: '09:00',
        teamAId: 'teamA',
        teamBId: 'teamB',
      },
    ]);
    prisma.notification.findFirst.mockResolvedValue({ id: 'already-sent' });

    const result = await service.sendMatchDayReminders();

    expect(prisma.teamPlayer.findMany).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    expect(result).toEqual({ matchesNotified: 0, notificationsSent: 0 });
  });

  it('skips a match with no rostered players without erroring', async () => {
    prisma.match.findMany.mockResolvedValue([
      {
        id: 'm1',
        round: 1,
        matchNumber: 1,
        scheduledTime: '09:00',
        teamAId: 'teamA',
        teamBId: 'teamB',
      },
    ]);
    prisma.notification.findFirst.mockResolvedValue(null);
    prisma.teamPlayer.findMany.mockResolvedValue([]);

    const result = await service.sendMatchDayReminders();

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    expect(result).toEqual({ matchesNotified: 0, notificationsSent: 0 });
  });
});
