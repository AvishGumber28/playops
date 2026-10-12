import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { EquipmentService } from './equipment.service';
import { CreateEquipmentItemDto } from './dto/create-equipment-item.dto';
import { UpdateEquipmentItemDto } from './dto/update-equipment-item.dto';
import { RequestEquipmentDto } from './dto/request-equipment.dto';

@Controller()
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  private requireUserId(req: AuthenticatedRequest): string {
    if (!req.userId) {
      throw new UnauthorizedException('Missing authorization token.');
    }
    return req.userId;
  }

  @Get('equipment')
  @UseGuards(JwtAuthGuard)
  listItems() {
    return this.equipmentService.listItems();
  }

  @Post('equipment')
  @UseGuards(JwtAuthGuard)
  addItem(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateEquipmentItemDto,
  ) {
    return this.equipmentService.addItem(this.requireUserId(req), dto);
  }

  @Patch('equipment/:itemId')
  @UseGuards(JwtAuthGuard)
  updateItem(
    @Req() req: AuthenticatedRequest,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateEquipmentItemDto,
  ) {
    return this.equipmentService.updateItem(
      this.requireUserId(req),
      itemId,
      dto,
    );
  }

  @Delete('equipment/:itemId')
  @UseGuards(JwtAuthGuard)
  deleteItem(
    @Req() req: AuthenticatedRequest,
    @Param('itemId') itemId: string,
  ) {
    return this.equipmentService.deleteItem(this.requireUserId(req), itemId);
  }

  @Post('equipment/:itemId/bookings')
  @UseGuards(JwtAuthGuard)
  requestBooking(
    @Req() req: AuthenticatedRequest,
    @Param('itemId') itemId: string,
    @Body() dto: RequestEquipmentDto,
  ) {
    return this.equipmentService.requestBooking(
      this.requireUserId(req),
      itemId,
      dto,
    );
  }

  @Get('equipment/bookings/mine')
  @UseGuards(JwtAuthGuard)
  listMyBookings(@Req() req: AuthenticatedRequest) {
    return this.equipmentService.listMyBookings(this.requireUserId(req));
  }

  @Get('equipment/bookings')
  @UseGuards(JwtAuthGuard)
  listAllBookings(@Req() req: AuthenticatedRequest) {
    return this.equipmentService.listAllBookings(this.requireUserId(req));
  }

  @Post('equipment-bookings/:bookingId/approve')
  @UseGuards(JwtAuthGuard)
  approve(
    @Req() req: AuthenticatedRequest,
    @Param('bookingId') bookingId: string,
  ) {
    return this.equipmentService.approve(this.requireUserId(req), bookingId);
  }

  @Post('equipment-bookings/:bookingId/reject')
  @UseGuards(JwtAuthGuard)
  reject(
    @Req() req: AuthenticatedRequest,
    @Param('bookingId') bookingId: string,
  ) {
    return this.equipmentService.reject(this.requireUserId(req), bookingId);
  }

  @Post('equipment-bookings/:bookingId/return')
  @UseGuards(JwtAuthGuard)
  markReturned(
    @Req() req: AuthenticatedRequest,
    @Param('bookingId') bookingId: string,
  ) {
    return this.equipmentService.markReturned(
      this.requireUserId(req),
      bookingId,
    );
  }
}
