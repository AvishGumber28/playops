import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { AddPlayerDto } from './dto/add-player.dto';

// FR-006. Team creation + roster management, all gated on the
// tournament's registration window and the "one hostel, one team per
// tournament" business rules - checked here, never trusted from the
// client.
@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadTeamForCaptain(teamId: string, callerId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        tournamentId: true,
        hostelId: true,
        captainUserId: true,
        tournament: {
          select: { status: true, registrationDeadline: true },
        },
      },
    });
    if (!team) {
      throw new NotFoundException('Team not found.');
    }
    if (team.captainUserId !== callerId) {
      throw new ForbiddenException(
        'Only the team captain can manage this roster.',
      );
    }
    return team;
  }

  private assertRegistrationOpen(tournament: {
    status: string;
    registrationDeadline: Date;
  }) {
    if (tournament.status !== 'registration_open') {
      throw new ConflictException(
        'Registration is not open for this tournament.',
      );
    }
    if (tournament.registrationDeadline.getTime() <= Date.now()) {
      throw new BadRequestException('The registration deadline has passed.');
    }
  }

  private rosterOf(teamId: string) {
    return this.prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        captainUserId: true,
        registrationStatus: true,
        tournament: { select: { id: true, name: true } },
        players: {
          orderBy: { addedAt: 'asc' },
          select: {
            user: {
              select: { id: true, name: true, email: true, rollNumber: true },
            },
          },
        },
      },
    });
  }

  private async formatRoster(teamId: string) {
    const team = await this.rosterOf(teamId);
    if (!team) {
      throw new NotFoundException('Team not found.');
    }
    return {
      id: team.id,
      name: team.name,
      captainUserId: team.captainUserId,
      registrationStatus: team.registrationStatus,
      tournament: team.tournament,
      players: team.players.map((p) => ({
        ...p.user,
        isCaptain: p.user.id === team.captainUserId,
      })),
    };
  }

  // D-016 (resolves Q-007): the tournament's Secretary can reject a
  // registered team, and re-approve it. Reversible flag, no pending gate.
  async setRegistrationStatus(
    callerId: string,
    teamId: string,
    status: 'approved' | 'rejected',
  ) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, hostelId: true },
    });
    if (!team) {
      throw new NotFoundException('Team not found.');
    }
    const hostel = await this.prisma.hostel.findFirst({
      where: { id: team.hostelId, sportsSecretaryUserId: callerId },
      select: { id: true },
    });
    if (!hostel) {
      throw new ForbiddenException(
        "You are not this tournament's Sports Secretary.",
      );
    }

    await this.prisma.team.update({
      where: { id: teamId },
      data: { registrationStatus: status },
    });
    return this.formatRoster(teamId);
  }

  async createTeam(callerId: string, tournamentId: string, dto: CreateTeamDto) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        hostelId: true,
        status: true,
        registrationDeadline: true,
      },
    });
    if (!tournament) {
      throw new NotFoundException('Tournament not found.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: callerId },
      select: { hostelId: true },
    });
    // Key rule: a student only registers for tournaments in their OWN
    // hostel (the one they selected). A Secretary listing a Hostel A
    // tournament is only registerable by Hostel A members.
    if (!user?.hostelId || user.hostelId !== tournament.hostelId) {
      throw new ForbiddenException(
        'This tournament is for a different hostel.',
      );
    }

    this.assertRegistrationOpen(tournament);

    // Business rule 2: one team per player per tournament. Enforced by
    // the TeamPlayer @@unique([tournamentId, userId]) too - pre-checked
    // here for a clean 409.
    const existing = await this.prisma.teamPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId, userId: callerId } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'You are already registered for this tournament.',
      );
    }

    // The captain is roster member #1 (D-015) - team + captain
    // TeamPlayer in one transaction.
    const team = await this.prisma.$transaction(async (tx) => {
      const created = await tx.team.create({
        data: {
          tournamentId,
          name: dto.name,
          captainUserId: callerId,
          hostelId: tournament.hostelId,
          status: 'active',
          registrationStatus: 'approved',
        },
        select: { id: true },
      });
      await tx.teamPlayer.create({
        data: { teamId: created.id, tournamentId, userId: callerId },
      });
      return created;
    });

    return this.formatRoster(team.id);
  }

  async addPlayer(callerId: string, teamId: string, dto: AddPlayerDto) {
    const team = await this.loadTeamForCaptain(teamId, callerId);
    this.assertRegistrationOpen(team.tournament);

    const player = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, name: true, hostelId: true },
    });
    if (!player) {
      throw new NotFoundException(`No student found with email ${dto.email}.`);
    }

    // player.hostelId == team.hostelId (business rule / FR-006), checked
    // at insert.
    if (player.hostelId !== team.hostelId) {
      throw new BadRequestException(
        `${player.name} is not a member of this hostel.`,
      );
    }

    const existing = await this.prisma.teamPlayer.findUnique({
      where: {
        tournamentId_userId: {
          tournamentId: team.tournamentId,
          userId: player.id,
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `${player.name} is already on a team in this tournament.`,
      );
    }

    await this.prisma.teamPlayer.create({
      data: { teamId, tournamentId: team.tournamentId, userId: player.id },
    });

    return this.formatRoster(teamId);
  }

  async removePlayer(callerId: string, teamId: string, userId: string) {
    const team = await this.loadTeamForCaptain(teamId, callerId);

    if (userId === team.captainUserId) {
      throw new BadRequestException(
        'The captain cannot be removed from their own team (D-015).',
      );
    }

    this.assertRegistrationOpen(team.tournament);

    const membership = await this.prisma.teamPlayer.findUnique({
      where: {
        tournamentId_userId: { tournamentId: team.tournamentId, userId },
      },
      select: { id: true, teamId: true },
    });
    if (!membership || membership.teamId !== teamId) {
      throw new NotFoundException('That player is not on this team.');
    }

    await this.prisma.teamPlayer.delete({ where: { id: membership.id } });

    return this.formatRoster(teamId);
  }

  // Any authenticated user can view a roster (read-only).
  async getTeam(teamId: string) {
    return this.formatRoster(teamId);
  }
}
