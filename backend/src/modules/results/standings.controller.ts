import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StandingsService } from './standings.service';

// FR-011: unlike every other tournament endpoint, this is open to any
// authenticated user - no Secretary/hostel ownership check, matching the
// spec's own "viewed by all authenticated users" (D-027).
@Controller()
export class StandingsController {
  constructor(private readonly standingsService: StandingsService) {}

  @Get('tournaments/:tournamentId/standings')
  @UseGuards(JwtAuthGuard)
  getStandings(@Param('tournamentId') tournamentId: string) {
    return this.standingsService.getStandings(tournamentId);
  }
}
