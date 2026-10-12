/*
  D-021: closes the dangling "cancel it instead of deleting it" gap from
  D-017 - the `cancelled` tournament status has existed in the schema
  since then, but nothing ever actually set it. Mirrors Match's own
  cancellationReason column (nullable - only ever set once a tournament
  is actually cancelled).
*/
-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN "cancellationReason" TEXT;
