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
import { TeamService } from './team.service';
import { PrismaService } from '../../prisma/prisma.service';

const FUTURE = new Date('2099-12-31');
const PAST = new Date('2000-01-01');

describe('TeamService', () => {
  let service: TeamService;
  let prisma: {
    tournament: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    hostel: { findFirst: jest.Mock };
    team: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    teamPlayer: { findUnique: jest.Mock; create: jest.Mock; delete: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      tournament: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      hostel: { findFirst: jest.fn() },
      team: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      teamPlayer: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [TeamService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<TeamService>(TeamService);
  });

  // roster read after every mutation - keep a default so the happy paths
  // don't blow up on the follow-up formatRoster() call.
  function stubRoster(overrides = {}) {
    prisma.team.findUnique.mockResolvedValue({
      id: 'team-1',
      name: 'Titans',
      captainUserId: 'captain-1',
      tournament: { id: 'tour-1', name: 'Cup' },
      players: [],
      ...overrides,
    });
  }

  describe('createTeam', () => {
    it('throws NotFoundException if the tournament does not exist', async () => {
      prisma.tournament.findUnique.mockResolvedValue(null);
      await expect(
        service.createTeam('u1', 'tour-1', { name: 'T' }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException if the student's hostel isn't the tournament's hostel", async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        hostelId: 'hostel-A',
        status: 'registration_open',
        registrationDeadline: FUTURE,
      });
      prisma.user.findUnique.mockResolvedValue({ hostelId: 'hostel-B' });
      await expect(
        service.createTeam('u1', 'tour-1', { name: 'T' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if the deadline has passed', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        hostelId: 'hostel-A',
        status: 'registration_open',
        registrationDeadline: PAST,
      });
      prisma.user.findUnique.mockResolvedValue({ hostelId: 'hostel-A' });
      await expect(
        service.createTeam('u1', 'tour-1', { name: 'T' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException if the student is already on a team in this tournament', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        hostelId: 'hostel-A',
        status: 'registration_open',
        registrationDeadline: FUTURE,
      });
      prisma.user.findUnique.mockResolvedValue({ hostelId: 'hostel-A' });
      prisma.teamPlayer.findUnique.mockResolvedValue({ id: 'tp-1' });
      await expect(
        service.createTeam('u1', 'tour-1', { name: 'T' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates the team + the captain TeamPlayer in one transaction', async () => {
      prisma.tournament.findUnique.mockResolvedValue({
        id: 'tour-1',
        hostelId: 'hostel-A',
        status: 'registration_open',
        registrationDeadline: FUTURE,
      });
      prisma.user.findUnique.mockResolvedValue({ hostelId: 'hostel-A' });
      prisma.teamPlayer.findUnique.mockResolvedValue(null);
      const tx = {
        team: { create: jest.fn().mockResolvedValue({ id: 'team-1' }) },
        teamPlayer: { create: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) =>
        fn(tx),
      );
      stubRoster();

      await service.createTeam('captain-1', 'tour-1', { name: 'Titans' });

      expect(tx.team.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tournamentId: 'tour-1',
            name: 'Titans',
            captainUserId: 'captain-1',
            hostelId: 'hostel-A',
          }),
        }),
      );
      expect(tx.teamPlayer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            teamId: 'team-1',
            tournamentId: 'tour-1',
            userId: 'captain-1',
          },
        }),
      );
    });
  });

  describe('addPlayer', () => {
    const openTeam = {
      id: 'team-1',
      name: 'Titans',
      tournamentId: 'tour-1',
      hostelId: 'hostel-A',
      captainUserId: 'captain-1',
      tournament: { status: 'registration_open', registrationDeadline: FUTURE },
    };

    it('throws ForbiddenException if the caller is not the captain', async () => {
      prisma.team.findUnique.mockResolvedValue(openTeam);
      await expect(
        service.addPlayer('not-captain', 'team-1', { email: 'x@thapar.edu' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException if no user has that email', async () => {
      prisma.team.findUnique.mockResolvedValue(openTeam);
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.addPlayer('captain-1', 'team-1', {
          email: 'nobody@thapar.edu',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws BadRequestException if the player isn't in the team's hostel", async () => {
      prisma.team.findUnique.mockResolvedValue(openTeam);
      prisma.user.findUnique.mockResolvedValue({
        id: 'p1',
        name: 'Riya',
        hostelId: 'hostel-B',
      });
      await expect(
        service.addPlayer('captain-1', 'team-1', { email: 'riya@thapar.edu' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException if the player is already on a team in this tournament', async () => {
      prisma.team.findUnique.mockResolvedValue(openTeam);
      prisma.user.findUnique.mockResolvedValue({
        id: 'p1',
        name: 'Riya',
        hostelId: 'hostel-A',
      });
      prisma.teamPlayer.findUnique.mockResolvedValue({ id: 'tp-1' });
      await expect(
        service.addPlayer('captain-1', 'team-1', { email: 'riya@thapar.edu' }),
      ).rejects.toThrow(ConflictException);
    });

    it('adds the player on the happy path', async () => {
      prisma.team.findUnique.mockResolvedValueOnce(openTeam);
      prisma.user.findUnique.mockResolvedValue({
        id: 'p1',
        name: 'Riya',
        hostelId: 'hostel-A',
      });
      prisma.teamPlayer.findUnique.mockResolvedValue(null);
      prisma.teamPlayer.create.mockResolvedValue({});
      stubRoster();

      await service.addPlayer('captain-1', 'team-1', {
        email: 'riya@thapar.edu',
      });

      expect(prisma.teamPlayer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { teamId: 'team-1', tournamentId: 'tour-1', userId: 'p1' },
        }),
      );
    });
  });

  describe('removePlayer', () => {
    const openTeam = {
      id: 'team-1',
      name: 'Titans',
      tournamentId: 'tour-1',
      hostelId: 'hostel-A',
      captainUserId: 'captain-1',
      tournament: { status: 'registration_open', registrationDeadline: FUTURE },
    };

    it('throws ForbiddenException if the caller is not the captain', async () => {
      prisma.team.findUnique.mockResolvedValue(openTeam);
      await expect(
        service.removePlayer('not-captain', 'team-1', 'p1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if trying to remove the captain', async () => {
      prisma.team.findUnique.mockResolvedValue(openTeam);
      await expect(
        service.removePlayer('captain-1', 'team-1', 'captain-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if the player is not on this team', async () => {
      prisma.team.findUnique.mockResolvedValue(openTeam);
      prisma.teamPlayer.findUnique.mockResolvedValue(null);
      await expect(
        service.removePlayer('captain-1', 'team-1', 'p1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('removes the player on the happy path', async () => {
      prisma.team.findUnique.mockResolvedValueOnce(openTeam);
      prisma.teamPlayer.findUnique.mockResolvedValue({
        id: 'tp-1',
        teamId: 'team-1',
      });
      prisma.teamPlayer.delete.mockResolvedValue({});
      stubRoster();

      await service.removePlayer('captain-1', 'team-1', 'p1');

      expect(prisma.teamPlayer.delete).toHaveBeenCalledWith({
        where: { id: 'tp-1' },
      });
    });
  });

  // D-016 (resolves Q-007).
  describe('setRegistrationStatus', () => {
    it('throws NotFoundException if the team does not exist', async () => {
      prisma.team.findUnique.mockResolvedValue(null);
      await expect(
        service.setRegistrationStatus('sec-1', 'team-1', 'rejected'),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException if the caller isn't that hostel's Secretary", async () => {
      prisma.team.findUnique.mockResolvedValue({
        id: 'team-1',
        hostelId: 'hostel-A',
      });
      prisma.hostel.findFirst.mockResolvedValue(null);
      await expect(
        service.setRegistrationStatus('not-sec', 'team-1', 'rejected'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updates registrationStatus on the happy path', async () => {
      prisma.team.findUnique
        .mockResolvedValueOnce({ id: 'team-1', hostelId: 'hostel-A' })
        .mockResolvedValueOnce({
          id: 'team-1',
          name: 'Titans',
          captainUserId: 'c1',
          registrationStatus: 'rejected',
          tournament: { id: 't1', name: 'Cup' },
          players: [],
        });
      prisma.hostel.findFirst.mockResolvedValue({ id: 'hostel-A' });
      prisma.team.update.mockResolvedValue({});

      await service.setRegistrationStatus('sec-1', 'team-1', 'rejected');

      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: 'team-1' },
        data: { registrationStatus: 'rejected' },
      });
    });
  });
});
