import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

// D-030: notifies every player on both teams (not just captains) the
// day before their match - the one use `Notification.matchId` was
// scaffolded for (Phase 4) but never populated until now. Runs hourly,
// not once daily - a match approved for tomorrow at, say, 2pm today
// would otherwise never get picked up by a single fixed daily run
// (today's already passed; tomorrow's run checks for matches dated the
// day *after* tomorrow, which this one no longer is by then). Hourly
// means any match freshly approved for "tomorrow" is caught within the
// hour regardless of when during the day that happens. The logic is a
// plain callable method so it can also be triggered manually (POST
// /api/notifications/send-match-reminders) - useful as an instant
// fallback, and the only practical way to verify this feature without
// waiting for the next tick.
@Injectable()
export class MatchReminderService {
  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sendMatchDayRemindersCron() {
    await this.sendMatchDayReminders();
  }

  async sendMatchDayReminders() {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);

    const matches = await this.prisma.match.findMany({
      where: {
        status: 'scheduled',
        scheduledDate: tomorrow,
        teamAId: { not: null },
        teamBId: { not: null },
      },
      select: {
        id: true,
        round: true,
        matchNumber: true,
        scheduledTime: true,
        teamAId: true,
        teamBId: true,
      },
    });

    let matchesNotified = 0;
    let notificationsSent = 0;

    for (const match of matches) {
      // Idempotent: a match's reminder is only ever sent once - this
      // also protects against the cron firing twice in the same day
      // (e.g. a server restart) re-notifying everyone.
      const alreadySent = await this.prisma.notification.findFirst({
        where: { matchId: match.id },
        select: { id: true },
      });
      if (alreadySent) continue;

      const players = await this.prisma.teamPlayer.findMany({
        where: {
          teamId: { in: [match.teamAId as string, match.teamBId as string] },
        },
        select: { userId: true },
      });
      const userIds = [...new Set(players.map((p) => p.userId))];
      if (userIds.length === 0) continue;

      await this.prisma.notification.createMany({
        data: userIds.map((userId) => ({
          userId,
          matchId: match.id,
          message: `Your match (Round ${match.round}, Match ${match.matchNumber}) is scheduled for tomorrow at ${match.scheduledTime}.`,
        })),
      });

      matchesNotified++;
      notificationsSent += userIds.length;
    }

    return { matchesNotified, notificationsSent };
  }
}
