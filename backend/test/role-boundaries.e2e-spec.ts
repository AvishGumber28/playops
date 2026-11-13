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

// Phase 11: the 207 per-slice unit tests already check each guard/service
// in isolation with a mocked caller id. This instead drives the real HTTP
// layer with real JWTs for real accounts in real roles, checking the
// *seams* - that a request can't cross a role or tenant boundary it
// shouldn't, end to end, not just that one service function would reject
// it if called with the right arguments.
describe('Role & tenant boundaries (e2e)', () => {
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

  describe('unauthenticated requests', () => {
    beforeEach(async () => {
      await resetDatabase(prisma);
    });

    it('rejects every protected endpoint with no token', async () => {
      await api().get('/api/me').expect(401);
      await api().post('/api/tournaments').send({}).expect(401);
      await api().get('/api/equipment/bookings').expect(401);
    });
  });

  describe('student cannot act as secretary/caretaker/admin', () => {
    let studentToken: string;
    let hostelId: string;
    let sportId: string;

    beforeEach(async () => {
      await resetDatabase(prisma);
      const { hostel } = await seedHostelWithCaretaker(prisma, {
        code: 'A',
        name: 'Agira Hall',
        caretakerEmail: 'a.caretaker@thapar.edu',
      });
      const sport = await seedSport(prisma, {
        name: 'Basketball',
        defaultTeamSize: 5,
        scorecardTemplate: 'basketball',
      });
      hostelId = hostel.id;
      sportId = sport.id;
      studentToken = await signupAndLogin(
        'plain.student@thapar.edu',
        'Plain Student',
      );
      await api()
        .post('/api/hostels/select')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ hostelId })
        .expect(201);
    });

    it('cannot create a tournament (Secretary-only)', async () => {
      const deadline = new Date(Date.now() + 86400000).toISOString();
      await api()
        .post('/api/tournaments')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          name: 'Should Fail',
          sportId,
          format: 'knockout',
          registrationDeadline: deadline,
        })
        .expect(403);
    });

    it('cannot appoint a Secretary (Caretaker-only)', async () => {
      await api()
        .post(`/api/hostels/${hostelId}/secretary`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ email: 'plain.student@thapar.edu' })
        .expect(403);
    });

    it('cannot add inventory (Sports Admin-only)', async () => {
      await api()
        .post('/api/equipment')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ name: 'Extra Ball', totalQuantity: 5 })
        .expect(403);
    });

    it('cannot approve/reject equipment bookings (Sports Admin-only)', async () => {
      await api()
        .get('/api/equipment/bookings')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });

    // Phase 12: previously only required a valid JWT, not Sports Admin -
    // any authenticated Student could trigger this system-wide (every
    // hostel, not just their own) notification run.
    it('cannot manually trigger match-day reminders (Sports Admin-only)', async () => {
      await api()
        .post('/api/notifications/send-match-reminders')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });
  });

  describe('cross-tenant isolation between two hostels', () => {
    let secretaryAToken: string;
    let caretakerBToken: string;
    let tournamentAId: string;

    beforeEach(async () => {
      await resetDatabase(prisma);
      const { hostel: hostelA } = await seedHostelWithCaretaker(prisma, {
        code: 'A',
        name: 'Agira Hall',
        caretakerEmail: 'a.caretaker@thapar.edu',
      });
      const { hostel: hostelB } = await seedHostelWithCaretaker(prisma, {
        code: 'B',
        name: 'Amritam Hall',
        caretakerEmail: 'b.caretaker@thapar.edu',
      });
      const sport = await seedSport(prisma, {
        name: 'Cricket',
        defaultTeamSize: 11,
        scorecardTemplate: 'cricket',
      });

      const caretakerAToken = (
        await api()
          .post('/api/auth/login')
          .send({ email: 'a.caretaker@thapar.edu', password: TEST_PASSWORD })
          .expect(200)
      ).body.token;
      caretakerBToken = (
        await api()
          .post('/api/auth/login')
          .send({ email: 'b.caretaker@thapar.edu', password: TEST_PASSWORD })
          .expect(200)
      ).body.token;

      secretaryAToken = await signupAndLogin(
        'secretary.a@thapar.edu',
        'Secretary A',
      );
      await api()
        .post('/api/hostels/select')
        .set('Authorization', `Bearer ${secretaryAToken}`)
        .send({ hostelId: hostelA.id })
        .expect(201);
      await api()
        .post(`/api/hostels/${hostelA.id}/secretary`)
        .set('Authorization', `Bearer ${caretakerAToken}`)
        .send({ email: 'secretary.a@thapar.edu' })
        .expect(201);

      const deadline = new Date(Date.now() + 86400000).toISOString();
      const tRes = await api()
        .post('/api/tournaments')
        .set('Authorization', `Bearer ${secretaryAToken}`)
        .send({
          name: 'Hostel A Cup',
          sportId: sport.id,
          format: 'knockout',
          registrationDeadline: deadline,
        })
        .expect(201);
      tournamentAId = tRes.body.id;

      // keep hostelB referenced so TS doesn't flag it unused if a future
      // edit removes the appointment call above
      void hostelB;
    });

    it("hostel B's Caretaker cannot cancel hostel A's tournament", async () => {
      await api()
        .post(`/api/tournaments/${tournamentAId}/cancel`)
        .set('Authorization', `Bearer ${caretakerBToken}`)
        .send({ reason: 'Not yours' })
        .expect(403);
    });

    it("hostel B's Caretaker view of tournaments never includes hostel A's", async () => {
      const res = await api()
        .get('/api/tournaments/caretaker')
        .set('Authorization', `Bearer ${caretakerBToken}`)
        .expect(200);
      expect(
        res.body.find((t: { id: string }) => t.id === tournamentAId),
      ).toBeUndefined();
    });
  });
});
