/*
  D-012: rollNumber and photoUrl, self-reported at signup. Both nullable -
  every existing account (including every seeded Caretaker) starts with
  both NULL until whoever owns that account fills them in. No backfill
  needed, no unique constraint (unlike email - two students can share the
  same roll number format string as far as the database cares; nothing
  in the docs asked for uniqueness here).
*/
-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "rollNumber" TEXT,
  ADD COLUMN "photoUrl" TEXT;
