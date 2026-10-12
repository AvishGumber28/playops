import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VenueController } from './venue.controller';
import { VenueService } from './venue.service';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';

// FR-008 - the "Venue & Booking" module from docs/system-architecture.md
// (Venue, Equipment, VenueBooking, EquipmentBooking). Populated starting
// Phase 9, per this file's original placeholder comment. AuthModule is
// imported (not just referenced) so JwtAuthGuard's JwtService dependency
// resolves, same as every other module here.
@Module({
  imports: [AuthModule],
  controllers: [VenueController, EquipmentController],
  providers: [VenueService, EquipmentService],
})
export class VenueModule {}
