import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

// FR-012 (Announcements & Notifications module, system-architecture.md).
// Posting an announcement fans out a Notification row to every relevant
// user in one transaction - delivery is always scoped (business rule):
// hostel-wide by default, or narrowed to one tournament's registered
// (approved, D-016) teams when the Secretary picks one. No college-wide
// broadcast capability exists - nothing in the spec grants anyone that,
// only "their own hostel/tournament".
@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  private async secretaryHostelOrThrow(callerId: string) {
    const hostel = await this.prisma.hostel.findFirst({
      where: { sportsSecretaryUserId: callerId },
      select: { id: true },
    });
    if (!hostel) {
      throw new ForbiddenException('Only a Sports Secretary can do this.');
    }
    return hostel;
  }

  async postAnnouncement(callerId: string, dto: CreateAnnouncementDto) {
    const hostel = await this.secretaryHostelOrThrow(callerId);

    let tournamentId: string | null = null;
    let recipientUserIds: string[];

    if (dto.tournamentId) {
      const tournament = await this.prisma.tournament.findUnique({
        where: { id: dto.tournamentId },
        select: { id: true, hostelId: true },
      });
      if (!tournament) throw new NotFoundException('Tournament not found.');
      if (tournament.hostelId !== hostel.id) {
        throw new ForbiddenException(
          "You are not this tournament's Sports Secretary.",
        );
      }
      tournamentId = tournament.id;

      const players = await this.prisma.teamPlayer.findMany({
        where: { tournamentId, team: { registrationStatus: 'approved' } },
        select: { userId: true },
      });
      recipientUserIds = [...new Set(players.map((p) => p.userId))];
    } else {
      const residents = await this.prisma.user.findMany({
        where: { hostelId: hostel.id },
        select: { id: true },
      });
      recipientUserIds = residents.map((u) => u.id);
    }

    const announcement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.announcement.create({
        data: {
          hostelId: hostel.id,
          tournamentId,
          title: dto.title,
          body: dto.body,
          createdById: callerId,
        },
      });
      if (recipientUserIds.length > 0) {
        await tx.notification.createMany({
          data: recipientUserIds.map((userId) => ({
            userId,
            announcementId: created.id,
            message: dto.title,
          })),
        });
      }
      return created;
    });

    return { ...announcement, recipientCount: recipientUserIds.length };
  }

  async listMyAnnouncements(callerId: string) {
    const hostel = await this.secretaryHostelOrThrow(callerId);
    return this.prisma.announcement.findMany({
      where: { hostelId: hostel.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  // D-029: a full retraction - deletes the Notification rows it fanned
  // out too (not just the Announcement, which the schema's own FK would
  // otherwise leave as orphaned, title-only notifications via its ON
  // DELETE SET NULL). Posted "by mistake" should mean gone, not
  // half-visible.
  async deleteAnnouncement(callerId: string, announcementId: string) {
    const hostel = await this.secretaryHostelOrThrow(callerId);
    const announcement = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
    });
    if (!announcement) throw new NotFoundException('Announcement not found.');
    if (announcement.hostelId !== hostel.id) {
      throw new ForbiddenException(
        "You can only delete your own hostel's announcements.",
      );
    }

    await this.prisma.$transaction([
      this.prisma.notification.deleteMany({ where: { announcementId } }),
      this.prisma.announcement.delete({ where: { id: announcementId } }),
    ]);

    return { deleted: true };
  }
}
