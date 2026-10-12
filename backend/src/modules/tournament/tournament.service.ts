import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { CancelTournamentDto } from './dto/cancel-tournament.dto';

// Shape returned by the tournament endpoints - the tournament plus the
// relations the frontend shows and a team count.
const TOURNAMENT_SELECT = {
  id: true,
  name: true,
  format: true,
  status: true,
  cancellationReason: true,
  registrationDeadline: true,
  createdAt: true,
  // scorecardTemplate (FR-010): which result-entry form the frontend
  // should render for this tournament's sport.
  sport: { select: { id: true, name: true, scorecardTemplate: true } },
  hostel: { select: { id: true, code: true, name: true } },
  _count: { select: { teams: true } },
} as const;

type RawTournament = {
  _count: { teams: number };
} & Record<string, unknown>;

// Prisma's _count is awkward to consume on the client - flatten it to a
// plain teamCount before it leaves the service.
function withTeamCount<T extends RawTournament>(t: T) {
  const { _count, ...rest } = t;
  return { ...rest, teamCount: _count.teams };
}

@Injectable()
export class TournamentService {
  constructor(private readonly prisma: PrismaService) {}

  // "the hostel this caller is Sports Secretary of" - exactly one
  // (sportsSecretaryUserId is unique), or none.
  private async secretaryHostelOrThrow(callerId: string) {
    const hostel = await this.prisma.hostel.findFirst({
      where: { sportsSecretaryUserId: callerId },
      select: { id: true },
    });
    if (!hostel) {
      throw new ForbiddenException('Only a Sports Secretary can do this.');
    }
    return hostel;
  }

