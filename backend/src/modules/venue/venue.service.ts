import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestVenueDto } from './dto/request-venue.dto';
import { splitHour } from './venue.constants';

const BOOKING_SELECT = {
  id: true,
  date: true,
  startTime: true,
  endTime: true,
  status: true,
  createdAt: true,
  venue: { select: { id: true, name: true } },
  requestedBy: { select: { id: true, name: true } },
} as const;

type RawBooking = {
  id: string;
  date: Date;
  startTime: string | null;
  endTime: string | null;
  status: string;
  createdAt: Date;
  venue: { id: string; name: string };
  requestedBy: { id: string; name: string } | null;
};

// Postgres unique-violation code, for the partial unique index backstop
// (business rule 3) - see the D-019 migration.
const UNIQUE_VIOLATION = 'P2002';

// FR-008 (Venue & Booking module) - the venue half. Mirrors the
// reviewed frontend mock 1:1 (see D-019): a slot only ever shows
// Booked/Available (pending requests never change that), and approving
// one request auto-rejects every other still-pending request for that
// exact slot.
@Injectable()
export class VenueService {
  constructor(private readonly prisma: PrismaService) {}

  private async adminOrThrow(callerId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: callerId },
      select: { isSportsAdmin: true },
    });
    if (!user?.isSportsAdmin) {
      throw new ForbiddenException('Only the Sports Department can do this.');
    }
  }

  private async requesterRole(
    callerId: string,
  ): Promise<'student' | 'secretary'> {
    const user = await this.prisma.user.findUnique({
      where: { id: callerId },
      select: { hostelId: true },
    });
    if (!user?.hostelId) {
      throw new BadRequestException(
        'Select a hostel before requesting a venue.',
      );
    }
    const secretaryHostel = await this.prisma.hostel.findFirst({
      where: { sportsSecretaryUserId: callerId },
      select: { id: true },
    });
    return secretaryHostel ? 'secretary' : 'student';
  }

  private async rolesFor(
    userIds: string[],
  ): Promise<Map<string, 'student' | 'secretary'>> {
    if (userIds.length === 0) return new Map();
    const secretaries = await this.prisma.hostel.findMany({
      where: { sportsSecretaryUserId: { in: userIds } },
      select: { sportsSecretaryUserId: true },
    });
    const secretaryIds = new Set(
      secretaries.map((h) => h.sportsSecretaryUserId),
    );
    return new Map(
      userIds.map((id) => [id, secretaryIds.has(id) ? 'secretary' : 'student']),
    );
  }

  private formatBooking(
    booking: RawBooking,
    roles: Map<string, 'student' | 'secretary'>,
  ) {
    return {
      id: booking.id,
      venueId: booking.venue.id,
      venue: booking.venue,
      date: booking.date.toISOString().slice(0, 10),
      hour: `${booking.startTime}-${booking.endTime}`,
      status: booking.status,
      requestedBy: booking.requestedBy,
      requestedByRole: booking.requestedBy
        ? (roles.get(booking.requestedBy.id) ?? 'student')
        : 'student',
      createdAt: booking.createdAt,
    };
  }

  listVenues() {
    return this.prisma.venue.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  async requestBooking(
    callerId: string,
    venueId: string,
    dto: RequestVenueDto,
  ) {
    const role = await this.requesterRole(callerId);
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
    });
    if (!venue) throw new NotFoundException('Venue not found.');

    const [startTime, endTime] = splitHour(dto.hour);
    const date = new Date(dto.date);

    const alreadyApproved = await this.prisma.venueBooking.findFirst({
      where: { venueId, date, startTime, endTime, status: 'approved' },
    });
    if (alreadyApproved) {
      throw new ConflictException('This slot is already booked.');
    }
    const alreadyMine = await this.prisma.venueBooking.findFirst({
      where: {
        venueId,
        date,
        startTime,
        endTime,
        status: 'pending',
        requestedById: callerId,
      },
    });
    if (alreadyMine) {
      throw new ConflictException(
        'You already have a pending request for this slot.',
      );
    }

    const created = await this.prisma.venueBooking.create({
      data: {
        venueId,
        date,
        startTime,
        endTime,
        requestedById: callerId,
        status: 'pending',
        source: role === 'secretary' ? 'secretary_request' : 'student_request',
      },
      select: BOOKING_SELECT,
    });
    const roles = await this.rolesFor([callerId]);
    return this.formatBooking(created, roles);
  }

  async listMyBookings(callerId: string) {
    const bookings = await this.prisma.venueBooking.findMany({
      where: { requestedById: callerId },
      orderBy: { createdAt: 'desc' },
      select: BOOKING_SELECT,
    });
    const roles = await this.rolesFor([callerId]);
    return bookings.map((b) => this.formatBooking(b, roles));
  }

  // Deliberately NOT admin-gated (unlike Equipment's equivalent) - the
  // Student/Secretary slot grid needs to know whether *any* slot is
  // Booked, which means seeing every approved booking, not just the
  // caller's own. Matches the reviewed frontend mock's actual behavior:
  // it never restricted this data, it just chose not to render other
  // people's names on the requester-facing grid.
  async listAllBookings() {
    const bookings = await this.prisma.venueBooking.findMany({
      orderBy: { createdAt: 'desc' },
      select: BOOKING_SELECT,
    });
    const ids = [
      ...new Set(
        bookings
          .map((b) => b.requestedBy?.id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const roles = await this.rolesFor(ids);
    return bookings.map((b) => this.formatBooking(b, roles));
  }

  // Approves this request and, in the same transaction, auto-rejects
  // every other still-pending request for the exact same slot - no
  // separate "slot taken, please reject" step. The partial unique index
  // (D-019 migration) is the real backstop against a genuine race
  // between two concurrent approvals; a violation surfaces here as a
  // friendly conflict instead of a raw 500.
  async approve(callerId: string, bookingId: string) {
    await this.adminOrThrow(callerId);
    const booking = await this.prisma.venueBooking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Request not found.');

    const conflicting = await this.prisma.venueBooking.findFirst({
      where: {
        id: { not: bookingId },
        venueId: booking.venueId,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: 'approved',
      },
    });
    if (conflicting) {
      throw new ConflictException(
        'That slot was already approved for someone else.',
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.venueBooking.update({
          where: { id: bookingId },
          data: {
            status: 'approved',
            approvedById: callerId,
            decidedAt: new Date(),
          },
        });
        await tx.venueBooking.updateMany({
          where: {
            id: { not: bookingId },
            venueId: booking.venueId,
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            status: 'pending',
          },
          data: {
            status: 'rejected',
            approvedById: callerId,
            decidedAt: new Date(),
          },
        });
        // FR-009: this booking is for a specific fixture match (not an
        // ad-hoc personal/team request) - the Match itself is the
        // authoritative "when/where does this match happen" record the
        // Conflict Engine and the Fixtures view both read, so it has to
        // move in lockstep with the booking that just got approved.
        // Unconditionally setting status back to 'scheduled' is what
        // actually makes a cancel-then-auto-reschedule recoverable: this
        // approval is just as often "the match's auto-suggested
        // replacement slot was just confirmed" as it is "the match's
        // first-ever slot was confirmed" - a `cancelled` match shouldn't
        // stay cancelled once a real replacement is locked in, and this
        // is a no-op for a match that was never cancelled.
        if (booking.matchId) {
          await tx.match.update({
            where: { id: booking.matchId },
            data: {
              scheduledDate: booking.date,
              scheduledTime: booking.startTime,
              status: 'scheduled',
              cancellationReason: null,
            },
          });
        }
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === UNIQUE_VIOLATION
      ) {
        throw new ConflictException(
          'That slot was just approved for someone else.',
        );
      }
      throw err;
    }
    return { approved: true };
  }

  async reject(callerId: string, bookingId: string) {
    await this.adminOrThrow(callerId);
    const booking = await this.prisma.venueBooking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Request not found.');
    await this.prisma.venueBooking.update({
      where: { id: bookingId },
      data: {
        status: 'rejected',
        approvedById: callerId,
        decidedAt: new Date(),
      },
    });
    return { rejected: true };
  }
}
