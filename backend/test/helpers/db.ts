import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

// A standalone Prisma client for test setup/teardown - separate from the
// app's own PrismaService instance (which only exists once Nest has
// bootstrapped). Always points at playops_test (see .env.test); tests
// never touch the real dev database.
export function testPrisma(): PrismaClient {
  // max: 2 - this client only ever does one setup query at a time; kept
  // small so five e2e spec files' worth of these (plus each file's own
  // Nest app/PrismaService) don't pile up near Postgres's connection cap.
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: 2,
  });
  return new PrismaClient({ adapter });
}

// All 16 models, truncated together (CASCADE handles FK order) so every
// e2e spec starts from a genuinely empty database, not whatever the last
// spec file left behind.
const ALL_TABLES = [
  'User',
  'Hostel',
  'HostelChangeRequest',
  'Sport',
  'Tournament',
  'Team',
  'TeamPlayer',
  'Venue',
  'Equipment',
  'VenueBooking',
  'EquipmentBooking',
  'Match',
  'Scorecard',
  'ConflictLog',
  'Announcement',
  'Notification',
];

export async function resetDatabase(prisma: PrismaClient) {
  const tables = ALL_TABLES.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE;`,
  );
}

export const TEST_PASSWORD = 'TestPass123!';

// Reference data no public endpoint can create (sports/venues are a
// fixed catalog, and a Hostel's caretaker is assigned directly in the DB,
// never through signup - mirrors prisma/seed.ts, just scoped to what each
// e2e spec actually needs instead of the full 7-hostel dev catalog.
export async function seedHostelWithCaretaker(
  prisma: PrismaClient,
  opts: { code: string; name: string; caretakerEmail: string },
) {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const caretaker = await prisma.user.create({
    data: {
      email: opts.caretakerEmail,
      passwordHash,
      name: `${opts.name} Caretaker`,
    },
  });
  const hostel = await prisma.hostel.create({
    data: { code: opts.code, name: opts.name, caretakerUserId: caretaker.id },
  });
  return { hostel, caretaker };
}

export async function seedSport(
  prisma: PrismaClient,
  opts: { name: string; defaultTeamSize: number; scorecardTemplate: string },
) {
  return prisma.sport.create({ data: opts });
}

export async function seedVenue(prisma: PrismaClient, name: string) {
  return prisma.venue.create({ data: { name } });
}
