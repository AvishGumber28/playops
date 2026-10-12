import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TournamentService } from '../tournament/tournament.service';
import { FixtureService } from '../tournament/fixture.service';
import { SubmitScorecardDto } from './dto/submit-scorecard.dto';
import { SCORECARD_TEMPLATES } from './scorecard-templates';

// FR-010 (Results module) - the Secretary's post-match result entry.
// Submitting a scorecard is what actually marks a Match `completed` with
// a `winnerTeamId` - until this, the only ways a match ever reached
// `completed` were a bye (FR-007) or the auto-complete side effect of
// cancelling every other match (D-022). Both reading and writing a
// scorecard are gated the same way the Fixtures view already is -
// Secretary of that match's tournament only (there's no student-facing
// fixtures view yet either - an existing gap, not something this slice
// changes).
@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tournamentService: TournamentService,
    private readonly fixtureService: FixtureService,
  ) {}

  private async matchForSecretaryOrThrow(callerId: string, matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });
    if (!match) throw new NotFoundException('Match not found.');
    await this.tournamentService.tournamentForSecretaryOrThrow(
      callerId,
      match.tournamentId,
    );
    return match;
  }

  async submitScorecard(
    callerId: string,
    matchId: string,
    dto: SubmitScorecardDto,
  ) {
    const match = await this.matchForSecretaryOrThrow(callerId, matchId);

    if (!match.teamAId || !match.teamBId) {
      throw new ConflictException(
        'Both teams must be set before a result can be entered.',
      );
    }
    if (match.status === 'completed') {
      throw new ConflictException('This match already has a result.');
    }
    if (match.status === 'cancelled') {
      throw new ConflictException(
        "A cancelled match can't have a result entered.",
      );
    }

    const existing = await this.prisma.scorecard.findUnique({
      where: { matchId },
    });
    if (existing) {
      throw new ConflictException('This match already has a result.');
    }

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: match.tournamentId },
      select: { sportId: true, sport: { select: { scorecardTemplate: true } } },
    });
    const template = tournament
      ? SCORECARD_TEMPLATES[tournament.sport.scorecardTemplate]
      : undefined;
    if (!tournament || !template) {
      throw new BadRequestException(
        'No scorecard template is configured for this sport.',
      );
    }

    if (dto.winnerTeamId === null) {
      if (!template.allowDraw) {
        throw new BadRequestException('A draw is not allowed for this sport.');
      }
    } else if (
      dto.winnerTeamId !== match.teamAId &&
      dto.winnerTeamId !== match.teamBId
    ) {
      throw new BadRequestException(
        'winnerTeamId must be one of the two teams in this match, or null for a draw.',
      );
    }

    for (const field of template.fields) {
      const value = dto.data[field];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new BadRequestException(
          `"${field}" must be a non-negative number.`,
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.scorecard.create({
        data: {
          matchId,
          sportId: tournament.sportId,
          data: dto.data,
          enteredById: callerId,
        },
      }),
      this.prisma.match.update({
        where: { id: matchId },
        data: { status: 'completed', winnerTeamId: dto.winnerTeamId },
      }),
    ]);

    // FR-010: this is what makes a knockout bracket actually progress -
    // the same slot a bye fills in at generation time, now filled by a
    // real result. A no-op for a league tournament or a draw.
    await this.fixtureService.advanceWinner(
      match.tournamentId,
      match.round,
      match.matchNumber,
      dto.winnerTeamId,
    );
    await this.tournamentService.maybeCompleteTournament(match.tournamentId);

    return this.getScorecard(callerId, matchId);
  }

  async getScorecard(callerId: string, matchId: string) {
    const match = await this.matchForSecretaryOrThrow(callerId, matchId);
    const scorecard = await this.prisma.scorecard.findUnique({
      where: { matchId },
      select: {
        id: true,
        data: true,
        enteredAt: true,
        enteredBy: { select: { id: true, name: true } },
        sport: { select: { id: true, name: true } },
      },
    });
    if (!scorecard) {
      throw new NotFoundException(
        'No result has been recorded for this match yet.',
      );
    }
    return {
      ...scorecard,
      matchId,
      winnerTeamId: match.winnerTeamId,
    };
  }
}
