/* eslint-disable @typescript-eslint/no-unsafe-assignment --
   expect.objectContaining()'s return type is `any` in this project's jest
   types - a known false positive for this rule, not actual untyped values
   flowing through real code. */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TournamentService } from './tournament.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('TournamentService', () => {
  let service: TournamentService;
  let prisma: {
    hostel: { findFirst: jest.Mock };
    sport: { findUnique: jest.Mock; findMany: jest.Mock };
    tournament: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    team: { findMany: jest.Mock; deleteMany: jest.Mock };
    user: { findUnique: jest.Mock };
    teamPlayer: { findMany: jest.Mock; deleteMany: jest.Mock };
    match: {
      count: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    venueBooking: { updateMany: jest.Mock; deleteMany: jest.Mock };
    conflictLog: { deleteMany: jest.Mock };
    scorecard: { deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };

  const FUTURE = '2099-12-31';
  const PAST = '2000-01-01';
  const validDto = {
    name: 'Agira Cricket Cup',
    sportId: 'sport-1',
    format: 'league' as const,
    registrationDeadline: FUTURE,
  };

  beforeEach(async () => {
    prisma = {
      hostel: { findFirst: jest.fn() },
      sport: { findUnique: jest.fn(), findMany: jest.fn() },
      tournament: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      team: { findMany: jest.fn(), deleteMany: jest.fn() },
      user: { findUnique: jest.fn() },
      teamPlayer: { findMany: jest.fn(), deleteMany: jest.fn() },
      match: {
        count: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      venueBooking: { updateMany: jest.fn(), deleteMany: jest.fn() },
      conflictLog: { deleteMany: jest.fn() },
      scorecard: { deleteMany: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TournamentService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TournamentService>(TournamentService);
  });

  describe('createTournament', () => {
    it('throws ForbiddenException if the caller is not a Sports Secretary', async () => {
      prisma.hostel.findFirst.mockResolvedValue(null);
      await expect(
        service.createTournament('user-1', validDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException if the sport does not exist', async () => {
      prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-1' });
      prisma.sport.findUnique.mockResolvedValue(null);
      await expect(
        service.createTournament('user-1', validDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if the deadline is in the past', async () => {
      prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-1' });
      prisma.sport.findUnique.mockResolvedValue({ id: 'sport-1' });
      await expect(
        service.createTournament('user-1', {
          ...validDto,
          registrationDeadline: PAST,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("creates with status registration_open, the secretary's hostel, and the caller as creator", async () => {
      prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-1' });
      prisma.sport.findUnique.mockResolvedValue({ id: 'sport-1' });
      prisma.tournament.create.mockResolvedValue({
        id: 'tournament-1',
        _count: { teams: 0 },
      });

      await service.createTournament('user-1', validDto);

      expect(prisma.tournament.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Agira Cricket Cup',
            sportId: 'sport-1',
            hostelId: 'hostel-1',
            format: 'league',
            status: 'registration_open',
            createdById: 'user-1',
          }),
        }),
      );
    });
  });

  describe('listMyHostelTournaments', () => {
    it('throws ForbiddenException if the caller is not a Sports Secretary', async () => {
      prisma.hostel.findFirst.mockResolvedValue(null);
      await expect(service.listMyHostelTournaments('user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("scopes the query to the secretary's own hostel, newest first", async () => {
      prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-1' });
      prisma.tournament.findMany.mockResolvedValue([]);

      await service.listMyHostelTournaments('user-1');

      expect(prisma.tournament.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hostelId: 'hostel-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  // D-025.
  describe('listTournamentsForCaretaker', () => {
    it('throws ForbiddenException if the caller is not a Caretaker', async () => {
      prisma.hostel.findFirst.mockResolvedValue(null);
      await expect(
        service.listTournamentsForCaretaker('user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it("scopes the query to the caretaker's own hostel, newest first", async () => {
      prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-1' });
      prisma.tournament.findMany.mockResolvedValue([]);

      await service.listTournamentsForCaretaker('user-1');

      expect(prisma.hostel.findFirst).toHaveBeenCalledWith({
        where: { caretakerUserId: 'user-1' },
      });
      expect(prisma.tournament.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hostelId: 'hostel-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('listSports', () => {
    it('returns the sports catalog ordered by name', async () => {
      prisma.sport.findMany.mockResolvedValue([
        { id: 's1', name: 'Basketball' },
      ]);
      const result = await service.listSports();
      expect(result).toEqual([{ id: 's1', name: 'Basketball' }]);
      expect(prisma.sport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } }),
      );
    });
  });

  // FR-006: the student-facing list.
  describe('listTournamentsForMyHostel', () => {
    it('returns [] for a student with no hostel yet', async () => {
      prisma.user.findUnique.mockResolvedValue({ hostelId: null });
      expect(await service.listTournamentsForMyHostel('user-1')).toEqual([]);
    });

    it("scopes to the student's own hostel and flags their own team", async () => {
      prisma.user.findUnique.mockResolvedValue({ hostelId: 'hostel-A' });
      prisma.tournament.findMany.mockResolvedValue([
        { id: 'tour-1', name: 'Cup', _count: { teams: 3 } },
      ]);
      prisma.teamPlayer.findMany.mockResolvedValue([
        {
          tournamentId: 'tour-1',
          team: {
            id: 'team-1',
            name: 'Titans',
            captainUserId: 'user-1',
            registrationStatus: 'approved',
          },
        },
      ]);

      const result = await service.listTournamentsForMyHostel('user-1');

      expect(prisma.tournament.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { hostelId: 'hostel-A' } }),
      );
      expect(result[0].teamCount).toBe(3);
      expect(result[0].myTeam).toEqual({
        id: 'team-1',
        name: 'Titans',
        isCaptain: true,
        registrationStatus: 'approved',
      });
    });
  });

  // FR-006 completion / D-016 / D-017.
  describe('listTournamentTeams', () => {
    it("throws ForbiddenException if the caller is not the tournament's Secretary", async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        hostelId: 'hostel-A',
      });
      prisma.hostel.findFirst.mockResolvedValue(null);
      await expect(service.listTournamentTeams('u1', 'tour-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns the teams with rosters + registrationStatus', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        hostelId: 'hostel-A',
      });
      prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-A' });
      prisma.team.findMany.mockResolvedValue([
        {
          id: 'team-1',
          name: 'Titans',
          captainUserId: 'c1',
          registrationStatus: 'approved',
          players: [
            {
              user: {
                id: 'c1',
                name: 'Cap',
                email: 'c@x.edu',
                rollNumber: null,
              },
            },
          ],
        },
      ]);
      const result = await service.listTournamentTeams('sec-1', 'tour-1');
      expect(result[0]).toEqual(
        expect.objectContaining({
          name: 'Titans',
          registrationStatus: 'approved',
          players: [expect.objectContaining({ name: 'Cap', isCaptain: true })],
        }),
      );
    });
  });

  describe('deleteTournament', () => {
    it('throws ForbiddenException if the caller is not the Secretary', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        hostelId: 'hostel-A',
      });
      prisma.hostel.findFirst.mockResolvedValue(null);
      await expect(service.deleteTournament('u1', 'tour-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('refuses to delete once the tournament has fixtures and is still genuinely in progress', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        hostelId: 'hostel-A',
        status: 'in_progress',
      });
      prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-A' });
      prisma.match.count.mockResolvedValue(2);
      await expect(service.deleteTournament('sec-1', 'tour-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('cascades to teams + team-player rows', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        hostelId: 'hostel-A',
      });
      prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-A' });
      prisma.match.count.mockResolvedValue(0);
      prisma.$transaction.mockResolvedValue([]);

      await service.deleteTournament('sec-1', 'tour-1');

      expect(prisma.teamPlayer.deleteMany).toHaveBeenCalledWith({
        where: { tournamentId: 'tour-1' },
      });
      expect(prisma.team.deleteMany).toHaveBeenCalledWith({
        where: { tournamentId: 'tour-1' },
      });
      expect(prisma.tournament.delete).toHaveBeenCalledWith({
        where: { id: 'tour-1' },
      });
      expect(prisma.match.deleteMany).toHaveBeenCalledWith({
        where: { tournamentId: 'tour-1' },
      });
      expect(prisma.venueBooking.deleteMany).toHaveBeenCalledWith({
        where: { tournamentId: 'tour-1' },
      });
      expect(prisma.conflictLog.deleteMany).toHaveBeenCalledWith({
        where: { tournamentId: 'tour-1' },
      });
      expect(prisma.scorecard.deleteMany).toHaveBeenCalledWith({
        where: { match: { tournamentId: 'tour-1' } },
      });
    });

    // D-022: once cancelled or completed, deletion is always allowed -
    // that's the whole point of adding a Delete button for those states.
    it.each(['cancelled', 'completed'])(
      'allows deleting a %s tournament even with matches still attached, without checking matchCount',
      async (status) => {
        prisma.tournament.findUnique.mockResolvedValue({
          id: 'tour-1',
          hostelId: 'hostel-A',
          status,
        });
        prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-A' });
        prisma.$transaction.mockResolvedValue([]);

        await service.deleteTournament('sec-1', 'tour-1');

        expect(prisma.match.count).not.toHaveBeenCalled();
        expect(prisma.tournament.delete).toHaveBeenCalledWith({
          where: { id: 'tour-1' },
        });
      },
    );
  });

  describe('cancelTournament', () => {
    const dto = { reason: 'Insufficient teams - tournament called off' };

    it('throws ForbiddenException if the caller is not the Secretary', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        hostelId: 'hostel-A',
        status: 'in_progress',
      });
      prisma.hostel.findFirst.mockResolvedValue(null);
      await expect(
        service.cancelTournament('u1', 'tour-1', dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException if already cancelled', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        hostelId: 'hostel-A',
        status: 'cancelled',
      });
      prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-A' });
      await expect(
        service.cancelTournament('sec-1', 'tour-1', dto),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if already completed', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        hostelId: 'hostel-A',
        status: 'completed',
      });
      prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-A' });
      await expect(
        service.cancelTournament('sec-1', 'tour-1', dto),
      ).rejects.toThrow(ConflictException);
    });

    it('cancels every open match and frees their pending/approved bookings', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        hostelId: 'hostel-A',
        status: 'in_progress',
      });
      prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-A' });
      prisma.match.findMany.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);
      prisma.$transaction.mockResolvedValue([]);

      const result = await service.cancelTournament('sec-1', 'tour-1', dto);

      expect(prisma.match.findMany).toHaveBeenCalledWith({
        where: {
          tournamentId: 'tour-1',
          status: { notIn: ['completed', 'cancelled'] },
        },
        select: { id: true },
      });
      expect(prisma.match.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['m1', 'm2'] } },
        data: { status: 'cancelled', cancellationReason: dto.reason },
      });
      expect(prisma.venueBooking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            matchId: { in: ['m1', 'm2'] },
            status: { in: ['pending', 'approved'] },
          },
          data: expect.objectContaining({ status: 'rejected' }),
        }),
      );
      expect(prisma.tournament.update).toHaveBeenCalledWith({
        where: { id: 'tour-1' },
        data: { status: 'cancelled', cancellationReason: dto.reason },
      });
      expect(result).toEqual({ cancelled: true });
    });

    it('works even if the tournament has no fixtures yet (empty match set)', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        hostelId: 'hostel-A',
        status: 'registration_open',
      });
      prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-A' });
      prisma.match.findMany.mockResolvedValue([]);
      prisma.$transaction.mockResolvedValue([]);

      const result = await service.cancelTournament('sec-1', 'tour-1', dto);

      expect(result).toEqual({ cancelled: true });
    });
  });

  // D-022: public and generic so both a match cancellation (FR-009) and
  // a recorded result (FR-010) can trigger the same check.
  describe('maybeCompleteTournament', () => {
    it('completes the tournament once every match is terminal and at least one was actually completed', async () => {
      prisma.match.findMany.mockResolvedValue([
        { status: 'completed' },
        { status: 'cancelled' },
      ]);

      await service.maybeCompleteTournament('tour-1');

      expect(prisma.tournament.updateMany).toHaveBeenCalledWith({
        where: { id: 'tour-1', status: { notIn: ['cancelled', 'completed'] } },
        data: { status: 'completed' },
      });
    });

    it('does nothing if every match ends up cancelled with none ever completed', async () => {
      prisma.match.findMany.mockResolvedValue([{ status: 'cancelled' }]);

      await service.maybeCompleteTournament('tour-1');

      expect(prisma.tournament.updateMany).not.toHaveBeenCalled();
    });

    it('does nothing while any match is still open', async () => {
      prisma.match.findMany.mockResolvedValue([
        { status: 'completed' },
        { status: 'cancelled' },
        { status: 'scheduled' },
      ]);

      await service.maybeCompleteTournament('tour-1');

      expect(prisma.tournament.updateMany).not.toHaveBeenCalled();
    });
  });
});
