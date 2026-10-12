import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StandingsService } from './standings.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('StandingsService', () => {
  let service: StandingsService;
  let prisma: {
    tournament: { findUnique: jest.Mock };
    team: { findMany: jest.Mock };
    match: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      tournament: { findUnique: jest.fn() },
      team: { findMany: jest.fn() },
      match: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StandingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<StandingsService>(StandingsService);
  });

  it('throws NotFoundException if the tournament does not exist', async () => {
    prisma.tournament.findUnique.mockResolvedValue(null);
    await expect(service.getStandings('tour-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws BadRequestException for a knockout tournament', async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      id: 'tour-1',
      format: 'knockout',
    });
    await expect(service.getStandings('tour-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('includes every approved team even with zero matches played', async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      id: 'tour-1',
      format: 'league',
    });
    prisma.team.findMany.mockResolvedValue([
      { id: 't1', name: 'Alpha' },
      { id: 't2', name: 'Bravo' },
    ]);
    prisma.match.findMany.mockResolvedValue([]);

    const result = await service.getStandings('tour-1');

    expect(result.standings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          teamId: 't1',
          played: 0,
          points: 0,
          rank: 1,
        }),
        expect.objectContaining({
          teamId: 't2',
          played: 0,
          points: 0,
          rank: 1,
        }),
      ]),
    );
  });

  it('awards 3 points for a win, 0 for a loss, and tallies played/won/lost', async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      id: 'tour-1',
      format: 'league',
    });
    prisma.team.findMany.mockResolvedValue([
      { id: 't1', name: 'Alpha' },
      { id: 't2', name: 'Bravo' },
    ]);
    prisma.match.findMany.mockResolvedValue([
      { teamAId: 't1', teamBId: 't2', winnerTeamId: 't1' },
    ]);

    const result = await service.getStandings('tour-1');

    expect(result.standings).toEqual([
      expect.objectContaining({
        rank: 1,
        teamId: 't1',
        played: 1,
        won: 1,
        lost: 0,
        points: 3,
      }),
      expect.objectContaining({
        rank: 2,
        teamId: 't2',
        played: 1,
        won: 0,
        lost: 1,
        points: 0,
      }),
    ]);
  });

  it('awards 1 point each for a draw', async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      id: 'tour-1',
      format: 'league',
    });
    prisma.team.findMany.mockResolvedValue([
      { id: 't1', name: 'Alpha' },
      { id: 't2', name: 'Bravo' },
    ]);
    prisma.match.findMany.mockResolvedValue([
      { teamAId: 't1', teamBId: 't2', winnerTeamId: null },
    ]);

    const result = await service.getStandings('tour-1');

    expect(result.standings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ teamId: 't1', drawn: 1, points: 1 }),
        expect.objectContaining({ teamId: 't2', drawn: 1, points: 1 }),
      ]),
    );
  });

  // D-005: equal points are co-ranked, never artificially split apart.
  it('co-ranks teams with equal points instead of giving them different ranks', async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      id: 'tour-1',
      format: 'league',
    });
    prisma.team.findMany.mockResolvedValue([
      { id: 't1', name: 'Alpha' },
      { id: 't2', name: 'Bravo' },
      { id: 't3', name: 'Charlie' },
    ]);
    // t1 beats t2 (3 pts), t3 draws nobody tracked here but starts at 0 -
    // instead, give t3 a draw elsewhere to also land on some points equal
    // to another team for a real tie: t1 and t3 both end on 3 points via
    // separate wins over different opponents.
    prisma.match.findMany.mockResolvedValue([
      { teamAId: 't1', teamBId: 't2', winnerTeamId: 't1' },
      { teamAId: 't3', teamBId: 't2', winnerTeamId: 't3' },
    ]);

    const result = await service.getStandings('tour-1');

    const t1 = result.standings.find((r) => r.teamId === 't1');
    const t3 = result.standings.find((r) => r.teamId === 't3');
    expect(t1?.points).toBe(3);
    expect(t3?.points).toBe(3);
    expect(t1?.rank).toBe(t3?.rank);
    expect(t1?.rank).toBe(1);

    const t2 = result.standings.find((r) => r.teamId === 't2');
    expect(t2?.points).toBe(0);
    expect(t2?.rank).toBe(3); // two teams ahead at rank 1, so the next rank is 3, not 2
  });

  it('excludes a match involving a team that is no longer approved', async () => {
    prisma.tournament.findUnique.mockResolvedValue({
      id: 'tour-1',
      format: 'league',
    });
    prisma.team.findMany.mockResolvedValue([{ id: 't1', name: 'Alpha' }]); // t2 not approved
    prisma.match.findMany.mockResolvedValue([
      { teamAId: 't1', teamBId: 't2', winnerTeamId: 't1' },
    ]);

    const result = await service.getStandings('tour-1');

    expect(result.standings).toEqual([
      expect.objectContaining({ teamId: 't1', played: 0, points: 0 }),
    ]);
  });
});
