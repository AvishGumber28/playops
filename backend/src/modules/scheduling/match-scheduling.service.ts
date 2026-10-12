import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TournamentService } from '../tournament/tournament.service';
import { SLOT_HOURS, splitHour } from '../venue/venue.constants';
import { ScheduleMatchDto } from './dto/schedule-match.dto';
import { CancelMatchDto } from './dto/cancel-match.dto';

const RESCHEDULE_WINDOW_DAYS = 30;

// FR-009 (Scheduling & Conflict Engine module) - the half that actually
// assigns a venue+date+time to a fixture match. FR-007 only builds who-
// plays-who; nothing was ever scheduled until this. A match's venue
// slot reuses VenueBooking exactly like an ad-hoc FR-008 request (same
// Admin-approval endpoints) - except VenueBooking.matchId is @unique,
// so a match's booking is always upserted (one row per match, ever),
// never freshly inserted on a second attempt. That's also what makes
// "try a different slot after a rejection" and "auto-reschedule after a
// cancellation" the exact same operation as the first scheduling
// attempt - all three just move that one row to a new venue/date/time
// and reset it to pending.
@Injectable()
export class MatchSchedulingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tournamentService: TournamentService,
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

  private formatBooking(booking: {
    id: string;
    date: Date;
    startTime: string;
    endTime: string;
    status: string;
    venue: { id: string; name: string };
  }) {
    return {
      id: booking.id,
      venueId: booking.venue.id,
      venue: booking.venue,
      date: booking.date.toISOString().slice(0, 10),
      hour: `${booking.startTime}-${booking.endTime}`,
      status: booking.status,
    };
  }

  async scheduleMatch(
    callerId: string,
    matchId: string,
    dto: ScheduleMatchDto,
  ) {
    const match = await this.matchForSecretaryOrThrow(callerId, matchId);
    if (match.status === 'completed') {
      throw new ConflictException("A completed match can't be (re)scheduled.");
    }

    const venue = await this.prisma.venue.findUnique({
      where: { id: dto.venueId },
    });
    if (!venue) throw new NotFoundException('Venue not found.');

    const [startTime, endTime] = splitHour(dto.hour);
    const date = new Date(dto.date);

    const alreadyApproved = await this.prisma.venueBooking.findFirst({
      where: {
        venueId: dto.venueId,
        date,
        startTime,
        endTime,
        status: 'approved',
        matchId: { not: matchId },
      },
    });
    if (alreadyApproved) {
      throw new ConflictException('This slot is already booked.');
    }

    const booking = await this.prisma.venueBooking.upsert({
      where: { matchId },
      create: {
        venueId: dto.venueId,
        date,
        startTime,
        endTime,
        matchId,
        tournamentId: match.tournamentId,
        requestedById: callerId,
        status: 'pending',
        source: 'secretary_request',
      },
      update: {
        venueId: dto.venueId,
        date,
        startTime,
        endTime,
        requestedById: callerId,
        status: 'pending',
        approvedById: null,
        decidedAt: null,
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        venue: { select: { id: true, name: true } },
      },
    });

    return this.formatBooking(booking);
  }

  // Cancels the match, frees its current slot (if it had an approved
  // one), and searches for the next open slot at the same venue -
  // submitted as a new pending request through the normal approval flow
  // (D-020), never auto-booked. No alternative found within the search
  // window is surfaced in the response, not silently dropped.
  async cancelMatch(callerId: string, matchId: string, dto: CancelMatchDto) {
    const match = await this.matchForSecretaryOrThrow(callerId, matchId);
    if (match.status === 'completed') {
      throw new ConflictException("A completed match can't be cancelled.");
    }
    if (match.status === 'cancelled') {
      throw new ConflictException('This match is already cancelled.');
    }

    const existingBooking = await this.prisma.venueBooking.findUnique({
      where: { matchId },
    });

    await this.prisma.match.update({
      where: { id: matchId },
      data: { status: 'cancelled', cancellationReason: dto.reason },
    });

    await this.prisma.conflictLog.create({
      data: {
        type: 'venue',
        tournamentId: match.tournamentId,
        matchId,
        resolution: 'unresolved',
      },
    });

    // D-022: cancelling the last still-open match can be what actually
    // finishes a tournament - there's no "record a result" feature yet
    // (FR-010), so every match reaching completed/cancelled is currently
    // only reachable via byes (auto-completed at fixture generation) and
    // this cancel path.
    await this.tournamentService.maybeCompleteTournament(match.tournamentId);

    if (!existingBooking || existingBooking.status !== 'approved') {
      // Nothing was actually locked in for this match - nothing to
      // search a replacement for.
      return {
        cancelled: true,
        rescheduled: null,
        message: 'Match cancelled.',
      };
    }

    // Free the old slot immediately.
    await this.prisma.venueBooking.update({
      where: { matchId },
      data: { status: 'rejected', decidedAt: new Date() },
    });

    const alternative = await this.findAlternativeSlot(
      existingBooking.venueId,
      existingBooking.date,
    );
    if (!alternative) {
      return {
        cancelled: true,
        rescheduled: null,
        message: `Match cancelled. No alternative slot was found at that venue in the next ${RESCHEDULE_WINDOW_DAYS} days - reschedule manually.`,
      };
    }

    const rescheduled = await this.prisma.venueBooking.update({
      where: { matchId },
      data: {
        venueId: alternative.venueId,
        date: alternative.date,
        startTime: alternative.startTime,
        endTime: alternative.endTime,
        status: 'pending',
        requestedById: callerId,
        approvedById: null,
        decidedAt: null,
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        venue: { select: { id: true, name: true } },
      },
    });

    await this.prisma.conflictLog.updateMany({
      where: { matchId, type: 'venue', resolution: 'unresolved' },
      data: { resolution: 'auto_suggested', resolvedAt: new Date() },
    });

    const formatted = this.formatBooking(rescheduled);
    return {
      cancelled: true,
      rescheduled: formatted,
      message: `Match cancelled. Suggested ${formatted.venue.name}, ${formatted.hour} on ${formatted.date} - awaiting Sports Department approval.`,
    };
  }

  // Fetches every APPROVED booking at this venue within the search
  // window in one query, then scans forward day-by-day through the
  // fixed slot grid for the first one not already taken.
  private async findAlternativeSlot(venueId: string, fromDate: Date) {
    const windowEnd = new Date(fromDate);
    windowEnd.setDate(windowEnd.getDate() + RESCHEDULE_WINDOW_DAYS);

    const taken = await this.prisma.venueBooking.findMany({
      where: {
        venueId,
        status: 'approved',
        date: { gt: fromDate, lte: windowEnd },
      },
      select: { date: true, startTime: true },
    });
    const takenSet = new Set(
      taken.map((t) => `${t.date.toISOString().slice(0, 10)}|${t.startTime}`),
    );

    for (let offset = 1; offset <= RESCHEDULE_WINDOW_DAYS; offset++) {
      const candidateDate = new Date(fromDate);
      candidateDate.setDate(candidateDate.getDate() + offset);
      const dateKey = candidateDate.toISOString().slice(0, 10);
      for (const hour of SLOT_HOURS) {
        const [startTime, endTime] = splitHour(hour);
        if (!takenSet.has(`${dateKey}|${startTime}`)) {
          return { venueId, date: candidateDate, startTime, endTime };
        }
      }
    }
    return null;
  }
}
