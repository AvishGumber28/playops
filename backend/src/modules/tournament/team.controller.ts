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
import { CreateTeamDto } from './dto/create-team.dto';
import { AddPlayerDto } from './dto/add-player.dto';
import { TeamService } from './team.service';

@Controller()
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  private requireUserId(req: AuthenticatedRequest): string {
    if (!req.userId) {
      throw new UnauthorizedException('Missing authorization token.');
    }
    return req.userId;
  }

  // FR-006: any student registers a team for a tournament in their own
  // hostel, becoming its captain.
  @Post('tournaments/:tournamentId/teams')
  @UseGuards(JwtAuthGuard)
  createTeam(
    @Req() req: AuthenticatedRequest,
    @Param('tournamentId') tournamentId: string,
    @Body() dto: CreateTeamDto,
  ) {
    return this.teamService.createTeam(
      this.requireUserId(req),
      tournamentId,
      dto,
    );
  }

  @Get('teams/:teamId')
  @UseGuards(JwtAuthGuard)
  getTeam(@Param('teamId') teamId: string) {
    return this.teamService.getTeam(teamId);
  }

  @Post('teams/:teamId/players')
  @UseGuards(JwtAuthGuard)
  addPlayer(
    @Req() req: AuthenticatedRequest,
    @Param('teamId') teamId: string,
    @Body() dto: AddPlayerDto,
  ) {
    return this.teamService.addPlayer(this.requireUserId(req), teamId, dto);
  }

  @Delete('teams/:teamId/players/:userId')
  @UseGuards(JwtAuthGuard)
  removePlayer(
    @Req() req: AuthenticatedRequest,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
  ) {
    return this.teamService.removePlayer(
      this.requireUserId(req),
      teamId,
      userId,
    );
  }

  // D-016 (resolves Q-007): the tournament's Secretary approves or
  // rejects a registered team. Reversible.
  @Post('teams/:teamId/approve')
  @UseGuards(JwtAuthGuard)
  approveTeam(
    @Req() req: AuthenticatedRequest,
    @Param('teamId') teamId: string,
  ) {
    return this.teamService.setRegistrationStatus(
      this.requireUserId(req),
      teamId,
      'approved',
    );
  }

  @Post('teams/:teamId/reject')
  @UseGuards(JwtAuthGuard)
  rejectTeam(
    @Req() req: AuthenticatedRequest,
    @Param('teamId') teamId: string,
  ) {
    return this.teamService.setRegistrationStatus(
      this.requireUserId(req),
      teamId,
      'rejected',
    );
  }
}
