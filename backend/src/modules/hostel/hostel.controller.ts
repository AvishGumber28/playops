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
import { SelectHostelDto } from './dto/select-hostel.dto';
import { AppointByEmailDto } from './dto/appoint-by-email.dto';
import { RequestHostelChangeDto } from './dto/request-hostel-change.dto';
import { HostelService } from './hostel.service';

@Controller('hostels')
export class HostelController {
  constructor(private readonly hostelService: HostelService) {}

  // JwtAuthGuard always sets req.userId before a guarded handler runs -
  // the ? on AuthenticatedRequest.userId just reflects that TypeScript
  // can't see across the guard boundary. Centralized here since every
  // guarded handler below needs the same check.
  private requireUserId(req: AuthenticatedRequest): string {
    if (!req.userId) {
      throw new UnauthorizedException('Missing authorization token.');
    }
    return req.userId;
  }

  // Public list - a student picking a hostel for the first time needs to
  // see the options before they're authenticated-and-hostel-less, and
  // there's nothing sensitive in a hostel's id/code/name.
  @Get()
  async listHostels() {
    return this.hostelService.listHostels();
  }

  // Who currently holds each of the four appointed positions (Sports
  // Secretary, and the three D-011 additions) - any authenticated user can
  // view, matching "View current Secretary: Y" in roles-permissions.md.
  @Get(':hostelId')
  @UseGuards(JwtAuthGuard)
  async getHostelDetail(@Param('hostelId') hostelId: string) {
    return this.hostelService.getHostelDetail(hostelId);
  }

  @Post('select')
  @UseGuards(JwtAuthGuard)
  async selectHostel(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SelectHostelDto,
  ) {
    return this.hostelService.selectHostel(
      this.requireUserId(req),
      dto.hostelId,
    );
  }

  // FR-004: Caretaker appoints their hostel's Sports Secretary.
  @Post(':hostelId/secretary')
  @UseGuards(JwtAuthGuard)
  async appointSecretary(
    @Req() req: AuthenticatedRequest,
    @Param('hostelId') hostelId: string,
    @Body() dto: AppointByEmailDto,
  ) {
    return this.hostelService.appointSecretary(
      this.requireUserId(req),
      hostelId,
      dto.email,
    );
  }

  // D-011: same mechanism as Secretary above, but appointing these never
  // changes the appointee's dashboard - administrative record-keeping only.
  @Post(':hostelId/proctor')
  @UseGuards(JwtAuthGuard)
  async appointProctor(
    @Req() req: AuthenticatedRequest,
    @Param('hostelId') hostelId: string,
    @Body() dto: AppointByEmailDto,
  ) {
    return this.hostelService.appointProctor(
      this.requireUserId(req),
      hostelId,
      dto.email,
    );
  }

  @Post(':hostelId/gym-secretary')
  @UseGuards(JwtAuthGuard)
  async appointGymSecretary(
    @Req() req: AuthenticatedRequest,
    @Param('hostelId') hostelId: string,
    @Body() dto: AppointByEmailDto,
  ) {
    return this.hostelService.appointGymSecretary(
      this.requireUserId(req),
      hostelId,
      dto.email,
    );
  }

  @Post(':hostelId/mess-secretary')
  @UseGuards(JwtAuthGuard)
  async appointMessSecretary(
    @Req() req: AuthenticatedRequest,
    @Param('hostelId') hostelId: string,
    @Body() dto: AppointByEmailDto,
  ) {
    return this.hostelService.appointMessSecretary(
      this.requireUserId(req),
      hostelId,
      dto.email,
    );
  }

  // FR-003's change flow. These are all literal multi-segment paths under
  // 'change-requests' (never a single ':hostelId'-shaped segment), so
  // there's no route-matching ambiguity with getHostelDetail above.
  @Post('change-requests')
  @UseGuards(JwtAuthGuard)
  async requestHostelChange(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RequestHostelChangeDto,
  ) {
    return this.hostelService.requestHostelChange(
      this.requireUserId(req),
      dto.requestedHostelId,
    );
  }

  // A student's own dashboard checks this to show "pending: request to
  // switch to X" instead of blindly re-showing the request form.
  //
  // Wrapped in { pending } rather than returned bare: NestJS treats a
  // controller returning `null` the same as `undefined` and sends an
  // EMPTY body (Content-Length: 0), not the JSON literal `null` - so a
  // client's `res.json()` throws on "no request yet" and can't tell it
  // apart from a real failure. Wrapping in an object that's always
  // present, with only the inner value nullable, sidesteps that.
  @Get('change-requests/mine')
  @UseGuards(JwtAuthGuard)
  async getMyChangeRequest(@Req() req: AuthenticatedRequest) {
    const pending = await this.hostelService.getMyPendingChangeRequest(
      this.requireUserId(req),
    );
    return { pending };
  }

  // A Caretaker's approval queue - scoped server-side to their own hostel
  // as the CURRENT (releasing) hostel of each requester, not the requested
  // one (business rule 9 / D-005).
  @Get('change-requests/pending')
  @UseGuards(JwtAuthGuard)
  async getPendingChangeRequests(@Req() req: AuthenticatedRequest) {
    return this.hostelService.listPendingChangeRequestsForCaretaker(
      this.requireUserId(req),
    );
  }

  @Post('change-requests/:id/approve')
  @UseGuards(JwtAuthGuard)
  async approveChangeRequest(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.hostelService.approveChangeRequest(this.requireUserId(req), id);
  }

  @Post('change-requests/:id/reject')
  @UseGuards(JwtAuthGuard)
  async rejectChangeRequest(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.hostelService.rejectChangeRequest(this.requireUserId(req), id);
  }
}
