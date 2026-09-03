/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Hostel` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `Hostel` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Hostel" ADD COLUMN     "code" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Hostel_code_key" ON "Hostel"("code");
