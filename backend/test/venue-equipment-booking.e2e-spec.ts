import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import {
  resetDatabase,
  seedHostelWithCaretaker,
  testPrisma,
  TEST_PASSWORD,
} from './helpers/db';

// Phase 11: FR-008's venue/equipment booking approval cycle, end to end
// through real admin approve/reject/return endpoints and a real
// availableQuantity column - not a mocked Prisma call asserting the
// right update() args were passed.
describe('Venue & equipment booking (e2e)', () => {
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

  let studentToken: string;
  let adminToken: string;

  beforeEach(async () => {
    await resetDatabase(prisma);
    const { hostel } = await seedHostelWithCaretaker(prisma, {
      code: 'A',
      name: 'Agira Hall',
      caretakerEmail: 'a.caretaker@thapar.edu',
    });
    studentToken = await signupAndLogin('student@thapar.edu', 'Student One');
    await api()
      .post('/api/hostels/select')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ hostelId: hostel.id })
      .expect(201);

    adminToken = await signupAndLogin('admin@thapar.edu', 'Admin Tester');
    await prisma.user.update({
      where: { email: 'admin@thapar.edu' },
      data: { isSportsAdmin: true },
    });
    await api()
      .post('/api/hostels/select')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ hostelId: hostel.id })
      .expect(201);
  });

  it('equipment: request -> approve decrements stock -> return restores it', async () => {
    const item = await api()
      .post('/api/equipment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Basketball', totalQuantity: 5 })
      .expect(201);
    expect(item.body.availableQuantity).toBe(5);

    const booking = await api()
      .post(`/api/equipment/${item.body.id}/bookings`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ quantity: 2, reason: 'Practice session' })
      .expect(201);
    expect(booking.body.status).toBe('pending');

    // Stock doesn't move until approved.
    const afterRequest = await api()
      .get('/api/equipment')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(
      afterRequest.body.find((i: { id: string }) => i.id === item.body.id)
        .availableQuantity,
    ).toBe(5);

    await api()
      .post(`/api/equipment-bookings/${booking.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const afterApprove = await api()
      .get('/api/equipment')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(
      afterApprove.body.find((i: { id: string }) => i.id === item.body.id)
        .availableQuantity,
    ).toBe(3);

    await api()
      .post(`/api/equipment-bookings/${booking.body.id}/return`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const afterReturn = await api()
      .get('/api/equipment')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(
      afterReturn.body.find((i: { id: string }) => i.id === item.body.id)
        .availableQuantity,
    ).toBe(5);
  });

  it('equipment: cannot approve a request for more than what is available', async () => {
    const item = await api()
      .post('/api/equipment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Cricket Bat', totalQuantity: 2 })
      .expect(201);

    // Both requests fit individually while nothing is approved yet (2
    // available either way) - the race is in approving both.
    const bookingA = await api()
      .post(`/api/equipment/${item.body.id}/bookings`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ quantity: 2 })
      .expect(201);
    const bookingB = await api()
      .post(`/api/equipment/${item.body.id}/bookings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 1 })
      .expect(201);

    await api()
      .post(`/api/equipment-bookings/${bookingA.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    // Only 0 left now - approving the second shouldn't silently go negative.
    await api()
      .post(`/api/equipment-bookings/${bookingB.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
  });

  // Phase 12: confirms the Sports Admin role-check added to this route
  // (see role-boundaries.e2e-spec.ts's matching Student-rejected case)
  // doesn't just block everyone - a genuine Sports Admin still gets
  // through to the real reminder logic.
  it('notifications: a Sports Admin can manually trigger match-day reminders', async () => {
    await api()
      .post('/api/notifications/send-match-reminders')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('matchesNotified');
        expect(res.body).toHaveProperty('notificationsSent');
      });
  });

  it('venue: approving one request for a slot auto-rejects a competing request for the same slot', async () => {
    const venue = await prisma.venue.create({
      data: { name: 'Football Ground' },
    });

    const requestA = await api()
      .post(`/api/venues/${venue.id}/bookings`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ date: '2027-01-10', hour: '06:00-07:00' })
      .expect(201);
    const requestB = await api()
      .post(`/api/venues/${venue.id}/bookings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: '2027-01-10', hour: '06:00-07:00' })
      .expect(201);

    await api()
      .post(`/api/venue-bookings/${requestA.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const mine = await api()
      .get('/api/venues/bookings')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const resolvedB = mine.body.find(
      (b: { id: string }) => b.id === requestB.body.id,
    );
    expect(resolvedB.status).toBe('rejected');
  });
});
