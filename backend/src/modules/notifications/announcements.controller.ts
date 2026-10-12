import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

// FR-012: Sports Secretary posts for their own hostel, or one of their
// own tournaments.
@Controller()
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  private requireUserId(req: AuthenticatedRequest): string {
    if (!req.userId) {
      throw new UnauthorizedException('Missing authorization token.');
    }
    return req.userId;
  }

  @Post('announcements')
  @UseGuards(JwtAuthGuard)
  postAnnouncement(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.announcementsService.postAnnouncement(
      this.requireUserId(req),
      dto,
    );
  }

  @Get('announcements/mine')
  @UseGuards(JwtAuthGuard)
  listMyAnnouncements(@Req() req: AuthenticatedRequest) {
    return this.announcementsService.listMyAnnouncements(
      this.requireUserId(req),
    );
  }

  // D-029: a full retraction - deletes the fanned-out Notification rows too.
  @Delete('announcements/:announcementId')
  @UseGuards(JwtAuthGuard)
  deleteAnnouncement(
    @Req() req: AuthenticatedRequest,
    @Param('announcementId') announcementId: string,
  ) {
    return this.announcementsService.deleteAnnouncement(
      this.requireUserId(req),
      announcementId,
    );
  }
}
