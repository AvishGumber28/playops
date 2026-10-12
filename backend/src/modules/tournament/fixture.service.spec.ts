/* eslint-disable @typescript-eslint/no-unsafe-assignment --
   expect.objectContaining()'s return type is `any` in this project's jest
   types - a known false positive, not real untyped values. */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FixtureService } from './fixture.service';
import { TournamentService } from './tournament.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('FixtureService', () => {
  let service: FixtureService;
  let prisma: {
    match: {
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
    };
    team: { findMany: jest.Mock };
    tournament: { update: jest.Mock; findUnique: jest.Mock };
    teamPlayer: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let tournamentService: { tournamentForSecretaryOrThrow: jest.Mock };

  beforeEach(async () => {
    prisma = {
      match: {
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      team: { findMany: jest.fn() },
      tournament: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
      },
      teamPlayer: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    };
    tournamentService = { tournamentForSecretaryOrThrow: jest.fn() };

    // match.create/$transaction: mimic Prisma's array-form $transaction
    // (arguments evaluated eagerly, then awaited together) so the
    // bracket-building code can be tested without a real Prisma Client.
    prisma.match.create.mockImplementation(
      ({ data }: { data: { round: number; matchNumber: number } }) =>
        Promise.resolve({
          id: `m-${data.round}-${data.matchNumber}`,
          status: 'scheduled',
          winnerTeamId: null,
          ...data,
        }),
    );
    prisma.$transaction.mockImplementation((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : arg,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FixtureService,
        { provide: PrismaService, useValue: prisma },
        { provide: TournamentService, useValue: tournamentService },
      ],
    }).compile();

    service = module.get<FixtureService>(FixtureService);
  });

  describe('generateFixtures', () => {
    it('propagates ForbiddenException from the secretary check', async () => {
      tournamentService.tournamentForSecretaryOrThrow.mockRejectedValue(
        new ForbiddenException(),
      );
      await expect(service.generateFixtures('u1', 'tour-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ConflictException if registration is not open', async () => {
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
        status: 'in_progress',
        format: 'knockout',
      });
      await expect(service.generateFixtures('sec-1', 'tour-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException if fixtures already exist', async () => {
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
        status: 'registration_open',
        format: 'knockout',
      });
      prisma.match.count.mockResolvedValue(3);
      await expect(service.generateFixtures('sec-1', 'tour-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws BadRequestException with fewer than 2 approved teams', async () => {
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
        status: 'registration_open',
        format: 'knockout',
      });
      prisma.match.count.mockResolvedValue(0);
      prisma.team.findMany.mockResolvedValue([{ id: 't1' }]);
      await expect(service.generateFixtures('sec-1', 'tour-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('builds a knockout bracket with byes propagated to round 2, and flips status', async () => {
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
        status: 'registration_open',
        format: 'knockout',
      });
      prisma.match.count.mockResolvedValue(0);
      prisma.team.findMany.mockResolvedValue([
        { id: 't1' },
        { id: 't2' },
        { id: 't3' },
      ]);

      await service.generateFixtures('sec-1', 'tour-1');

      // 3 teams -> bracket size 4: one bye (t1 vs nobody), one real
      // match (t2 v t3), one round-2 placeholder.
      expect(prisma.match.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            round: 1,
            matchNumber: 1,
            teamAId: 't1',
            teamBId: null,
          }),
        }),
      );
      expect(prisma.match.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            round: 1,
            matchNumber: 2,
            teamAId: 't2',
            teamBId: 't3',
          }),
        }),
      );
      expect(prisma.match.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            round: 2,
            matchNumber: 1,
            teamAId: null,
            teamBId: null,
          }),
        }),
      );

      // the bye resolves immediately...
      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 'm-1-1' },
        data: { status: 'completed', winnerTeamId: 't1' },
      });
      // ...and its winner is fed straight into round 2.
      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 'm-2-1' },
        data: { teamAId: 't1' },
      });

      expect(prisma.tournament.update).toHaveBeenCalledWith({
        where: { id: 'tour-1' },
        data: { status: 'in_progress' },
      });
    });

    it('builds a full round-robin for a league tournament', async () => {
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
        status: 'registration_open',
        format: 'league',
      });
      prisma.match.count.mockResolvedValue(0);
      prisma.team.findMany.mockResolvedValue([
        { id: 't1' },
        { id: 't2' },
        { id: 't3' },
      ]);

      await service.generateFixtures('sec-1', 'tour-1');

      // 3 teams, odd -> one bye seat per round; every pair plays exactly
      // once across 3 rounds.
      const pairs = prisma.match.create.mock.calls.map(
        ([{ data }]: [{ data: { teamAId: string; teamBId: string } }]) =>
          [data.teamAId, data.teamBId].sort(),
      );
      expect(pairs).toHaveLength(3);
      expect(pairs).toEqual(
        expect.arrayContaining([
          ['t2', 't3'],
          ['t1', 't3'],
          ['t1', 't2'],
        ]),
      );
    });
  });

  describe('listFixtures', () => {
    it('groups matches by round', async () => {
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      prisma.match.findMany.mockResolvedValue([
        { id: 'm1', round: 1, matchNumber: 1, venueBooking: null },
        {
          id: 'm2',
          round: 1,
          matchNumber: 2,
          venueBooking: {
            status: 'pending',
            date: new Date('2099-01-02'),
            startTime: '09:00',
            endTime: '10:00',
            venue: { name: 'Cricket Ground' },
          },
        },
        { id: 'm3', round: 2, matchNumber: 1, venueBooking: null },
      ]);

      const result = await service.listFixtures('sec-1', 'tour-1');

      expect(result.rounds).toEqual([
        {
          round: 1,
          matches: [
            {
              id: 'm1',
              round: 1,
              matchNumber: 1,
              scheduledDate: null,
              pendingBooking: null,
            },
            {
              id: 'm2',
              round: 1,
              matchNumber: 2,
              scheduledDate: null,
              pendingBooking: {
                venueName: 'Cricket Ground',
                date: '2099-01-02',
                hour: '09:00-10:00',
              },
            },
          ],
        },
        {
          round: 2,
          matches: [
            {
              id: 'm3',
              round: 2,
              matchNumber: 1,
              scheduledDate: null,
              pendingBooking: null,
            },
          ],
        },
      ]);
    });

    // D-030: broadened from Secretary-only to also let a registered
    // participant view the schedule (read-only - generate/swap stay
    // Secretary-only, untouched).
    it('propagates a NotFoundException from the secretary check (tournament genuinely missing)', async () => {
      tournamentService.tournamentForSecretaryOrThrow.mockRejectedValue(
        new NotFoundException('Tournament not found.'),
      );
      await expect(service.listFixtures('u1', 'tour-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.teamPlayer.findFirst).not.toHaveBeenCalled();
    });

    it('allows a registered participant who is not the Secretary', async () => {
      tournamentService.tournamentForSecretaryOrThrow.mockRejectedValue(
        new ForbiddenException(),
      );
      prisma.teamPlayer.findFirst.mockResolvedValue({ id: 'tp-1' });
      prisma.match.findMany.mockResolvedValue([]);

      const result = await service.listFixtures('student-1', 'tour-1');

      expect(prisma.teamPlayer.findFirst).toHaveBeenCalledWith({
        where: { tournamentId: 'tour-1', userId: 'student-1' },
        select: { id: true },
      });
      expect(result.tournamentId).toBe('tour-1');
    });

    it('throws ForbiddenException for a non-secretary who is also not a participant', async () => {
      tournamentService.tournamentForSecretaryOrThrow.mockRejectedValue(
        new ForbiddenException(),
      );
      prisma.teamPlayer.findFirst.mockResolvedValue(null);

      await expect(service.listFixtures('u1', 'tour-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('swapTeams', () => {
    const dto = {
      matchAId: 'm1',
      slotA: 'teamA' as const,
      matchBId: 'm2',
      slotB: 'teamB' as const,
    };

    beforeEach(() => {
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
    });

    it('throws NotFoundException if a match is missing', async () => {
      prisma.match.findUnique.mockResolvedValueOnce(null);
      await expect(service.swapTeams('sec-1', 'tour-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException if a match belongs to a different tournament', async () => {
      prisma.match.findUnique
        .mockResolvedValueOnce({ id: 'm1', tournamentId: 'other-tour' })
        .mockResolvedValueOnce({ id: 'm2', tournamentId: 'tour-1' });
      await expect(service.swapTeams('sec-1', 'tour-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException if either match is already decided', async () => {
      prisma.match.findUnique
        .mockResolvedValueOnce({
          id: 'm1',
          tournamentId: 'tour-1',
          status: 'completed',
          teamAId: 't1',
          teamBId: null,
        })
        .mockResolvedValueOnce({
          id: 'm2',
          tournamentId: 'tour-1',
          status: 'scheduled',
          teamAId: 't2',
          teamBId: 't3',
        });
      await expect(service.swapTeams('sec-1', 'tour-1', dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException if the swap would pit a team against itself', async () => {
      prisma.match.findUnique
        .mockResolvedValueOnce({
          id: 'm1',
          tournamentId: 'tour-1',
          status: 'scheduled',
          teamAId: 't1',
          teamBId: 't3',
        })
        .mockResolvedValueOnce({
          id: 'm2',
          tournamentId: 'tour-1',
          status: 'scheduled',
          teamAId: 't2',
          teamBId: 't3',
        });
      // dto swaps m1.teamA with m2.teamB -> m1 would become t3 vs t3
      await expect(service.swapTeams('sec-1', 'tour-1', dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('swaps the teams between two matches on the happy path', async () => {
      prisma.match.findUnique
        .mockResolvedValueOnce({
          id: 'm1',
          tournamentId: 'tour-1',
          status: 'scheduled',
          teamAId: 't1',
          teamBId: 't4',
        })
        .mockResolvedValueOnce({
          id: 'm2',
          tournamentId: 'tour-1',
          status: 'scheduled',
          teamAId: 't2',
          teamBId: 't3',
        });
      prisma.$transaction.mockResolvedValue([]);

      await service.swapTeams('sec-1', 'tour-1', dto);

      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { teamAId: 't3' },
      });
      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 'm2' },
        data: { teamBId: 't1' },
      });
    });

    it('swaps the two slots within the same match', async () => {
      prisma.match.findUnique
        .mockResolvedValueOnce({
          id: 'm1',
          tournamentId: 'tour-1',
          status: 'scheduled',
          teamAId: 't1',
          teamBId: 't2',
        })
        .mockResolvedValueOnce({
          id: 'm1',
          tournamentId: 'tour-1',
          status: 'scheduled',
          teamAId: 't1',
          teamBId: 't2',
        });

      await service.swapTeams('sec-1', 'tour-1', {
        matchAId: 'm1',
        slotA: 'teamA',
        matchBId: 'm1',
        slotB: 'teamB',
      });

      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { teamAId: 't2', teamBId: 't1' },
      });
    });
  });

  // FR-010 / D-024: propagating a real result's winner into Round+1,
  // the same slot a bye already fills at generation time.
  describe('advanceWinner', () => {
    it('does nothing for a draw (winnerTeamId null)', async () => {
      await service.advanceWinner('tour-1', 1, 2, null);
      expect(prisma.tournament.findUnique).not.toHaveBeenCalled();
    });

    it('does nothing for a league tournament', async () => {
      prisma.tournament.findUnique.mockResolvedValue({ format: 'league' });
      await service.advanceWinner('tour-1', 1, 2, 't1');
      expect(prisma.match.findFirst).not.toHaveBeenCalled();
    });

    it('does nothing if there is no next round (this was the final)', async () => {
      prisma.tournament.findUnique.mockResolvedValue({ format: 'knockout' });
      prisma.match.findFirst.mockResolvedValue(null);
      await service.advanceWinner('tour-1', 2, 1, 't1');
      expect(prisma.match.update).not.toHaveBeenCalled();
    });

    it('writes the winner into teamAId for an odd matchNumber', async () => {
      prisma.tournament.findUnique.mockResolvedValue({ format: 'knockout' });
      prisma.match.findFirst.mockResolvedValue({ id: 'next-match' });
      await service.advanceWinner('tour-1', 1, 1, 't1');
      expect(prisma.match.findFirst).toHaveBeenCalledWith({
        where: { tournamentId: 'tour-1', round: 2, matchNumber: 1 },
      });
      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 'next-match' },
        data: { teamAId: 't1' },
      });
    });

    it('writes the winner into teamBId for an even matchNumber', async () => {
      prisma.tournament.findUnique.mockResolvedValue({ format: 'knockout' });
      prisma.match.findFirst.mockResolvedValue({ id: 'next-match' });
      await service.advanceWinner('tour-1', 1, 2, 't2');
      expect(prisma.match.findFirst).toHaveBeenCalledWith({
        where: { tournamentId: 'tour-1', round: 2, matchNumber: 1 },
      });
      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 'next-match' },
        data: { teamBId: 't2' },
      });
    });
  });
});
