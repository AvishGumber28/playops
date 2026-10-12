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
import { ConflictService } from './conflict.service';

// FR-009: on-demand conflict scanning for a tournament's schedule.
@Controller()
export class ConflictController {
  constructor(private readonly conflictService: ConflictService) {}

  private requireUserId(req: AuthenticatedRequest): string {
    if (!req.userId) {
      throw new UnauthorizedException('Missing authorization token.');
    }
    return req.userId;
  }

  @Post('tournaments/:tournamentId/conflicts/check')
  @UseGuards(JwtAuthGuard)
  check(
    @Req() req: AuthenticatedRequest,
    @Param('tournamentId') tournamentId: string,
  ) {
    return this.conflictService.checkTournament(
      this.requireUserId(req),
      tournamentId,
    );
  }

  @Get('tournaments/:tournamentId/conflicts')
  @UseGuards(JwtAuthGuard)
  list(
    @Req() req: AuthenticatedRequest,
    @Param('tournamentId') tournamentId: string,
  ) {
    return this.conflictService.getConflicts(
      this.requireUserId(req),
      tournamentId,
    );
  }
}
