import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TournamentModule } from '../tournament/tournament.module';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';
import { StandingsController } from './standings.controller';
import { StandingsService } from './standings.service';

// FR-010 (Match Results & Scorecards) + FR-011 (Standings) - the
// "Results & Standings" module from docs/system-architecture.md (Match,
// Scorecard). Standings is computed on demand from the same completed-
// Match rows FR-010 produces - no new data stored (D-027). Imports
// TournamentModule for the same Secretary-of-this-tournament check and
// maybeCompleteTournament (D-022) every other per-match module already
// reuses, rather than duplicating either - StandingsService doesn't need
// it (FR-011 is open to any authenticated user, no ownership check).
@Module({
  imports: [AuthModule, TournamentModule],
  controllers: [ResultsController, StandingsController],
  providers: [ResultsService, StandingsService],
})
export class ResultsModule {}
