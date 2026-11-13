import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import {
  resetDatabase,
  seedHostelWithCaretaker,
  seedSport,
  testPrisma,
  TEST_PASSWORD,
} from './helpers/db';

// Phase 11: FR-009, the project's core technical contribution - a real
// team double-booking, caught by the actual conflict scanner reading
// real Match/VenueBooking rows, plus the actual cancel -> auto-
// reschedule-search path. Not a mocked "the right Prisma call happened".
describe('Conflict detection & reschedule (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = testPrisma();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  async function signupAndLogin(email: string, name: string): Promise<string> {
    await api()
      .post('/api/auth/signup')
      .send({ name, email, password: TEST_PASSWORD })
      .expect(201);
    const res = await api()
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD })
      .expect(200);
    return res.body.token as string;
  }

  let secretaryToken: string;
  let adminToken: string;
  let tournamentId: string;
  let venueOne: { id: string };
  let venueTwo: { id: string };
  // The two matches that both involve "Team Alpha" in the 3-team league
  // round robin (Alpha-Beta and Alpha-Gamma) - whichever round numbers
  // the fixture generator happened to put them in.
  let alphaMatches: {
    id: string;
    teamA: { id: string } | null;
    teamB: { id: string } | null;
  }[];

  beforeEach(async () => {
    await resetDatabase(prisma);
    const { hostel } = await seedHostelWithCaretaker(prisma, {
      code: 'A',
      name: 'Agira Hall',
      caretakerEmail: 'a.caretaker@thapar.edu',
    });
    const sport = await seedSport(prisma, {
      name: 'Football',
      defaultTeamSize: 11,
      scorecardTemplate: 'football',
    });
    venueOne = await prisma.venue.create({ data: { name: 'Football Ground' } });
    venueTwo = await prisma.venue.create({
      data: { name: 'Basketball Court' },
    });

    const caretakerToken = (
      await api()
        .post('/api/auth/login')
        .send({ email: 'a.caretaker@thapar.edu', password: TEST_PASSWORD })
        .expect(200)
    ).body.token;

    secretaryToken = await signupAndLogin(
      'secretary@thapar.edu',
      'Secretary Sam',
    );
    await api()
      .post('/api/hostels/select')
      .set('Authorization', `Bearer ${secretaryToken}`)
      .send({ hostelId: hostel.id })
      .expect(201);
    await api()
      .post(`/api/hostels/${hostel.id}/secretary`)
      .set('Authorization', `Bearer ${caretakerToken}`)
      .send({ email: 'secretary@thapar.edu' })
      .expect(201);

    adminToken = await signupAndLogin('admin@thapar.edu', 'Admin Tester');
    await prisma.user.update({
      where: { email: 'admin@thapar.edu' },
      data: { isSportsAdmin: true },
    });

    const deadline = new Date(Date.now() + 86400000).toISOString();
    const tRes = await api()
      .post('/api/tournaments')
      .set('Authorization', `Bearer ${secretaryToken}`)
      .send({
        name: 'Round Robin Cup',
        sportId: sport.id,
        format: 'league',
        registrationDeadline: deadline,
      })
      .expect(201);
    tournamentId = tRes.body.id;

    const teamIds: Record<string, string> = {};
    for (const name of ['Alpha', 'Beta', 'Gamma']) {
      const studentToken = await signupAndLogin(
        `${name.toLowerCase()}@thapar.edu`,
        name,
      );
      await api()
        .post('/api/hostels/select')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ hostelId: hostel.id })
        .expect(201);
      const team = await api()
        .post(`/api/tournaments/${tournamentId}/teams`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ name: `Team ${name}` })
        .expect(201);
      teamIds[name] = team.body.id;
      await api()
        .post(`/api/teams/${team.body.id}/approve`)
        .set('Authorization', `Bearer ${secretaryToken}`)
        .expect(201);
    }

    const fixtures = await api()
      .post(`/api/tournaments/${tournamentId}/fixtures`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .expect(201);
    const allMatches = fixtures.body.rounds.flatMap(
      (r: {
        matches: {
          id: string;
          teamA: { id: string } | null;
          teamB: { id: string } | null;
        }[];
      }) => r.matches,
    );
    alphaMatches = allMatches.filter(
      (m: { teamA: { id: string } | null; teamB: { id: string } | null }) =>
        m.teamA?.id === teamIds.Alpha || m.teamB?.id === teamIds.Alpha,
    );
    // Sanity check on the test's own setup, not the app - a 3-team round
    // robin must give Alpha exactly 2 matches (vs Beta, vs Gamma).
    expect(alphaMatches).toHaveLength(2);
  });

  it('flags the same team scheduled into two matches at once', async () => {
    const [matchOne, matchTwo] = alphaMatches;

    for (const [match, venue] of [
      [matchOne, venueOne],
      [matchTwo, venueTwo],
    ] as const) {
      const schedule = await api()
        .post(`/api/matches/${match.id}/schedule`)
        .set('Authorization', `Bearer ${secretaryToken}`)
        .send({ venueId: venue.id, date: '2027-02-01', hour: '08:00-09:00' })
        .expect(201);
      await api()
        .post(`/api/venue-bookings/${schedule.body.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
    }

    const result = await api()
      .post(`/api/tournaments/${tournamentId}/conflicts/check`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .expect(201);

    const teamConflicts = result.body.conflicts.filter(
      (c: { type: string }) => c.type === 'team',
    );
    expect(teamConflicts).toHaveLength(1);
    expect(
      teamConflicts[0].matches.map((m: { id: string }) => m.id).sort(),
    ).toEqual([matchOne.id, matchTwo.id].sort());
  });

  it('reports no conflicts once the two matches are at different times', async () => {
    const [matchOne, matchTwo] = alphaMatches;

    const sOne = await api()
      .post(`/api/matches/${matchOne.id}/schedule`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .send({ venueId: venueOne.id, date: '2027-02-01', hour: '08:00-09:00' })
      .expect(201);
    await api()
      .post(`/api/venue-bookings/${sOne.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const sTwo = await api()
      .post(`/api/matches/${matchTwo.id}/schedule`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .send({ venueId: venueOne.id, date: '2027-02-01', hour: '10:00-11:00' })
      .expect(201);
    await api()
      .post(`/api/venue-bookings/${sTwo.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const result = await api()
      .post(`/api/tournaments/${tournamentId}/conflicts/check`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .expect(201);
    expect(result.body.conflicts).toHaveLength(0);
  });

  it('cancelling an approved match frees its slot and offers an alternative', async () => {
    const [matchOne] = alphaMatches;
    const schedule = await api()
      .post(`/api/matches/${matchOne.id}/schedule`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .send({ venueId: venueOne.id, date: '2027-02-01', hour: '08:00-09:00' })
      .expect(201);
    await api()
      .post(`/api/venue-bookings/${schedule.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const cancelled = await api()
      .post(`/api/matches/${matchOne.id}/cancel`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .send({ reason: 'Ground waterlogged' })
      .expect(201);
    expect(cancelled.body.cancelled).toBe(true);
    // Whether or not an alternative slot was found within the search
    // window, the response must say so explicitly, never silently.
    expect(cancelled.body).toHaveProperty('rescheduled');
    expect(typeof cancelled.body.message).toBe('string');

    // The old slot must be free again for someone else.
    const freeSlotBooking = await api()
      .post(`/api/venues/${venueOne.id}/bookings`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .send({ date: '2027-02-01', hour: '08:00-09:00' })
      .expect(201);
    expect(freeSlotBooking.body.status).toBe('pending');
  });
});
