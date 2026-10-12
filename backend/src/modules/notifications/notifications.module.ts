import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { MatchReminderService } from './match-reminder.service';

// FR-012 (Announcements & Notifications module, system-architecture.md -
// Announcement, Notification). No TournamentModule import needed -
// AnnouncementsService checks "is this tournament the caller's own
// hostel's" directly via Prisma (a one-line comparison), rather than
// pulling in TournamentService for it. MatchReminderService (D-030)
// needs no module import either - it queries Match/TeamPlayer directly.
@Module({
  imports: [AuthModule],
  controllers: [AnnouncementsController, NotificationsController],
  providers: [AnnouncementsService, NotificationsService, MatchReminderService],
})
export class NotificationsModule {}
