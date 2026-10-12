import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TournamentController } from './tournament.controller';
import { TournamentService } from './tournament.service';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { FixtureController } from './fixture.controller';
import { FixtureService } from './fixture.service';

// FR-005 (Tournament creation) + FR-006 (Team & player registration) +
// FR-007 (Fixture generation) - the "Tournament & Registration" module
// from docs/system-architecture.md (Tournament, Team, TeamPlayer,
// Match). AuthModule is imported (not just referenced) so
// JwtAuthGuard's JwtService dependency resolves, same as HostelModule.
@Module({
  imports: [AuthModule],
  controllers: [TournamentController, TeamController, FixtureController],
  providers: [TournamentService, TeamService, FixtureService],
  // FR-009's Scheduling module needs the "is this caller the Secretary
  // of this tournament's hostel" check - exported so it can inject
  // TournamentService directly instead of duplicating that logic.
  // FixtureService is exported too so FR-010's ResultsModule can call
  // advanceWinner after a result comes in, instead of duplicating the
  // bracket-progression math.
  exports: [TournamentService, FixtureService],
})
export class TournamentModule {}
