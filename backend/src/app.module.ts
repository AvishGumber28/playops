import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { HostelModule } from './modules/hostel/hostel.module';
import { TournamentModule } from './modules/tournament/tournament.module';
import { VenueModule } from './modules/venue/venue.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { ResultsModule } from './modules/results/results.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    // e2e tests set NODE_ENV=test and load .env.test (a separate database -
    // see test/jest-e2e.setup.ts) instead of the real dev .env.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
    }),
    // D-030: match-day reminders (NotificationsModule's MatchReminderService).
    ScheduleModule.forRoot(),
    // Phase 12: a generous global rate limit (per IP) as a baseline
    // against abuse, with auth.controller.ts layering a much stricter
    // limit on top for signup/login specifically (the actual brute-force/
    // credential-stuffing surface). skipIf disables this entirely under
    // Jest (NODE_ENV=test, set by Jest itself before any test file loads -
    // same signal this file's own ConfigModule.forRoot below already
    // relies on) - the e2e suite legitimately creates far more accounts
    // per minute from one source than any real client would.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    PrismaModule,
    AuthModule,
    HostelModule,
    TournamentModule,
    VenueModule,
    SchedulingModule,
    ResultsModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
