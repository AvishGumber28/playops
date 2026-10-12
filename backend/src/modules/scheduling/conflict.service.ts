import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TournamentService } from '../tournament/tournament.service';

type ScannedMatch = {
  id: string;
  round: number;
  matchNumber: number;
  teamAId: string | null;
  teamBId: string | null;
  scheduledDate: Date | null;
  scheduledTime: string | null;
  venueBooking: { venueId: string } | null;
};

type MatchBrief = {
  id: string;
  round: number;
  matchNumber: number;
  date: string | null;
  hour: string | null;
};

type ConflictEntry = {
  type: 'team' | 'venue';
  message: string;
  matches: MatchBrief[];
};

// FR-009 (Scheduling & Conflict Engine module) - the core technical
// contribution. Venue double-booking is already prevented structurally
// (the partial unique index from D-019), so the genuinely new check
// here is TEAM clashes - the same team scheduled into two matches at
// once, which nothing else in the system stops. The venue check is kept
// too, defensively/for completeness, even though it should never
// actually fire once bookings are only ever approved one at a time.
//
// D-020: player clashes across *different* tournaments and rest-time
// constraints are out of v1 scope (Should-Have) - this only looks
// within one tournament's own schedule.
@Injectable()
export class ConflictService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tournamentService: TournamentService,
  ) {}

  private brief(m: ScannedMatch): MatchBrief {
    return {
      id: m.id,
      round: m.round,
      matchNumber: m.matchNumber,
      date: m.scheduledDate ? m.scheduledDate.toISOString().slice(0, 10) : null,
      hour: m.scheduledTime,
    };
  }

  // Re-runs the full scan for this tournament, replacing whatever
  // `unresolved` ConflictLog rows the last run left behind (so repeated
  // checks don't pile up stale duplicates) and returning a display-ready
  // summary.
  async checkTournament(
    callerId: string,
    tournamentId: string,
  ): Promise<{ conflicts: ConflictEntry[] }> {
    await this.tournamentService.tournamentForSecretaryOrThrow(
      callerId,
      tournamentId,
    );

    const matches = await this.prisma.match.findMany({
      where: {
        tournamentId,
        status: { notIn: ['cancelled'] },
        scheduledDate: { not: null },
        scheduledTime: { not: null },
        teamAId: { not: null },
        teamBId: { not: null },
      },
      select: {
        id: true,
        round: true,
        matchNumber: true,
        teamAId: true,
        teamBId: true,
        scheduledDate: true,
        scheduledTime: true,
        venueBooking: { select: { venueId: true } },
      },
    });

    const conflicts: ConflictEntry[] = [];
    const toLog: { type: 'team' | 'venue'; matchId: string }[] = [];

    for (let i = 0; i < matches.length; i++) {
      for (let j = i + 1; j < matches.length; j++) {
        const a = matches[i];
        const b = matches[j];
        const sameSlot =
          a.scheduledDate?.getTime() === b.scheduledDate?.getTime() &&
          a.scheduledTime === b.scheduledTime;
        if (!sameSlot) continue;

        const teamsA = [a.teamAId, a.teamBId];
        const teamsB = [b.teamAId, b.teamBId];
        const sharedTeamId = teamsA.find((t) => t && teamsB.includes(t));
        if (sharedTeamId) {
          conflicts.push({
            type: 'team',
            message: `The same team is scheduled for two matches at the same time (Round ${a.round} Match ${a.matchNumber} and Round ${b.round} Match ${b.matchNumber}).`,
            matches: [this.brief(a), this.brief(b)],
          });
          toLog.push(
            { type: 'team', matchId: a.id },
            { type: 'team', matchId: b.id },
          );
        }

        if (
          a.venueBooking &&
          b.venueBooking &&
          a.venueBooking.venueId === b.venueBooking.venueId
        ) {
          conflicts.push({
            type: 'venue',
            message: `Two matches are both scheduled at the same venue and time (Round ${a.round} Match ${a.matchNumber} and Round ${b.round} Match ${b.matchNumber}).`,
            matches: [this.brief(a), this.brief(b)],
          });
          toLog.push(
            { type: 'venue', matchId: a.id },
            { type: 'venue', matchId: b.id },
          );
        }
      }
    }

    await this.prisma.conflictLog.deleteMany({
      where: { tournamentId, resolution: 'unresolved' },
    });
    if (toLog.length > 0) {
      await this.prisma.conflictLog.createMany({
        data: toLog.map((c) => ({
          type: c.type,
          tournamentId,
          matchId: c.matchId,
          resolution: 'unresolved',
        })),
      });
    }

    return { conflicts };
  }

  async getConflicts(callerId: string, tournamentId: string) {
    await this.tournamentService.tournamentForSecretaryOrThrow(
      callerId,
      tournamentId,
    );
    return this.prisma.conflictLog.findMany({
      where: { tournamentId },
      orderBy: { detectedAt: 'desc' },
    });
  }
}
