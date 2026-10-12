import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { MatchSchedulingService } from './match-scheduling.service';
import { ScheduleMatchDto } from './dto/schedule-match.dto';
import { CancelMatchDto } from './dto/cancel-match.dto';

// FR-009: assigning a venue+date+time to a fixture match, and cancelling
// one (with an automatic reschedule search).
@Controller()
export class MatchSchedulingController {
  constructor(
    private readonly matchSchedulingService: MatchSchedulingService,
  ) {}

  private requireUserId(req: AuthenticatedRequest): string {
    if (!req.userId) {
      throw new UnauthorizedException('Missing authorization token.');
    }
    return req.userId;
  }

  @Post('matches/:matchId/schedule')
  @UseGuards(JwtAuthGuard)
  scheduleMatch(
    @Req() req: AuthenticatedRequest,
    @Param('matchId') matchId: string,
    @Body() dto: ScheduleMatchDto,
  ) {
    return this.matchSchedulingService.scheduleMatch(
      this.requireUserId(req),
      matchId,
      dto,
    );
  }

  @Post('matches/:matchId/cancel')
  @UseGuards(JwtAuthGuard)
  cancelMatch(
    @Req() req: AuthenticatedRequest,
    @Param('matchId') matchId: string,
    @Body() dto: CancelMatchDto,
  ) {
    return this.matchSchedulingService.cancelMatch(
      this.requireUserId(req),
      matchId,
      dto,
    );
  }
}
