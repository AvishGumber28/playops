-- CreateIndex
CREATE INDEX "ConflictLog_tournamentId_idx" ON "ConflictLog"("tournamentId");

-- CreateIndex
CREATE INDEX "ConflictLog_matchId_idx" ON "ConflictLog"("matchId");

-- CreateIndex
CREATE INDEX "EquipmentBooking_equipmentId_idx" ON "EquipmentBooking"("equipmentId");

-- CreateIndex
CREATE INDEX "EquipmentBooking_requestedById_idx" ON "EquipmentBooking"("requestedById");

-- CreateIndex
CREATE INDEX "HostelChangeRequest_status_idx" ON "HostelChangeRequest"("status");

-- CreateIndex
CREATE INDEX "Notification_matchId_idx" ON "Notification"("matchId");

-- CreateIndex
CREATE INDEX "User_hostelId_idx" ON "User"("hostelId");

-- CreateIndex
CREATE INDEX "VenueBooking_venueId_idx" ON "VenueBooking"("venueId");

-- CreateIndex
CREATE INDEX "VenueBooking_requestedById_idx" ON "VenueBooking"("requestedById");