  // For actions on a specific tournament: the caller must be the
  // Secretary of THAT tournament's hostel. Public - FixtureService (and
  // anything else scoped to "the tournament's own Secretary") reuses this
  // instead of duplicating the check.
  async tournamentForSecretaryOrThrow(callerId: string, tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, hostelId: true, status: true, format: true },
    });
    if (!tournament) {
      throw new NotFoundException('Tournament not found.');
    }
    const hostel = await this.prisma.hostel.findFirst({
      where: { id: tournament.hostelId, sportsSecretaryUserId: callerId },
      select: { id: true },
    });
    if (!hostel) {
      throw new ForbiddenException(
        "You are not this tournament's Sports Secretary.",
      );
    }
    return tournament;
  }

  async createTournament(callerId: string, dto: CreateTournamentDto) {
    const hostel = await this.secretaryHostelOrThrow(callerId);

    const sport = await this.prisma.sport.findUnique({
      where: { id: dto.sportId },
      select: { id: true },
    });
    if (!sport) {
      throw new NotFoundException('That sport does not exist.');
    }

    const deadline = new Date(dto.registrationDeadline);
    if (deadline.getTime() <= Date.now()) {
      throw new BadRequestException(
        'The registration deadline must be in the future.',
      );
    }

    // No approval gate (business rule 7); opens for registration
    // immediately (D-014).
    const created = await this.prisma.tournament.create({
      data: {
        name: dto.name,
        sportId: dto.sportId,
        hostelId: hostel.id,
        format: dto.format,
        registrationDeadline: deadline,
        status: 'registration_open',
        createdById: callerId,
      },
      select: TOURNAMENT_SELECT,
    });
    return withTeamCount(created);
  }

  async listMyHostelTournaments(callerId: string) {
    const hostel = await this.secretaryHostelOrThrow(callerId);
    const tournaments = await this.prisma.tournament.findMany({
      where: { hostelId: hostel.id },
      orderBy: { createdAt: 'desc' },
      select: TOURNAMENT_SELECT,
    });
    return tournaments.map(withTeamCount);
  }

  // D-025: the Caretaker's read-only view of their own hostel's
  // tournaments - same shape as the Secretary's own list above, minus
  // any ability to act on them (create/cancel/delete/approve stay
  // Secretary-only). Mirrors the Caretaker-of-hostel check
  // hostel.service.ts already uses for change-request approvals.
  async listTournamentsForCaretaker(callerId: string) {
    const hostel = await this.prisma.hostel.findFirst({
      where: { caretakerUserId: callerId },
    });
    if (!hostel) {
      throw new ForbiddenException('Only a Caretaker can view this.');
    }
    const tournaments = await this.prisma.tournament.findMany({
      where: { hostelId: hostel.id },
      orderBy: { createdAt: 'desc' },
      select: TOURNAMENT_SELECT,
    });
    return tournaments.map(withTeamCount);
  }

  listSports() {
    return this.prisma.sport.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, defaultTeamSize: true },
    });
  }

  // FR-006: what a student sees - the tournaments of their OWN hostel,
  // plus whether they're already on a team in each (and that team's
  // registration status - D-016). A student with no hostel yet sees
  // nothing.
  async listTournamentsForMyHostel(callerId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: callerId },
      select: { hostelId: true },
    });
    if (!user?.hostelId) {
      return [];
    }

    const tournaments = await this.prisma.tournament.findMany({
      where: { hostelId: user.hostelId },
      orderBy: { createdAt: 'desc' },
      select: TOURNAMENT_SELECT,
    });

    const memberships = await this.prisma.teamPlayer.findMany({
      where: {
        userId: callerId,
        tournamentId: { in: tournaments.map((t) => t.id) },
      },
      select: {
        tournamentId: true,
        team: {
          select: {
            id: true,
            name: true,
            captainUserId: true,
            registrationStatus: true,
          },
        },
      },
    });
    const byTournament = new Map(
      memberships.map((m) => [m.tournamentId, m.team]),
    );

    return tournaments.map((t) => {
      const team = byTournament.get(t.id);
      return {
        ...withTeamCount(t),
        myTeam: team
          ? {
              id: team.id,
              name: team.name,
              isCaptain: team.captainUserId === callerId,
              registrationStatus: team.registrationStatus,
            }
          : null,
      };
    });
  }

  // FR-006 completion / D-016: the Secretary sees every team registered
  // for their tournament, with rosters and registration status.
  async listTournamentTeams(callerId: string, tournamentId: string) {
    await this.tournamentForSecretaryOrThrow(callerId, tournamentId);
    const teams = await this.prisma.team.findMany({
      where: { tournamentId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        captainUserId: true,
        registrationStatus: true,
        createdAt: true,
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
    return teams.map((team) => ({
      id: team.id,
      name: team.name,
      captainUserId: team.captainUserId,
      registrationStatus: team.registrationStatus,
      players: team.players.map((p) => ({
        ...p.user,
        isCaptain: p.user.id === team.captainUserId,
      })),
    }));
  }

  // D-017: hard delete, cascading to teams + team-player rows. Refused
  // once fixtures exist while the tournament is still genuinely in
  // progress - the Secretary cancels (D-021) or lets it run to
  // completion instead. D-022: once it's `cancelled`/`completed` (a
  // terminal state), deleting is always allowed - that's the "remove it
  // from the list for good" the Secretary wants once it's over, and the
  // cascade now also clears its Match/VenueBooking/ConflictLog/Scorecard
  // rows (never needed pre-D-021/D-022, since nothing reached this point
  // with matches attached and a terminal status at the same time before).
  async deleteTournament(callerId: string, tournamentId: string) {
    const tournament = await this.tournamentForSecretaryOrThrow(
      callerId,
      tournamentId,
    );
    const terminal =
      tournament.status === 'cancelled' || tournament.status === 'completed';

    if (!terminal) {
      const matchCount = await this.prisma.match.count({
        where: { tournamentId },
      });
      if (matchCount > 0) {
        throw new ConflictException(
          'This tournament already has fixtures - cancel it instead of deleting it.',
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.scorecard.deleteMany({ where: { match: { tournamentId } } }),
      this.prisma.conflictLog.deleteMany({ where: { tournamentId } }),
      this.prisma.venueBooking.deleteMany({ where: { tournamentId } }),
      this.prisma.match.deleteMany({ where: { tournamentId } }),
      this.prisma.teamPlayer.deleteMany({ where: { tournamentId } }),
      this.prisma.team.deleteMany({ where: { tournamentId } }),
      this.prisma.tournament.delete({ where: { id: tournamentId } }),
    ]);

    return { deleted: true };
  }

  // D-021: closes the dangling "cancel it instead" promise from D-017 -
  // this is that cancel. Called off for real, not a Secretary's typo to
  // undo (that's still deleteTournament, while fixtures don't exist
  // yet). Every match that isn't already completed/cancelled is
  // cancelled too, and any pending/approved venue booking tied to one of
  // them is freed - no auto-reschedule-search, unlike a single match
  // cancellation (FR-009): the tournament is over, not just disrupted.
  async cancelTournament(
    callerId: string,
    tournamentId: string,
    dto: CancelTournamentDto,
  ) {
    const tournament = await this.tournamentForSecretaryOrThrow(
      callerId,
      tournamentId,
    );
    if (
      tournament.status === 'cancelled' ||
      tournament.status === 'completed'
    ) {
      throw new ConflictException(
        `This tournament is already ${tournament.status}.`,
      );
    }

    const openMatches = await this.prisma.match.findMany({
      where: { tournamentId, status: { notIn: ['completed', 'cancelled'] } },
      select: { id: true },
    });
    const matchIds = openMatches.map((m) => m.id);

    await this.prisma.$transaction([
      this.prisma.match.updateMany({
        where: { id: { in: matchIds } },
        data: { status: 'cancelled', cancellationReason: dto.reason },
      }),
      this.prisma.venueBooking.updateMany({
        where: {
          matchId: { in: matchIds },
          status: { in: ['pending', 'approved'] },
        },
        data: { status: 'rejected', decidedAt: new Date() },
      }),
      this.prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: 'cancelled', cancellationReason: dto.reason },
      }),
    ]);

    return { cancelled: true };
  }

  // D-022: a tournament is "completed" once every one of its matches is
  // in a terminal state (completed or cancelled) AND at least one of
  // them was actually completed - not just a tournament where every
  // match got called off, which is cancelTournament's job instead. The
  // `status: { notIn: [...] }` guard stops this from ever overwriting a
  // tournament the Secretary already explicitly cancelled. Public and
  // generic (not "if all matches are byes") so every caller that can
  // move a match into a terminal state - cancelling one (FR-009) or
  // recording its result (FR-010) - can call the exact same check.
  async maybeCompleteTournament(tournamentId: string) {
    const matches = await this.prisma.match.findMany({
      where: { tournamentId },
      select: { status: true },
    });
    const allTerminal = matches.every(
      (m) => m.status === 'completed' || m.status === 'cancelled',
    );
    const anyCompleted = matches.some((m) => m.status === 'completed');
    if (allTerminal && anyCompleted) {
      await this.prisma.tournament.updateMany({
        where: {
          id: tournamentId,
          status: { notIn: ['cancelled', 'completed'] },
        },
        data: { status: 'completed' },
      });
    }
  }
}
