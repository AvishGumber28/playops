import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ConflictService } from './conflict.service';
import { TournamentService } from '../tournament/tournament.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ConflictService', () => {
  let service: ConflictService;
  let prisma: {
    match: { findMany: jest.Mock };
    conflictLog: {
      deleteMany: jest.Mock;
      createMany: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let tournamentService: { tournamentForSecretaryOrThrow: jest.Mock };

  beforeEach(async () => {
    prisma = {
      match: { findMany: jest.fn() },
      conflictLog: {
        deleteMany: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({}),
        findMany: jest.fn(),
      },
    };
    tournamentService = { tournamentForSecretaryOrThrow: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConflictService,
        { provide: PrismaService, useValue: prisma },
        { provide: TournamentService, useValue: tournamentService },
      ],
    }).compile();

    service = module.get<ConflictService>(ConflictService);
  });

  describe('checkTournament', () => {
    it('propagates ForbiddenException from the secretary check', async () => {
      tournamentService.tournamentForSecretaryOrThrow.mockRejectedValue(
        new ForbiddenException(),
      );
      await expect(service.checkTournament('u1', 'tour-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('reports no conflicts and clears stale logs when the schedule is clean', async () => {
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      prisma.match.findMany.mockResolvedValue([
        {
          id: 'm1',
          round: 1,
          matchNumber: 1,
          teamAId: 't1',
          teamBId: 't2',
          scheduledDate: new Date('2099-01-01'),
          scheduledTime: '09:00',
          venueBooking: { venueId: 'v1' },
        },
        {
          id: 'm2',
          round: 1,
          matchNumber: 2,
          teamAId: 't3',
          teamBId: 't4',
          scheduledDate: new Date('2099-01-01'),
          scheduledTime: '10:00', // different time - no clash
          venueBooking: { venueId: 'v1' },
        },
      ]);

      const result = await service.checkTournament('sec-1', 'tour-1');

      expect(result.conflicts).toEqual([]);
      expect(prisma.conflictLog.deleteMany).toHaveBeenCalledWith({
        where: { tournamentId: 'tour-1', resolution: 'unresolved' },
      });
      expect(prisma.conflictLog.createMany).not.toHaveBeenCalled();
    });

    it('detects a team scheduled into two matches at the same date+time', async () => {
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      prisma.match.findMany.mockResolvedValue([
        {
          id: 'm1',
          round: 1,
          matchNumber: 1,
          teamAId: 't1',
          teamBId: 't2',
          scheduledDate: new Date('2099-01-01'),
          scheduledTime: '09:00',
          venueBooking: { venueId: 'v1' },
        },
        {
          id: 'm2',
          round: 2,
          matchNumber: 1,
          teamAId: 't1', // same team as m1
          teamBId: 't3',
          scheduledDate: new Date('2099-01-01'),
          scheduledTime: '09:00', // same slot
          venueBooking: { venueId: 'v2' }, // different venue - not a venue clash
        },
      ]);

      const result = await service.checkTournament('sec-1', 'tour-1');

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('team');
      expect(result.conflicts[0].matches.map((m) => m.id)).toEqual([
        'm1',
        'm2',
      ]);
      expect(prisma.conflictLog.createMany).toHaveBeenCalledWith({
        data: [
          {
            type: 'team',
            tournamentId: 'tour-1',
            matchId: 'm1',
            resolution: 'unresolved',
          },
          {
            type: 'team',
            tournamentId: 'tour-1',
            matchId: 'm2',
            resolution: 'unresolved',
          },
        ],
      });
    });

    it('detects two different-team matches double-booked at the same venue+time (defensive check)', async () => {
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      prisma.match.findMany.mockResolvedValue([
        {
          id: 'm1',
          round: 1,
          matchNumber: 1,
          teamAId: 't1',
          teamBId: 't2',
          scheduledDate: new Date('2099-01-01'),
          scheduledTime: '09:00',
          venueBooking: { venueId: 'v1' },
        },
        {
          id: 'm2',
          round: 1,
          matchNumber: 2,
          teamAId: 't3',
          teamBId: 't4', // no shared team with m1
          scheduledDate: new Date('2099-01-01'),
          scheduledTime: '09:00', // same slot
          venueBooking: { venueId: 'v1' }, // same venue
        },
      ]);

      const result = await service.checkTournament('sec-1', 'tour-1');

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].type).toBe('venue');
    });
  });

  describe('getConflicts', () => {
    it("returns the tournament's stored conflict log, newest first", async () => {
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      prisma.conflictLog.findMany.mockResolvedValue([{ id: 'c1' }]);

      const result = await service.getConflicts('sec-1', 'tour-1');

      expect(prisma.conflictLog.findMany).toHaveBeenCalledWith({
        where: { tournamentId: 'tour-1' },
        orderBy: { detectedAt: 'desc' },
      });
      expect(result).toEqual([{ id: 'c1' }]);
    });
  });
});
