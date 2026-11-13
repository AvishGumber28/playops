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

// Phase 11: a real cross-module flow, hitting a real Postgres test
// database (playops_test, never the dev one) through the actual HTTP
// layer - not mocked services. Everything the 207 per-slice unit tests
// already cover in isolation, this instead exercises together, the way
// a Secretary and a Student actually would: appoint -> create -> register
// -> approve -> generate fixtures.
describe('Golden path: tournament lifecycle (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = testPrisma();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    // Mirrors src/main.ts's real bootstrap exactly, so this test exercises
    // the same validation/error behavior production actually has.
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

  beforeEach(async () => {
    await resetDatabase(prisma);
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
    return res.body.token;
  }

  it('runs the full secretary/student tournament flow end to end', async () => {
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

    // --- Caretaker appoints a Secretary ---
    const caretakerToken = (
      await api()
        .post('/api/auth/login')
        .send({ email: 'a.caretaker@thapar.edu', password: TEST_PASSWORD })
        .expect(200)
    ).body.token;

    const secretaryToken = await signupAndLogin(
      'secretary@thapar.edu',
      'Secretary Sam',
    );
    // FR-004: the appointee must already belong to this hostel before the
    // Caretaker can appoint them.
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

    const me = await api()
      .get('/api/me')
      .set('Authorization', `Bearer ${secretaryToken}`)
      .expect(200);
    expect(me.body.secretaryOfHostels).toHaveLength(1);
    expect(me.body.secretaryOfHostels[0].id).toBe(hostel.id);

    // --- Secretary creates a tournament ---
    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const tournamentRes = await api()
      .post('/api/tournaments')
      .set('Authorization', `Bearer ${secretaryToken}`)
      .send({
        name: 'Agira Football Cup',
        sportId: sport.id,
        format: 'knockout',
        registrationDeadline: deadline,
      })
      .expect(201);
    const tournamentId = tournamentRes.body.id;
    expect(tournamentRes.body.status).toBe('registration_open');

    // --- Two students join the hostel and register competing teams ---
    const studentAToken = await signupAndLogin(
      'student.a@thapar.edu',
      'Student A',
    );
    await api()
      .post('/api/hostels/select')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ hostelId: hostel.id })
      .expect(201);
    const teamA = await api()
      .post(`/api/tournaments/${tournamentId}/teams`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ name: 'Team Alpha' })
      .expect(201);

    const studentBToken = await signupAndLogin(
      'student.b@thapar.edu',
      'Student B',
    );
    await api()
      .post('/api/hostels/select')
      .set('Authorization', `Bearer ${studentBToken}`)
      .send({ hostelId: hostel.id })
      .expect(201);
    const teamB = await api()
      .post(`/api/tournaments/${tournamentId}/teams`)
      .set('Authorization', `Bearer ${studentBToken}`)
      .send({ name: 'Team Bravo' })
      .expect(201);

    // --- Secretary approves both teams ---
    await api()
      .post(`/api/teams/${teamA.body.id}/approve`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .expect(201);
    await api()
      .post(`/api/teams/${teamB.body.id}/approve`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .expect(201);

    // --- Secretary generates fixtures - this should close registration ---
    const fixturesRes = await api()
      .post(`/api/tournaments/${tournamentId}/fixtures`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .expect(201);
    expect(fixturesRes.body.rounds.length).toBeGreaterThan(0);
    expect(fixturesRes.body.rounds[0].matches.length).toBeGreaterThan(0);

    const tournamentAfter = await api()
      .get('/api/tournaments/mine')
      .set('Authorization', `Bearer ${secretaryToken}`)
      .expect(200);
    expect(tournamentAfter.body[0].status).toBe('in_progress');

    // --- Both students can see the generated schedule ---
    const scheduleForA = await api()
      .get(`/api/tournaments/${tournamentId}/fixtures`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .expect(200);
    expect(scheduleForA.body.rounds.length).toBeGreaterThan(0);
  });
});
