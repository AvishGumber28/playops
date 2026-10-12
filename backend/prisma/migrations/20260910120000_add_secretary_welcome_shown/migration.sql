/*
  D-013: one-time "you've been appointed Secretary" welcome banner.
  Defaults to false for every existing account, including every current
  Secretary - they'll each see the congratulations once, on their next
  dashboard load, which is an acceptable one-off for a brand new feature.
*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN "secretaryWelcomeShown" BOOLEAN NOT NULL DEFAULT false;
