import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TournamentModule } from '../tournament/tournament.module';
import { MatchSchedulingController } from './match-scheduling.controller';
import { MatchSchedulingService } from './match-scheduling.service';
import { ConflictController } from './conflict.controller';
import { ConflictService } from './conflict.service';

// FR-009 - the "Scheduling & Conflict Engine" module from
// docs/system-architecture.md (ConflictLog), kept as its own module so
// it can be built/tested/evaluated independently of the modules that
// feed it data - per that doc's own note on why. It reads data
// Tournament & Registration owns (fixtures, teams), so it imports that
// module directly rather than going through the API layer a second
// time (same process, no network hop - the architecture doc's own
// cross-module-call guidance). It does NOT import VenueModule - it only
// needs PrismaService (global) and venue.constants' plain exported
// helpers, no VenueService injection, so importing that module isn't
// needed and would just be extra surface area.
@Module({
  imports: [AuthModule, TournamentModule],
  controllers: [MatchSchedulingController, ConflictController],
  providers: [MatchSchedulingService, ConflictService],
})
export class SchedulingModule {}
