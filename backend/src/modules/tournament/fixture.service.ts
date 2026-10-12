import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Match } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TournamentService } from './tournament.service';
import { SwapTeamsDto } from './dto/swap-teams.dto';

type SlotField = 'teamAId' | 'teamBId';

// FR-007: generates the Match schedule from a tournament's approved
// teams (D-016 - rejected teams are never scheduled), then lets the
// Secretary manually rearrange it before anyone plays. See
// decision-log.md D-018 for the seeding/round-robin algorithms and why
// manual swap was pulled forward from FR-007's Should-Have.
@Injectable()
export class FixtureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tournamentService: TournamentService,
  ) {}

  // FR-010: propagates a knockout match's winner into its Round+1 slot -
  // the exact progression a bye already gets at fixture-generation time
  // (buildKnockout's own bye-resolution loop below uses the identical
  // round+1/ceil(matchNumber/2)/odd-even-slot formula, kept separate
  // there since it already has the freshly-created matches in memory).
  // League has no such progression - every round's pairings are fixed up
  // front regardless of results - so this is a no-op there. A draw
  // (winnerTeamId null) never advances anyone; the Secretary places the
  // advancing team manually via the existing drag-swap (D-018) once
  // decided out-of-band (there's no penalty-shootout/replay model here).
  async advanceWinner(
    tournamentId: string,
    round: number,
    matchNumber: number,
    winnerTeamId: string | null,
  ) {
    if (!winnerTeamId) return;

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { format: true },
    });
    if (tournament?.format !== 'knockout') return;

    const nextMatch = await this.prisma.match.findFirst({
      where: {
        tournamentId,
        round: round + 1,
        matchNumber: Math.ceil(matchNumber / 2),
      },
    });
    if (!nextMatch) return; // this was the final

    const slot: SlotField = matchNumber % 2 === 1 ? 'teamAId' : 'teamBId';
    await this.prisma.match.update({
      where: { id: nextMatch.id },
      data: { [slot]: winnerTeamId },
    });
  }

  // ---- knockout: standard single-elimination bracket seeding ----

  private nextPowerOfTwo(n: number): number {
    let size = 1;
    while (size < n) size *= 2;
    return size;
  }

  // The standard bracket seeding order for `size` slots - 1 vs size, 2
  // vs size-1, ... built recursively so the top seeds land on opposite
  // halves and byes (seed numbers past the real team count) fall to
  // them first.
  private seedOrder(size: number): number[] {
    if (size === 1) return [1];
    const prev = this.seedOrder(size / 2);
    const order: number[] = [];
    for (const seed of prev) {
      order.push(seed, size + 1 - seed);
    }
    return order;
  }

  private async buildKnockout(tournamentId: string, teamIds: string[]) {
    const size = this.nextPowerOfTwo(teamIds.length);
    const totalRounds = Math.log2(size);
    const order = this.seedOrder(size);
    // seed N (1-indexed) -> team, or null past the real team count (a bye)
    const teamForSeed = (seed: number) => teamIds[seed - 1] ?? null;

    const plan: {
      round: number;
      matchNumber: number;
      teamAId: string | null;
      teamBId: string | null;
    }[] = [];
    for (let i = 0; i < order.length; i += 2) {
      plan.push({
        round: 1,
        matchNumber: i / 2 + 1,
        teamAId: teamForSeed(order[i]),
        teamBId: teamForSeed(order[i + 1]),
      });
    }
    for (let round = 2; round <= totalRounds; round++) {
      const count = size / 2 ** round;
      for (let matchNumber = 1; matchNumber <= count; matchNumber++) {
        plan.push({ round, matchNumber, teamAId: null, teamBId: null });
      }
    }

    const created = await this.prisma.$transaction(
      plan.map((m) =>
        this.prisma.match.create({
          data: {
            tournamentId,
            round: m.round,
            matchNumber: m.matchNumber,
            teamAId: m.teamAId,
            teamBId: m.teamBId,
          },
        }),
      ),
    );

    // A bye (round 1, exactly one side filled) resolves immediately and
    // feeds straight into Round 2 - the only round a bye can ever
    // originate in (D-018: every Round 1 pair has at most one bye by
    // construction, so a single hop is enough - no cascading needed).
    if (totalRounds >= 2) {
      const round1 = created.filter((m) => m.round === 1);
      for (const match of round1) {
        const isBye = Boolean(match.teamAId) !== Boolean(match.teamBId);
        if (!isBye) continue;

        const winnerTeamId = (match.teamAId ?? match.teamBId) as string;
        await this.prisma.match.update({
          where: { id: match.id },
          data: { status: 'completed', winnerTeamId },
        });

        const nextMatch = created.find(
          (m) =>
            m.round === 2 && m.matchNumber === Math.ceil(match.matchNumber / 2),
        );
        if (nextMatch) {
          const slot: SlotField =
            match.matchNumber % 2 === 1 ? 'teamAId' : 'teamBId';
          await this.prisma.match.update({
            where: { id: nextMatch.id },
            data: { [slot]: winnerTeamId },
          });
        }
      }
    }
  }

  // ---- league: circle-method round-robin ----

  private async buildLeague(tournamentId: string, teamIds: string[]) {
    const seats: (string | null)[] = [...teamIds];
    if (seats.length % 2 === 1) seats.push(null); // one bye seat per round when odd
    const totalRounds = seats.length - 1;
    const half = seats.length / 2;

    const plan: {
      round: number;
      matchNumber: number;
      teamAId: string;
      teamBId: string;
    }[] = [];
    let arr = seats;
    for (let round = 1; round <= totalRounds; round++) {
      let matchNumber = 1;
      for (let i = 0; i < half; i++) {
        const a = arr[i];
        const b = arr[arr.length - 1 - i];
        if (a && b) {
          plan.push({ round, matchNumber, teamAId: a, teamBId: b });
          matchNumber++;
        }
      }
      // Fix seat 0, rotate everyone else by one - the classic
      // round-robin scheduling rotation.
      const [fixed, ...rest] = arr;
      rest.unshift(rest.pop() as string | null);
      arr = [fixed, ...rest];
    }

    await this.prisma.$transaction(
      plan.map((m) =>
        this.prisma.match.create({
          data: {
            tournamentId,
            round: m.round,
            matchNumber: m.matchNumber,
            teamAId: m.teamAId,
            teamBId: m.teamBId,
          },
        }),
      ),
    );
  }

  async generateFixtures(callerId: string, tournamentId: string) {
    const tournament =
      await this.tournamentService.tournamentForSecretaryOrThrow(
        callerId,
        tournamentId,
      );
    if (tournament.status !== 'registration_open') {
      throw new ConflictException(
        'Fixtures can only be generated while registration is open.',
      );
    }

    const existing = await this.prisma.match.count({ where: { tournamentId } });
    if (existing > 0) {
      throw new ConflictException(
        'Fixtures already exist for this tournament.',
      );
    }

    const teams = await this.prisma.team.findMany({
      where: { tournamentId, registrationStatus: 'approved' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (teams.length < 2) {
      throw new BadRequestException(
        'At least 2 approved teams are needed to generate fixtures.',
      );
    }
    const teamIds = teams.map((t) => t.id);

    if (tournament.format === 'league') {
      await this.buildLeague(tournamentId, teamIds);
    } else {
      await this.buildKnockout(tournamentId, teamIds);
    }

    await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: 'in_progress' },
    });

    return this.listFixtures(callerId, tournamentId);
  }

  // D-030: broadened from Secretary-only to "Secretary of this
  // tournament's hostel, OR any student with a TeamPlayer row in it
  // (any team, any registration status)" - a student whose team got
  // rejected can still see the schedule; they just won't be in it.
  // Falls through to the participant check only on a ForbiddenException
  // from the Secretary check - a genuinely missing tournament still
  // surfaces as NotFoundException either way.
  private async secretaryOrParticipantOrThrow(
    callerId: string,
    tournamentId: string,
  ) {
    try {
      await this.tournamentService.tournamentForSecretaryOrThrow(
        callerId,
        tournamentId,
      );
      return;
    } catch (err) {
      if (!(err instanceof ForbiddenException)) throw err;
    }

    const membership = await this.prisma.teamPlayer.findFirst({
      where: { tournamentId, userId: callerId },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException(
        "You don't have access to this tournament's fixtures.",
      );
    }
  }

  async listFixtures(callerId: string, tournamentId: string) {
    await this.secretaryOrParticipantOrThrow(callerId, tournamentId);

    const matches = await this.prisma.match.findMany({
      where: { tournamentId },
      orderBy: [{ round: 'asc' }, { matchNumber: 'asc' }],
      select: {
        id: true,
        round: true,
        matchNumber: true,
        status: true,
        winnerTeamId: true,
        // FR-009: when/where this match is scheduled (null until a
        // match-scheduling venue request for it gets approved - see
        // VenueService.approve()) and why it's cancelled, if it is.
        scheduledDate: true,
        scheduledTime: true,
        cancellationReason: true,
        teamA: { select: { id: true, name: true } },
        teamB: { select: { id: true, name: true } },
        // The raw booking, separate from scheduledDate/scheduledTime
        // above (which only ever reflects an *approved* booking). Lets
        // the frontend surface a still-pending request - including the
        // auto-suggested reschedule after a cancellation - instead of
        // that only ever living in a toast that's gone a few seconds
        // after it fires.
        venueBooking: {
          select: {
            status: true,
            date: true,
            startTime: true,
            endTime: true,
            venue: { select: { name: true } },
          },
        },
      },
    });

    const formatted = matches.map((m) => {
      const { venueBooking, ...rest } = m;
      return {
        ...rest,
        scheduledDate: m.scheduledDate
          ? m.scheduledDate.toISOString().slice(0, 10)
          : null,
        pendingBooking:
          venueBooking && venueBooking.status === 'pending'
            ? {
                venueName: venueBooking.venue.name,
                date: venueBooking.date.toISOString().slice(0, 10),
                hour: `${venueBooking.startTime}-${venueBooking.endTime}`,
              }
            : null,
      };
    });

    const byRound = new Map<number, typeof formatted>();
    for (const match of formatted) {
      const list = byRound.get(match.round) ?? [];
      list.push(match);
      byRound.set(match.round, list);
    }

    return {
      tournamentId,
      rounds: [...byRound.entries()]
        .sort(([a], [b]) => a - b)
        .map(([round, roundMatches]) => ({ round, matches: roundMatches })),
    };
  }

  // D-018: the drag-and-drop swap. Only touches matches that haven't
  // been decided yet (a bye or a played match is locked).
  async swapTeams(callerId: string, tournamentId: string, dto: SwapTeamsDto) {
    await this.tournamentService.tournamentForSecretaryOrThrow(
      callerId,
      tournamentId,
    );

    const [matchA, matchB] = await Promise.all([
      this.prisma.match.findUnique({ where: { id: dto.matchAId } }),
      this.prisma.match.findUnique({ where: { id: dto.matchBId } }),
    ]);
    if (!matchA || matchA.tournamentId !== tournamentId) {
      throw new NotFoundException('Match not found in this tournament.');
    }
    if (!matchB || matchB.tournamentId !== tournamentId) {
      throw new NotFoundException('Match not found in this tournament.');
    }
    if (matchA.status !== 'scheduled' || matchB.status !== 'scheduled') {
      throw new ConflictException(
        'A bye or an already-decided match cannot be rearranged.',
      );
    }

    const fieldOf = (slot: 'teamA' | 'teamB'): SlotField =>
      slot === 'teamA' ? 'teamAId' : 'teamBId';
    const fieldA = fieldOf(dto.slotA);
    const fieldB = fieldOf(dto.slotB);

    if (dto.matchAId === dto.matchBId) {
      if (fieldA === fieldB) {
        return this.listFixtures(callerId, tournamentId); // no-op
      }
      // Swapping the two slots within the same match.
      await this.prisma.match.update({
        where: { id: matchA.id },
        data: { teamAId: matchA.teamBId, teamBId: matchA.teamAId },
      });
      return this.listFixtures(callerId, tournamentId);
    }

    const valueA: Match[SlotField] = matchA[fieldA];
    const valueB: Match[SlotField] = matchB[fieldB];
    const otherFieldA: SlotField = fieldA === 'teamAId' ? 'teamBId' : 'teamAId';
    const otherFieldB: SlotField = fieldB === 'teamAId' ? 'teamBId' : 'teamAId';

    // A team can't end up facing itself in either match after the swap.
    if (valueB && valueB === matchA[otherFieldA]) {
      throw new ConflictException('A team cannot play itself.');
    }
    if (valueA && valueA === matchB[otherFieldB]) {
      throw new ConflictException('A team cannot play itself.');
    }

    await this.prisma.$transaction([
      this.prisma.match.update({
        where: { id: matchA.id },
        data: { [fieldA]: valueB },
      }),
      this.prisma.match.update({
        where: { id: matchB.id },
        data: { [fieldB]: valueA },
      }),
    ]);

    return this.listFixtures(callerId, tournamentId);
  }
}
