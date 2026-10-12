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
import { SwapTeamsDto } from './dto/swap-teams.dto';
import { FixtureService } from './fixture.service';

// FR-007: fixture generation + manual rearrangement (decision-log.md D-018).
@Controller()
export class FixtureController {
  constructor(private readonly fixtureService: FixtureService) {}

  private requireUserId(req: AuthenticatedRequest): string {
    if (!req.userId) {
      throw new UnauthorizedException('Missing authorization token.');
    }
    return req.userId;
  }

  @Post('tournaments/:tournamentId/fixtures')
  @UseGuards(JwtAuthGuard)
  generateFixtures(
    @Req() req: AuthenticatedRequest,
    @Param('tournamentId') tournamentId: string,
  ) {
    return this.fixtureService.generateFixtures(
      this.requireUserId(req),
      tournamentId,
    );
  }

  @Get('tournaments/:tournamentId/fixtures')
  @UseGuards(JwtAuthGuard)
  listFixtures(
    @Req() req: AuthenticatedRequest,
    @Param('tournamentId') tournamentId: string,
  ) {
    return this.fixtureService.listFixtures(
      this.requireUserId(req),
      tournamentId,
    );
  }

  @Post('tournaments/:tournamentId/fixtures/swap')
  @UseGuards(JwtAuthGuard)
  swapTeams(
    @Req() req: AuthenticatedRequest,
    @Param('tournamentId') tournamentId: string,
    @Body() dto: SwapTeamsDto,
  ) {
    return this.fixtureService.swapTeams(
      this.requireUserId(req),
      tournamentId,
      dto,
    );
  }
}
