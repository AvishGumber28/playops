-- D-019: FR-008 (Venue & Equipment Booking) backend slice.

-- Equipment.availableQuantity - a maintained column (see schema.prisma's
-- comment on the Equipment model for why this isn't computed from
-- bookings the way business rule 10 originally described).
ALTER TABLE "Equipment" ADD COLUMN "availableQuantity" INTEGER NOT NULL DEFAULT 0;
UPDATE "Equipment" SET "availableQuantity" = "totalQuantity";

-- EquipmentBooking is "checked out until returned," not a date/time-slot
-- reservation like VenueBooking - these three columns don't apply here.
ALTER TABLE "EquipmentBooking" ALTER COLUMN "date" DROP NOT NULL;
ALTER TABLE "EquipmentBooking" ALTER COLUMN "startTime" DROP NOT NULL;
ALTER TABLE "EquipmentBooking" ALTER COLUMN "endTime" DROP NOT NULL;

-- requestedById/approvedById had no foreign keys at all on this table
-- (VenueBooking's equivalent columns already did) - add them for the
-- same integrity guarantee.
ALTER TABLE "EquipmentBooking" ADD CONSTRAINT "EquipmentBooking_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquipmentBooking" ADD CONSTRAINT "EquipmentBooking_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Business rule 3 - "at most one approved booking per slot" - a partial
-- unique index (schema.prisma described this from the start, but it was
-- never actually applied until now).
CREATE UNIQUE INDEX "venue_booking_no_double_book"
  ON "VenueBooking" ("venueId", "date", "startTime", "endTime")
  WHERE "status" = 'approved';

-- The fixed 3-ground catalog is seeded by name (seed.ts) - needs
-- uniqueness the same way Hostel.name/Sport.name already have it.
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_name_key" UNIQUE ("name");
