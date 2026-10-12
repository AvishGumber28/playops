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
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { CancelTournamentDto } from './dto/cancel-tournament.dto';
import { TournamentService } from './tournament.service';

@Controller()
export class TournamentController {
  constructor(private readonly tournamentService: TournamentService) {}

  private requireUserId(req: AuthenticatedRequest): string {
    if (!req.userId) {
      throw new UnauthorizedException('Missing authorization token.');
    }
    return req.userId;
  }

  // Reference data for the tournament-creation form's sport dropdown.
  @Get('sports')
  @UseGuards(JwtAuthGuard)
  listSports() {
    return this.tournamentService.listSports();
  }

  // FR-005: Sports Secretary creates a tournament for their own hostel.
  @Post('tournaments')
  @UseGuards(JwtAuthGuard)
  createTournament(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateTournamentDto,
  ) {
    return this.tournamentService.createTournament(
      this.requireUserId(req),
      dto,
    );
  }

  @Get('tournaments/mine')
  @UseGuards(JwtAuthGuard)
  listMyTournaments(@Req() req: AuthenticatedRequest) {
    return this.tournamentService.listMyHostelTournaments(
      this.requireUserId(req),
    );
  }

  // D-025: the Caretaker's read-only view of their own hostel's tournaments.
  @Get('tournaments/caretaker')
  @UseGuards(JwtAuthGuard)
  listForCaretaker(@Req() req: AuthenticatedRequest) {
    return this.tournamentService.listTournamentsForCaretaker(
      this.requireUserId(req),
    );
  }

  // FR-006: a student's view - the tournaments of their own hostel, each
  // with whether they're already on a team.
  @Get('tournaments')
  @UseGuards(JwtAuthGuard)
  listForMyHostel(@Req() req: AuthenticatedRequest) {
    return this.tournamentService.listTournamentsForMyHostel(
      this.requireUserId(req),
    );
  }

  // FR-006 completion / D-016: the Secretary sees the teams registered
  // for one of their tournaments.
  @Get('tournaments/:tournamentId/teams')
  @UseGuards(JwtAuthGuard)
  listTournamentTeams(
    @Req() req: AuthenticatedRequest,
    @Param('tournamentId') tournamentId: string,
  ) {
    return this.tournamentService.listTournamentTeams(
      this.requireUserId(req),
      tournamentId,
    );
  }

  // D-017: Secretary deletes their own tournament (blocked once fixtures
  // exist).
  @Delete('tournaments/:tournamentId')
  @UseGuards(JwtAuthGuard)
  deleteTournament(
    @Req() req: AuthenticatedRequest,
    @Param('tournamentId') tournamentId: string,
  ) {
    return this.tournamentService.deleteTournament(
      this.requireUserId(req),
      tournamentId,
    );
  }

  // D-021: Secretary calls off a tournament that already has fixtures -
  // the "cancel it instead" that D-017's delete guard always pointed at.
  @Post('tournaments/:tournamentId/cancel')
  @UseGuards(JwtAuthGuard)
  cancelTournament(
    @Req() req: AuthenticatedRequest,
    @Param('tournamentId') tournamentId: string,
    @Body() dto: CancelTournamentDto,
  ) {
    return this.tournamentService.cancelTournament(
      this.requireUserId(req),
      tournamentId,
      dto,
    );
  }
}
