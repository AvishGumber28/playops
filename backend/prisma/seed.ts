import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

// Seed scripts run standalone via ts-node, outside Nest's bootstrap - so
// unlike PrismaService, this can't get DATABASE_URL from ConfigService and
// has to build its own adapter directly, same fix as D-009, just applied
// here too since this file didn't exist yet when that was originally fixed.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Every seeded caretaker shares this password until the college provides
// real Caretaker data (this is the bootstrap approach decided back in
// Phase 0 - dummy accounts for v1, real data swapped in later).
const DUMMY_PASSWORD = 'changeme123';

const HOSTELS = [
  { code: 'A', name: 'Agira Hall' },
  { code: 'B', name: 'Amritam Hall' },
  { code: 'C', name: 'Prithvi Hall' },
  { code: 'M', name: 'Anantam Hall' },
  { code: 'PG', name: 'Dhriti Hall' },
  { code: 'PG2', name: 'Pavani Hall' },
  { code: 'Q', name: 'Vahni Hall' },
];

const SPORTS = [
  { name: 'Cricket', defaultTeamSize: 11, scorecardTemplate: 'cricket' },
  { name: 'Football', defaultTeamSize: 11, scorecardTemplate: 'football' },
  { name: 'Basketball', defaultTeamSize: 5, scorecardTemplate: 'basketball' },
];

async function main() {
  const passwordHash = await bcrypt.hash(DUMMY_PASSWORD, 10);

  for (const hostel of HOSTELS) {
    // {code}Caretaker@thapar.edu, preserving the hostel code's own casing
    // (e.g. "PG2Caretaker", not "pg2Caretaker").
    const email = `${hostel.code}Caretaker@thapar.edu`;

    const caretaker = await prisma.user.upsert({
      where: { email },
      update: { name: `${hostel.name} Caretaker (dummy)` },
      create: {
        email,
        passwordHash,
        name: `${hostel.name} Caretaker (dummy)`,
      },
    });

    await prisma.hostel.upsert({
      where: { code: hostel.code },
      update: { name: hostel.name, caretakerUserId: caretaker.id },
      create: {
        code: hostel.code,
        name: hostel.name,
        caretakerUserId: caretaker.id,
      },
    });

    console.log(`Seeded ${hostel.name} (${hostel.code}) - caretaker login: ${email}`);
  }

  for (const sport of SPORTS) {
    await prisma.sport.upsert({
      where: { name: sport.name },
      update: {},
      create: sport,
    });
    console.log(`Seeded sport: ${sport.name}`);
  }

  console.log(`\nAll caretaker accounts share the password: ${DUMMY_PASSWORD}`);
  console.log('Replace these dummy accounts once the college provides real Caretaker data.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
