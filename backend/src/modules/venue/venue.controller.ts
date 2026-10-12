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
import { VenueService } from './venue.service';
import { RequestVenueDto } from './dto/request-venue.dto';

@Controller()
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  private requireUserId(req: AuthenticatedRequest): string {
    if (!req.userId) {
      throw new UnauthorizedException('Missing authorization token.');
    }
    return req.userId;
  }

  @Get('venues')
  @UseGuards(JwtAuthGuard)
  listVenues() {
    return this.venueService.listVenues();
  }

  @Post('venues/:venueId/bookings')
  @UseGuards(JwtAuthGuard)
  requestBooking(
    @Req() req: AuthenticatedRequest,
    @Param('venueId') venueId: string,
    @Body() dto: RequestVenueDto,
  ) {
    return this.venueService.requestBooking(
      this.requireUserId(req),
      venueId,
      dto,
    );
  }

  @Get('venues/bookings/mine')
  @UseGuards(JwtAuthGuard)
  listMyBookings(@Req() req: AuthenticatedRequest) {
    return this.venueService.listMyBookings(this.requireUserId(req));
  }

  @Get('venues/bookings')
  @UseGuards(JwtAuthGuard)
  listAllBookings() {
    return this.venueService.listAllBookings();
  }

  @Post('venue-bookings/:bookingId/approve')
  @UseGuards(JwtAuthGuard)
  approve(
    @Req() req: AuthenticatedRequest,
    @Param('bookingId') bookingId: string,
  ) {
    return this.venueService.approve(this.requireUserId(req), bookingId);
  }

  @Post('venue-bookings/:bookingId/reject')
  @UseGuards(JwtAuthGuard)
  reject(
    @Req() req: AuthenticatedRequest,
    @Param('bookingId') bookingId: string,
  ) {
    return this.venueService.reject(this.requireUserId(req), bookingId);
  }
}
