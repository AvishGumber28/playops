import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ResultsService } from './results.service';
import { TournamentService } from '../tournament/tournament.service';
import { FixtureService } from '../tournament/fixture.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ResultsService', () => {
  let service: ResultsService;
  let prisma: {
    match: { findUnique: jest.Mock; update: jest.Mock };
    scorecard: { findUnique: jest.Mock; create: jest.Mock };
    tournament: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let tournamentService: {
    tournamentForSecretaryOrThrow: jest.Mock;
    maybeCompleteTournament: jest.Mock;
  };
  let fixtureService: { advanceWinner: jest.Mock };

  const footballTournament = {
    sportId: 'sport-football',
    sport: { scorecardTemplate: 'football' },
  };
  const cricketTournament = {
    sportId: 'sport-cricket',
    sport: { scorecardTemplate: 'cricket' },
  };

  beforeEach(async () => {
    prisma = {
      match: { findUnique: jest.fn(), update: jest.fn() },
      scorecard: { findUnique: jest.fn(), create: jest.fn() },
      tournament: { findUnique: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    tournamentService = {
      tournamentForSecretaryOrThrow: jest.fn(),
      maybeCompleteTournament: jest.fn(),
    };
    fixtureService = { advanceWinner: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResultsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TournamentService, useValue: tournamentService },
        { provide: FixtureService, useValue: fixtureService },
      ],
    }).compile();

    service = module.get<ResultsService>(ResultsService);
  });

  const footballMatch = {
    id: 'm1',
    tournamentId: 'tour-1',
    round: 1,
    matchNumber: 2,
    teamAId: 'teamA',
    teamBId: 'teamB',
    status: 'scheduled',
  };

  describe('submitScorecard', () => {
    it('throws NotFoundException if the match does not exist', async () => {
      prisma.match.findUnique.mockResolvedValue(null);
      await expect(
        service.submitScorecard('sec-1', 'm1', {
          winnerTeamId: 'teamA',
          data: {},
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates ForbiddenException from the secretary check', async () => {
      prisma.match.findUnique.mockResolvedValue(footballMatch);
      tournamentService.tournamentForSecretaryOrThrow.mockRejectedValue(
        new ForbiddenException(),
      );
      await expect(
        service.submitScorecard('u1', 'm1', {
          winnerTeamId: 'teamA',
          data: {},
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException if either team slot is still empty', async () => {
      prisma.match.findUnique.mockResolvedValue({
        ...footballMatch,
        teamBId: null,
      });
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      await expect(
        service.submitScorecard('sec-1', 'm1', {
          winnerTeamId: 'teamA',
          data: {},
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if the match already has a result', async () => {
      prisma.match.findUnique.mockResolvedValue({
        ...footballMatch,
        status: 'completed',
      });
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      await expect(
        service.submitScorecard('sec-1', 'm1', {
          winnerTeamId: 'teamA',
          data: {},
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if the match is cancelled', async () => {
      prisma.match.findUnique.mockResolvedValue({
        ...footballMatch,
        status: 'cancelled',
      });
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      await expect(
        service.submitScorecard('sec-1', 'm1', {
          winnerTeamId: 'teamA',
          data: {},
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if a scorecard already exists for this match', async () => {
      prisma.match.findUnique.mockResolvedValue(footballMatch);
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      prisma.scorecard.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        service.submitScorecard('sec-1', 'm1', {
          winnerTeamId: 'teamA',
          data: {},
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException for a draw on a sport that disallows it', async () => {
      prisma.match.findUnique.mockResolvedValue(footballMatch);
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      prisma.scorecard.findUnique.mockResolvedValue(null);
      prisma.tournament.findUnique.mockResolvedValue(cricketTournament);
      await expect(
        service.submitScorecard('sec-1', 'm1', {
          winnerTeamId: null,
          data: {
            teamARuns: 150,
            teamAWickets: 5,
            teamAOvers: 20,
            teamBRuns: 150,
            teamBWickets: 5,
            teamBOvers: 20,
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if winnerTeamId is neither team', async () => {
      prisma.match.findUnique.mockResolvedValue(footballMatch);
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      prisma.scorecard.findUnique.mockResolvedValue(null);
      prisma.tournament.findUnique.mockResolvedValue(footballTournament);
      await expect(
        service.submitScorecard('sec-1', 'm1', {
          winnerTeamId: 'someone-else',
          data: { teamAGoals: 2, teamBGoals: 1 },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if a required data field is missing or not a number', async () => {
      prisma.match.findUnique.mockResolvedValue(footballMatch);
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      prisma.scorecard.findUnique.mockResolvedValue(null);
      prisma.tournament.findUnique.mockResolvedValue(footballTournament);
      await expect(
        service.submitScorecard('sec-1', 'm1', {
          winnerTeamId: 'teamA',
          data: { teamAGoals: 2 }, // missing teamBGoals
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a draw for football (allowDraw: true)', async () => {
      prisma.match.findUnique
        .mockResolvedValueOnce(footballMatch) // matchForSecretaryOrThrow
        .mockResolvedValueOnce({
          ...footballMatch,
          status: 'completed',
          winnerTeamId: null,
        }); // getScorecard's re-read
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      prisma.scorecard.findUnique
        .mockResolvedValueOnce(null) // the "already exists" check
        .mockResolvedValueOnce({
          // getScorecard's own read, at the end
          id: 'sc1',
          data: { teamAGoals: 1, teamBGoals: 1 },
          enteredAt: new Date(),
          enteredBy: { id: 'sec-1', name: 'Sec' },
          sport: { id: 'sport-football', name: 'Football' },
        });
      prisma.tournament.findUnique.mockResolvedValue(footballTournament);
      prisma.match.update.mockResolvedValue({});

      const result = await service.submitScorecard('sec-1', 'm1', {
        winnerTeamId: null,
        data: { teamAGoals: 1, teamBGoals: 1 },
      });

      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { status: 'completed', winnerTeamId: null },
      });
      expect(result.winnerTeamId).toBeNull();
    });

    it('creates the scorecard and marks the match completed on the happy path', async () => {
      prisma.match.findUnique
        .mockResolvedValueOnce(footballMatch) // matchForSecretaryOrThrow
        .mockResolvedValueOnce({
          ...footballMatch,
          status: 'completed',
          winnerTeamId: 'teamA',
        }); // getScorecard's re-read
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      prisma.scorecard.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'sc1',
          data: { teamAGoals: 2, teamBGoals: 1 },
          enteredAt: new Date(),
          enteredBy: { id: 'sec-1', name: 'Sec' },
          sport: { id: 'sport-football', name: 'Football' },
        });
      prisma.tournament.findUnique.mockResolvedValue(footballTournament);
      prisma.match.update.mockResolvedValue({});

      const result = await service.submitScorecard('sec-1', 'm1', {
        winnerTeamId: 'teamA',
        data: { teamAGoals: 2, teamBGoals: 1 },
      });

      expect(prisma.scorecard.create).toHaveBeenCalledWith({
        data: {
          matchId: 'm1',
          sportId: 'sport-football',
          data: { teamAGoals: 2, teamBGoals: 1 },
          enteredById: 'sec-1',
        },
      });
      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { status: 'completed', winnerTeamId: 'teamA' },
      });
      expect(tournamentService.maybeCompleteTournament).toHaveBeenCalledWith(
        'tour-1',
      );
      expect(result.winnerTeamId).toBe('teamA');
    });

    // FR-010/D-024: this is what makes a knockout bracket actually
    // progress - the match's own round/matchNumber plus the winner just
    // recorded, handed straight to FixtureService.
    it('propagates the winner into the next round via FixtureService.advanceWinner', async () => {
      prisma.match.findUnique
        .mockResolvedValueOnce(footballMatch)
        .mockResolvedValueOnce({
          ...footballMatch,
          status: 'completed',
          winnerTeamId: 'teamA',
        });
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      prisma.scorecard.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'sc1',
          data: { teamAGoals: 2, teamBGoals: 1 },
          enteredAt: new Date(),
          enteredBy: { id: 'sec-1', name: 'Sec' },
          sport: { id: 'sport-football', name: 'Football' },
        });
      prisma.tournament.findUnique.mockResolvedValue(footballTournament);
      prisma.match.update.mockResolvedValue({});

      await service.submitScorecard('sec-1', 'm1', {
        winnerTeamId: 'teamA',
        data: { teamAGoals: 2, teamBGoals: 1 },
      });

      expect(fixtureService.advanceWinner).toHaveBeenCalledWith(
        'tour-1',
        1,
        2,
        'teamA',
      );
    });
  });

  describe('getScorecard', () => {
    it('throws NotFoundException if no scorecard exists yet', async () => {
      prisma.match.findUnique.mockResolvedValue(footballMatch);
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      prisma.scorecard.findUnique.mockResolvedValue(null);
      await expect(service.getScorecard('sec-1', 'm1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the scorecard plus the match winner', async () => {
      prisma.match.findUnique.mockResolvedValue({
        ...footballMatch,
        status: 'completed',
        winnerTeamId: 'teamA',
      });
      tournamentService.tournamentForSecretaryOrThrow.mockResolvedValue({
        id: 'tour-1',
      });
      prisma.scorecard.findUnique.mockResolvedValue({
        id: 'sc1',
        data: { teamAGoals: 2, teamBGoals: 1 },
        enteredAt: new Date(),
        enteredBy: { id: 'sec-1', name: 'Sec' },
        sport: { id: 'sport-football', name: 'Football' },
      });

      const result = await service.getScorecard('sec-1', 'm1');

      expect(result.winnerTeamId).toBe('teamA');
      expect(result.data).toEqual({ teamAGoals: 2, teamBGoals: 1 });
    });
  });
});
