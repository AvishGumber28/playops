import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type StandingsRow = {
  teamId: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
};

const POINTS = { win: 3, draw: 1, loss: 0 };

// FR-011 (Standings) - the other half of the "Results & Standings"
// module (system-architecture.md). Computed fresh on every request from
// Scorecard-derived Match results, never stored (D-027) - a stored table
// could drift out of sync with the results it's meant to summarize.
// Read-only and open to any authenticated user, unlike every other
// tournament endpoint (D-025 onward) - the FR-011 spec explicitly scopes
// this to "viewed by all authenticated users", not Secretary/hostel-only.
@Injectable()
export class StandingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStandings(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, format: true },
    });
    if (!tournament) throw new NotFoundException('Tournament not found.');
    if (tournament.format !== 'league') {
      throw new BadRequestException(
        'Standings are only available for league tournaments.',
      );
    }

    // D-016: only approved teams ever appear in fixtures - standings
    // mirrors that, and every approved team gets a row even at 0 played.
    const teams = await this.prisma.team.findMany({
      where: { tournamentId, registrationStatus: 'approved' },
      select: { id: true, name: true },
    });

    const matches = await this.prisma.match.findMany({
      where: { tournamentId, status: 'completed' },
      select: { teamAId: true, teamBId: true, winnerTeamId: true },
    });

    const table = new Map<string, StandingsRow>(
      teams.map((t) => [
        t.id,
        {
          teamId: t.id,
          name: t.name,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          points: 0,
        },
      ]),
    );

    for (const m of matches) {
      if (!m.teamAId || !m.teamBId) continue; // a bye never reaches this - defensive only
      const a = table.get(m.teamAId);
      const b = table.get(m.teamBId);
      if (!a || !b) continue; // a team no longer approved - excluded, same as fixtures

      a.played++;
      b.played++;
      if (m.winnerTeamId === null) {
        a.drawn++;
        b.drawn++;
        a.points += POINTS.draw;
        b.points += POINTS.draw;
      } else if (m.winnerTeamId === m.teamAId) {
        a.won++;
        a.points += POINTS.win;
        b.lost++;
      } else {
        b.won++;
        b.points += POINTS.win;
        a.lost++;
      }
    }

    // D-005: no tie-break in v1 - equal-points teams are co-ranked, not
    // artificially ordered apart from each other.
    const sorted = [...table.values()].sort((x, y) => y.points - x.points);
    let rank = 0;
    let lastPoints: number | null = null;
    const standings = sorted.map((row, i) => {
      if (row.points !== lastPoints) {
        rank = i + 1;
        lastPoints = row.points;
      }
      return { rank, ...row };
    });

    return { tournamentId, standings };
  }
}
