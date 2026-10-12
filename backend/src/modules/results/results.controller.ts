import {
  Body,
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
import { ResultsService } from './results.service';
import { SubmitScorecardDto } from './dto/submit-scorecard.dto';

// FR-010: entering and reading back a match's result.
@Controller()
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  private requireUserId(req: AuthenticatedRequest): string {
    if (!req.userId) {
      throw new UnauthorizedException('Missing authorization token.');
    }
    return req.userId;
  }

  @Post('matches/:matchId/scorecard')
  @UseGuards(JwtAuthGuard)
  submitScorecard(
    @Req() req: AuthenticatedRequest,
    @Param('matchId') matchId: string,
    @Body() dto: SubmitScorecardDto,
  ) {
    return this.resultsService.submitScorecard(
      this.requireUserId(req),
      matchId,
      dto,
    );
  }

  @Get('matches/:matchId/scorecard')
  @UseGuards(JwtAuthGuard)
  getScorecard(
    @Req() req: AuthenticatedRequest,
    @Param('matchId') matchId: string,
  ) {
    return this.resultsService.getScorecard(this.requireUserId(req), matchId);
  }
}
