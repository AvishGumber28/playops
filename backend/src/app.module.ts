import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
    ConfigModule.forRoot({ isGlobal: true }),
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
  providers: [],
})
export class AppModule {}
