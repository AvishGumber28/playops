/*
  D-011: three more Caretaker-appointed hostel admin roles - Proctor, Gym
  Secretary, Mess Secretary. Same shape as the existing caretakerUserId/
  sportsSecretaryUserId columns (nullable, unique, FK to User, SET NULL on
  delete). All three start NULL for every existing hostel - nothing to
  backfill, so the "unique constraint" warning `prisma migrate dev` raises
  for these is a non-issue (multiple NULLs don't violate a unique index in
  Postgres).

  Warnings:

  - A unique constraint covering the columns `[proctorUserId]` on the table `Hostel` will be added.
  - A unique constraint covering the columns `[gymSecretaryUserId]` on the table `Hostel` will be added.
  - A unique constraint covering the columns `[messSecretaryUserId]` on the table `Hostel` will be added.

*/
-- AlterTable
ALTER TABLE "Hostel"
  ADD COLUMN "proctorUserId" TEXT,
  ADD COLUMN "gymSecretaryUserId" TEXT,
  ADD COLUMN "messSecretaryUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Hostel_proctorUserId_key" ON "Hostel"("proctorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Hostel_gymSecretaryUserId_key" ON "Hostel"("gymSecretaryUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Hostel_messSecretaryUserId_key" ON "Hostel"("messSecretaryUserId");

-- AddForeignKey
ALTER TABLE "Hostel" ADD CONSTRAINT "Hostel_proctorUserId_fkey" FOREIGN KEY ("proctorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hostel" ADD CONSTRAINT "Hostel_gymSecretaryUserId_fkey" FOREIGN KEY ("gymSecretaryUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hostel" ADD CONSTRAINT "Hostel_messSecretaryUserId_fkey" FOREIGN KEY ("messSecretaryUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
