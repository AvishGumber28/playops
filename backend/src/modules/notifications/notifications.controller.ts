import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { NotificationsService } from './notifications.service';
import { MatchReminderService } from './match-reminder.service';

// FR-012: any authenticated user reads and acknowledges their own
// notifications only - scoped delivery means scoped reading too.
@Controller()
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly matchReminderService: MatchReminderService,
  ) {}

  private requireUserId(req: AuthenticatedRequest): string {
    if (!req.userId) {
      throw new UnauthorizedException('Missing authorization token.');
    }
    return req.userId;
  }

  @Get('notifications')
  @UseGuards(JwtAuthGuard)
  listMine(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.listMine(this.requireUserId(req));
  }

  @Post('notifications/:notificationId/read')
  @UseGuards(JwtAuthGuard)
  markRead(
    @Req() req: AuthenticatedRequest,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.markRead(
      this.requireUserId(req),
      notificationId,
    );
  }

  // D-030: normally runs on its own at 09:00 daily (MatchReminderService's
  // own @Cron) - this is a manual trigger, both as a resilience fallback
  // (the daily run was missed) and the only practical way to verify the
  // feature without waiting a full day. Idempotent either way.
  @Post('notifications/send-match-reminders')
  @UseGuards(JwtAuthGuard)
  sendMatchReminders() {
    return this.matchReminderService.sendMatchDayReminders();
  }
}
