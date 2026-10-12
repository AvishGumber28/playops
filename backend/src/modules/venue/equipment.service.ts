import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEquipmentItemDto } from './dto/create-equipment-item.dto';
import { UpdateEquipmentItemDto } from './dto/update-equipment-item.dto';
import { RequestEquipmentDto } from './dto/request-equipment.dto';

const BOOKING_SELECT = {
  id: true,
  equipmentId: true,
  quantityRequested: true,
  status: true,
  createdAt: true,
  equipment: { select: { id: true, name: true } },
  requestedBy: { select: { id: true, name: true } },
} as const;

type RawBooking = {
  id: string;
  equipmentId: string;
  quantityRequested: number;
  status: string;
  createdAt: Date;
  equipment: { id: string; name: string };
  requestedBy: { id: string; name: string } | null;
};

// FR-008 (Venue & Booking module, per docs/system-architecture.md) - the
// equipment half. Mirrors the reviewed frontend mock 1:1 (see D-019):
// both Student and Secretary submit a pending request; nothing touches
// stock until the Sports Department approves it; availableQuantity is a
// maintained column, not computed from bookings.
@Injectable()
export class EquipmentService {
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

  // "student" or "secretary" - whichever this caller resolves to
  // (FR-002/D-006: computed from relationships, never stored). Also
  // confirms they have a hostel at all, same gate FR-006 uses.
  private async requesterRole(
    callerId: string,
  ): Promise<'student' | 'secretary'> {
    const user = await this.prisma.user.findUnique({
      where: { id: callerId },
      select: { hostelId: true },
    });
    if (!user?.hostelId) {
      throw new BadRequestException(
        'Select a hostel before requesting equipment.',
      );
    }
    const secretaryHostel = await this.prisma.hostel.findFirst({
      where: { sportsSecretaryUserId: callerId },
      select: { id: true },
    });
    return secretaryHostel ? 'secretary' : 'student';
  }

  // Batched role lookup for a list of bookings, avoiding one hostel
  // query per row.
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
      itemId: booking.equipmentId,
      item: booking.equipment,
      quantity: booking.quantityRequested,
      status: booking.status,
      requestedBy: booking.requestedBy,
      requestedByRole: booking.requestedBy
        ? (roles.get(booking.requestedBy.id) ?? 'student')
        : 'student',
      createdAt: booking.createdAt,
    };
  }

  listItems() {
    return this.prisma.equipment.findMany({ orderBy: { name: 'asc' } });
  }

  async addItem(callerId: string, dto: CreateEquipmentItemDto) {
    await this.adminOrThrow(callerId);
    return this.prisma.equipment.create({
      data: {
        name: dto.name,
        totalQuantity: dto.totalQuantity,
        availableQuantity: dto.totalQuantity,
      },
    });
  }

  // D-019: renaming, or correcting the count (damaged/lost/found gear).
  // The quantity currently checked out stays untouched; only the
  // un-booked portion moves.
  async updateItem(
    callerId: string,
    itemId: string,
    dto: UpdateEquipmentItemDto,
  ) {
    await this.adminOrThrow(callerId);
    const item = await this.prisma.equipment.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new NotFoundException('Item not found.');

    const inUse = item.totalQuantity - item.availableQuantity;
    if (dto.totalQuantity < inUse) {
      throw new ConflictException(
        `Can't set the total below ${inUse} - that many are currently checked out.`,
      );
    }
    return this.prisma.equipment.update({
      where: { id: itemId },
      data: {
        name: dto.name,
        totalQuantity: dto.totalQuantity,
        availableQuantity: dto.totalQuantity - inUse,
      },
    });
  }

  async deleteItem(callerId: string, itemId: string) {
    await this.adminOrThrow(callerId);
    const item = await this.prisma.equipment.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new NotFoundException('Item not found.');

    const inPlay = await this.prisma.equipmentBooking.count({
      where: {
        equipmentId: itemId,
        status: { in: ['pending', 'checked_out'] },
      },
    });
    if (inPlay > 0) {
      throw new ConflictException(
        `Can't delete ${item.name} - ${inPlay} request(s) still reference it (pending or checked out).`,
      );
    }
    // Only settled history (returned/rejected) can remain at this point
    // - the guard above already promises those don't block deletion, but
    // the FK (ON DELETE RESTRICT, so a real deleted item's history can
    // never accidentally dangle onto some *other* item) still requires
    // those rows gone first. Clear them in the same transaction as the
    // delete itself.
    await this.prisma.$transaction([
      this.prisma.equipmentBooking.deleteMany({
        where: { equipmentId: itemId },
      }),
      this.prisma.equipment.delete({ where: { id: itemId } }),
    ]);
    return { deleted: true };
  }

  async requestBooking(
    callerId: string,
    itemId: string,
    dto: RequestEquipmentDto,
  ) {
    const role = await this.requesterRole(callerId);
    const item = await this.prisma.equipment.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new NotFoundException('Item not found.');
    if (dto.quantity > item.availableQuantity) {
      throw new ConflictException(
        `Only ${item.availableQuantity} available right now.`,
      );
    }

    const created = await this.prisma.equipmentBooking.create({
      data: {
        equipmentId: itemId,
        quantityRequested: dto.quantity,
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
    const bookings = await this.prisma.equipmentBooking.findMany({
      where: { requestedById: callerId },
      orderBy: { createdAt: 'desc' },
      select: BOOKING_SELECT,
    });
    const roles = await this.rolesFor([callerId]);
    return bookings.map((b) => this.formatBooking(b, roles));
  }

  async listAllBookings(callerId: string) {
    await this.adminOrThrow(callerId);
    const bookings = await this.prisma.equipmentBooking.findMany({
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

  async approve(callerId: string, bookingId: string) {
    await this.adminOrThrow(callerId);
    const booking = await this.prisma.equipmentBooking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Request not found.');
    const item = await this.prisma.equipment.findUnique({
      where: { id: booking.equipmentId },
    });
    if (!item) throw new NotFoundException('Item not found.');
    if (booking.quantityRequested > item.availableQuantity) {
      throw new ConflictException(
        `Only ${item.availableQuantity} available now - can't approve ${booking.quantityRequested}.`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.equipment.update({
        where: { id: item.id },
        data: { availableQuantity: { decrement: booking.quantityRequested } },
      }),
      this.prisma.equipmentBooking.update({
        where: { id: bookingId },
        data: {
          status: 'checked_out',
          approvedById: callerId,
          decidedAt: new Date(),
        },
      }),
    ]);
    return { approved: true };
  }

  async reject(callerId: string, bookingId: string) {
    await this.adminOrThrow(callerId);
    const booking = await this.prisma.equipmentBooking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Request not found.');
    await this.prisma.equipmentBooking.update({
      where: { id: bookingId },
      data: {
        status: 'rejected',
        approvedById: callerId,
        decidedAt: new Date(),
      },
    });
    return { rejected: true };
  }

  async markReturned(callerId: string, bookingId: string) {
    await this.adminOrThrow(callerId);
    const booking = await this.prisma.equipmentBooking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found.');

    await this.prisma.$transaction([
      this.prisma.equipment.update({
        where: { id: booking.equipmentId },
        data: { availableQuantity: { increment: booking.quantityRequested } },
      }),
      this.prisma.equipmentBooking.update({
        where: { id: bookingId },
        data: { status: 'returned' },
      }),
    ]);
    return { returned: true };
  }
}
