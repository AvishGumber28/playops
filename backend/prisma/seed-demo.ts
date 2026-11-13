import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { HostelService } from '../src/modules/hostel/hostel.service';
import { TeamService } from '../src/modules/tournament/team.service';
import { TournamentService } from '../src/modules/tournament/tournament.service';
import { FixtureService } from '../src/modules/tournament/fixture.service';
import { ResultsService } from '../src/modules/results/results.service';
import { MatchSchedulingService } from '../src/modules/scheduling/match-scheduling.service';
import { EquipmentService } from '../src/modules/venue/equipment.service';
import { VenueService } from '../src/modules/venue/venue.service';
import { AnnouncementsService } from '../src/modules/notifications/announcements.service';

// Phase 14: a realistic, fully-populated demo environment - separate
// from prisma/seed.ts (which only ever seeds structural data: hostels,
// sports, venues, dummy Caretaker logins, and runs on every normal dev
// setup). This script layers believable content on top of that:
// students, registered teams, tournaments at every real lifecycle stage,
// scheduled matches with real results, equipment/venue bookings in every
// status, and announcements - run on demand (`npm run seed:demo`), never
// automatically.
//
// Driven entirely through the real NestJS service layer (not raw Prisma
// writes) - the exact same classes the HTTP API calls - so every
// business rule (deadlines, approval gates, bracket seeding, winner
// advancement, stock decrements) is enforced by the real code instead of
// being hand-reproduced here and risking data that violates the app's
// own invariants. `strict: false` on every app.get() call below is what
// makes this possible without re-exporting every service from every
// module just for this script.
const DEMO_PASSWORD = 'DemoPass123!';
// Presence of this one account is the idempotency check below - if a
// previous run already created it, this script stops rather than
// duplicating everything. Reset the database (see docs/demo-script.md)
// to reseed from scratch.
const MARKER_EMAIL = 'secretary.demo@thapar.edu';

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['warn', 'error'],
  });

  const prisma = app.get(PrismaService, { strict: false });
  const auth = app.get(AuthService, { strict: false });
  const hostelSvc = app.get(HostelService, { strict: false });
  const teamSvc = app.get(TeamService, { strict: false });
  const tournamentSvc = app.get(TournamentService, { strict: false });
  const fixtureSvc = app.get(FixtureService, { strict: false });
  const resultsSvc = app.get(ResultsService, { strict: false });
  const schedulingSvc = app.get(MatchSchedulingService, { strict: false });
  const equipmentSvc = app.get(EquipmentService, { strict: false });
  const venueSvc = app.get(VenueService, { strict: false });
  const announcementsSvc = app.get(AnnouncementsService, { strict: false });

  const existing = await prisma.user.findUnique({
    where: { email: MARKER_EMAIL },
  });
  if (existing) {
    console.log(
      `Demo data already present (found ${MARKER_EMAIL}) - skipping.\n` +
        'Reset the database first (see docs/demo-script.md) to reseed from scratch.',
    );
    await app.close();
    return;
  }

  const hostelA = await prisma.hostel.findUniqueOrThrow({
    where: { code: 'A' },
  });
  const hostelB = await prisma.hostel.findUniqueOrThrow({
    where: { code: 'B' },
  });
  const caretakerA = await prisma.user.findUniqueOrThrow({
    where: { email: 'ACaretaker@thapar.edu' },
  });
  const caretakerB = await prisma.user.findUniqueOrThrow({
    where: { email: 'BCaretaker@thapar.edu' },
  });
  const football = await prisma.sport.findUniqueOrThrow({
    where: { name: 'Football' },
  });
  const cricket = await prisma.sport.findUniqueOrThrow({
    where: { name: 'Cricket' },
  });
  const basketball = await prisma.sport.findUniqueOrThrow({
    where: { name: 'Basketball' },
  });
  const footballGround = await prisma.venue.findUniqueOrThrow({
    where: { name: 'Football Ground' },
  });
  const cricketGround = await prisma.venue.findUniqueOrThrow({
    where: { name: 'Cricket Ground' },
  });
  const basketballCourt = await prisma.venue.findUniqueOrThrow({
    where: { name: 'Basketball Court' },
  });

  // ---- people ----

  async function student(
    email: string,
    name: string,
    hostelId: string,
  ): Promise<string> {
    const { user } = await auth.signup({
      name,
      email,
      password: DEMO_PASSWORD,
    });
    await hostelSvc.selectHostel(user.id, hostelId);
    return user.id;
  }

  console.log('Creating demo accounts...');

  const secretaryAId = await student(
    'secretary.demo@thapar.edu',
    'Ananya Verma',
    hostelA.id,
  );
  await hostelSvc.appointSecretary(
    caretakerA.id,
    hostelA.id,
    'secretary.demo@thapar.edu',
  );

  const secretaryBId = await student(
    'secretary2.demo@thapar.edu',
    'Meera Nair',
    hostelB.id,
  );
  await hostelSvc.appointSecretary(
    caretakerB.id,
    hostelB.id,
    'secretary2.demo@thapar.edu',
  );

  const { user: adminUser } = await auth.signup({
    name: 'Sameer Kulkarni',
    email: 'admin.demo@thapar.edu',
    password: DEMO_PASSWORD,
  });
  await hostelSvc.selectHostel(adminUser.id, hostelA.id);
  await prisma.user.update({
    where: { id: adminUser.id },
    data: { isSportsAdmin: true },
  });

  // Hostel A's student pool - several are deliberately reused across more
  // than one tournament (a student isn't limited to one sport), the same
  // way real students would be.
  const rohan = await student(
    'rohan.sharma@thapar.edu',
    'Rohan Sharma',
    hostelA.id,
  );
  const aditya = await student(
    'aditya.verma@thapar.edu',
    'Aditya Verma',
    hostelA.id,
  );
  const karan = await student(
    'karan.singh@thapar.edu',
    'Karan Singh',
    hostelA.id,
  );
  const vikram = await student(
    'vikram.rao@thapar.edu',
    'Vikram Rao',
    hostelA.id,
  );
  const priya = await student(
    'priya.patel@thapar.edu',
    'Priya Patel',
    hostelA.id,
  );
  const neha = await student('neha.gupta@thapar.edu', 'Neha Gupta', hostelA.id);
  const arjun = await student(
    'arjun.mehta@thapar.edu',
    'Arjun Mehta',
    hostelA.id,
  );
  const sanya = await student(
    'sanya.kapoor@thapar.edu',
    'Sanya Kapoor',
    hostelA.id,
  );
  const ishaan = await student(
    'ishaan.joshi@thapar.edu',
    'Ishaan Joshi',
    hostelA.id,
  );
  const ananya = await student(
    'ananya.iyer@thapar.edu',
    'Ananya Iyer',
    hostelA.id,
  );
  const dev = await student(
    'dev.malhotra@thapar.edu',
    'Dev Malhotra',
    hostelA.id,
  );
  const riya = await student('riya.nair@thapar.edu', 'Riya Nair', hostelA.id);

  // Hostel B - just enough to prove tenant isolation during a demo.
  const rahul = await student(
    'rahul.desai@thapar.edu',
    'Rahul Desai',
    hostelB.id,
  );
  const tanvi = await student(
    'tanvi.shah@thapar.edu',
    'Tanvi Shah',
    hostelB.id,
  );
  const zoya = await student('zoya.khan@thapar.edu', 'Zoya Khan', hostelB.id);
  const yash = await student(
    'yash.oberoi@thapar.edu',
    'Yash Oberoi',
    hostelB.id,
  );

  // ---- helper: create a team, add one extra player ----
  // registrationStatus defaults to 'approved' at creation (Q-007) - only
  // the one team this script deliberately rejects below passes
  // `reject: true`, there is no separate "pending" state to simulate.

  async function team(
    tournamentId: string,
    name: string,
    captainId: string,
    playerId: string,
    reject = false,
  ): Promise<string> {
    const created = await teamSvc.createTeam(captainId, tournamentId, { name });
    await teamSvc.addPlayer(captainId, created.id, {
      email: (await prisma.user.findUniqueOrThrow({ where: { id: playerId } }))
        .email,
    });
    if (reject) {
      await teamSvc.setRegistrationStatus(secretaryAId, created.id, 'rejected');
    }
    return created.id;
  }

  // ---- Football Cup (knockout) - played to completion ----

  console.log('Building the Football Cup (knockout, completed)...');

  const footballCup = await tournamentSvc.createTournament(secretaryAId, {
    name: 'Agira Football Cup',
    description:
      "This season's flagship knockout tournament - 4 hostel teams, single elimination.",
    sportId: football.id,
    format: 'knockout',
    registrationDeadline: daysFromNow(1),
  });

  await team(footballCup.id, 'Agira Strikers', rohan, aditya);
  await team(footballCup.id, 'Agira Falcons', karan, vikram);
  await team(footballCup.id, 'Agira Panthers', priya, neha);
  await team(footballCup.id, 'Agira Lions', arjun, sanya);

  let footballFixtures = await fixtureSvc.generateFixtures(
    secretaryAId,
    footballCup.id,
  );
  const semis = footballFixtures.rounds[0].matches;

  // Schedule + approve both semifinals before playing them, so the
  // fixtures view shows a real venue/date/time, not just a bare result.
  for (const [i, match] of semis.entries()) {
    const booking = await schedulingSvc.scheduleMatch(secretaryAId, match.id, {
      venueId: footballGround.id,
      date: daysFromNow(3),
      hour: i === 0 ? '16:00-17:00' : '17:00-18:00',
    });
    await venueSvc.approve(adminUser.id, booking.id);
  }

  // Strikers beat Lions 2-1; Falcons beat Panthers 3-2 - Strikers and
  // Falcons advance to the final.
  for (const match of semis) {
    const teamA = match.teamA!;
    const teamB = match.teamB!;
    const aAdvances =
      teamA.name === 'Agira Strikers' || teamA.name === 'Agira Falcons';
    const winner = aAdvances ? teamA : teamB;
    const winnerScore = winner.name === 'Agira Strikers' ? 2 : 3;
    const loserScore = winner.name === 'Agira Strikers' ? 1 : 2;
    await resultsSvc.submitScorecard(secretaryAId, match.id, {
      winnerTeamId: winner.id,
      data: aAdvances
        ? { teamAGoals: winnerScore, teamBGoals: loserScore }
        : { teamAGoals: loserScore, teamBGoals: winnerScore },
    });
  }

  footballFixtures = await fixtureSvc.listFixtures(
    secretaryAId,
    footballCup.id,
  );
  const final = footballFixtures.rounds[1].matches[0];
  const finalBooking = await schedulingSvc.scheduleMatch(
    secretaryAId,
    final.id,
    {
      venueId: footballGround.id,
      date: daysFromNow(5),
      hour: '17:00-18:00',
    },
  );
  await venueSvc.approve(adminUser.id, finalBooking.id);

  // Strikers lift the cup, 1-0.
  const strikersIsA = final.teamA!.name === 'Agira Strikers';
  await resultsSvc.submitScorecard(secretaryAId, final.id, {
    winnerTeamId: strikersIsA ? final.teamA!.id : final.teamB!.id,
    data: strikersIsA
      ? { teamAGoals: 1, teamBGoals: 0 }
      : { teamAGoals: 0, teamBGoals: 1 },
  });

  // ---- Cricket League - played to completion, real standings ----

  console.log('Building the Cricket League (round-robin, completed)...');

  const cricketLeague = await tournamentSvc.createTournament(secretaryAId, {
    name: 'Agira Cricket League',
    description:
      'A 3-team round-robin - everyone plays everyone once, ranked by points.',
    sportId: cricket.id,
    format: 'league',
    registrationDeadline: daysFromNow(1),
  });

  await team(cricketLeague.id, 'Agira Smashers', rohan, ishaan);
  await team(cricketLeague.id, 'Agira Titans', priya, ananya);
  await team(cricketLeague.id, 'Agira Warriors', karan, arjun);

  const cricketFixtures = await fixtureSvc.generateFixtures(
    secretaryAId,
    cricketLeague.id,
  );
  const cricketMatches = cricketFixtures.rounds.flatMap((r) => r.matches);

  // Smashers top the table (2 wins), Titans mid-table (1 win), Warriors
  // bottom - team A always "wins" below for a clean, legible table.
  for (const match of cricketMatches) {
    const aWins =
      match.teamA!.name === 'Agira Smashers' ||
      (match.teamA!.name === 'Agira Titans' &&
        match.teamB!.name === 'Agira Warriors');
    const winner = aWins ? match.teamA! : match.teamB!;
    await resultsSvc.submitScorecard(secretaryAId, match.id, {
      winnerTeamId: winner.id,
      data: {
        teamARuns: aWins ? 172 : 140,
        teamAWickets: aWins ? 4 : 7,
        teamAOvers: 20,
        teamBRuns: aWins ? 140 : 172,
        teamBWickets: aWins ? 7 : 4,
        teamBOvers: 20,
      },
    });
  }

  // ---- Basketball Open - still accepting registrations ----

  console.log('Building the Basketball Open (registration still open)...');

  const basketballOpen = await tournamentSvc.createTournament(secretaryAId, {
    name: 'Agira Basketball Open',
    description: 'Registration is still open - one team below was turned away.',
    sportId: basketball.id,
    format: 'knockout',
    registrationDeadline: daysFromNow(14),
  });

  await team(basketballOpen.id, 'Agira Hoopers', vikram, sanya);
  await team(basketballOpen.id, 'Agira Dunkers', neha, aditya);
  await team(basketballOpen.id, 'Agira Ballers', ishaan, ananya);
  // Rejected - real content for the Secretary's "View Teams" list to
  // show off the reject path, since registrationStatus has no separate
  // pending state (it defaults straight to approved, Q-007).
  await team(basketballOpen.id, 'Agira Rookies', dev, riya, true);

  // ---- Hostel B - proves tenant isolation ----

  console.log("Building Hostel B's tournament (proves tenant isolation)...");

  const amritamCup = await tournamentSvc.createTournament(secretaryBId, {
    name: 'Amritam Football Cup',
    sportId: football.id,
    format: 'knockout',
    registrationDeadline: daysFromNow(10),
  });
  const amritamTeam = async (
    name: string,
    captainId: string,
    playerId: string,
  ) => {
    const created = await teamSvc.createTeam(captainId, amritamCup.id, {
      name,
    });
    await teamSvc.addPlayer(captainId, created.id, {
      email: (await prisma.user.findUniqueOrThrow({ where: { id: playerId } }))
        .email,
    });
    await teamSvc.setRegistrationStatus(secretaryBId, created.id, 'approved');
  };
  await amritamTeam('Amritam Eagles', rahul, tanvi);
  await amritamTeam('Amritam Tigers', zoya, yash);

  // ---- Equipment: a full lifecycle across the 5-item catalog ----

  console.log('Stocking the equipment catalog and booking it...');

  const cricketBat = await equipmentSvc.addItem(adminUser.id, {
    name: 'Cricket Bat',
    totalQuantity: 10,
  });
  const basketballItem = await equipmentSvc.addItem(adminUser.id, {
    name: 'Basketball',
    totalQuantity: 8,
  });
  const footballItem = await equipmentSvc.addItem(adminUser.id, {
    name: 'Football',
    totalQuantity: 12,
  });
  const badminton = await equipmentSvc.addItem(adminUser.id, {
    name: 'Badminton Racquet',
    totalQuantity: 15,
  });
  await equipmentSvc.addItem(adminUser.id, {
    name: 'Volleyball',
    totalQuantity: 6,
  });

  // Checked out and still in use.
  const batBooking = await equipmentSvc.requestBooking(rohan, cricketBat.id, {
    quantity: 2,
    reason: 'Cricket League practice session',
  });
  await equipmentSvc.approve(adminUser.id, batBooking.id);

  // Checked out, then returned - the full cycle.
  const ballBooking = await equipmentSvc.requestBooking(
    priya,
    basketballItem.id,
    {
      quantity: 1,
      reason: 'Basketball Open warm-up',
    },
  );
  await equipmentSvc.approve(adminUser.id, ballBooking.id);
  await equipmentSvc.markReturned(adminUser.id, ballBooking.id);

  // Still pending - something real for the Sports Admin to act on.
  await equipmentSvc.requestBooking(karan, footballItem.id, {
    quantity: 3,
    reason: 'Football Cup final warm-up',
  });

  // Rejected.
  const racquetBooking = await equipmentSvc.requestBooking(
    arjun,
    badminton.id,
    {
      quantity: 2,
      reason: 'Casual weekend game',
    },
  );
  await equipmentSvc.reject(adminUser.id, racquetBooking.id);

  // ---- Venue: ad-hoc bookings, separate from the match-scheduling above ----

  console.log(
    'Booking venues ad-hoc (FR-008, separate from match scheduling)...',
  );

  const practiceBooking = await venueSvc.requestBooking(
    secretaryAId,
    cricketGround.id,
    {
      date: daysFromNow(2),
      hour: '06:00-07:00',
    },
  );
  await venueSvc.approve(adminUser.id, practiceBooking.id);

  // Still pending.
  await venueSvc.requestBooking(ishaan, basketballCourt.id, {
    date: daysFromNow(4),
    hour: '18:00-19:00',
  });

  // ---- Announcements (FR-012) - generates real notifications for every recipient ----

  console.log('Posting announcements...');

  await announcementsSvc.postAnnouncement(secretaryAId, {
    title: 'Hostel A Sports Season Kicks Off!',
    body:
      'Football, Cricket, and Basketball registrations are live. Good luck to every team - ' +
      'play hard, play fair.',
  });
  await announcementsSvc.postAnnouncement(secretaryAId, {
    title: 'Football Cup Final - Today!',
    body: 'Agira Strikers vs Agira Falcons, Football Ground, 17:00. Come cheer your team on.',
    tournamentId: footballCup.id,
  });

  console.log(
    '\nDemo environment ready. Logins (all share the password DemoPass123!):',
  );
  console.log('  Caretaker (Hostel A):  ACaretaker@thapar.edu / changeme123');
  console.log('  Secretary (Hostel A):  secretary.demo@thapar.edu');
  console.log('  Sports Admin:          admin.demo@thapar.edu');
  console.log('  Student (any):         rohan.sharma@thapar.edu');
  console.log('See docs/demo-script.md for a full walkthrough.');

  await app.close();
}

main().catch((e) => {
  console.error('Demo seed failed:', e);
  process.exit(1);
});
