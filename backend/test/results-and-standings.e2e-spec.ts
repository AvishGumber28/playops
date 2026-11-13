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

// Phase 11: FR-010/FR-011 together, end to end - a real scorecard
// submission actually completing a match, actually advancing a knockout
// winner into the next round's match, and actually completing the
// tournament once nothing is left open; a real league's standings table
// computed fresh from real recorded results, not a hand-built fixture.
describe('Results, winner advancement & standings (e2e)', () => {
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
      name: 'Football',
      defaultTeamSize: 11,
      scorecardTemplate: 'football',
    });
    hostelId = hostel.id;
    sportId = sport.id;

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
      .send({ hostelId })
      .expect(201);
    await api()
      .post(`/api/hostels/${hostelId}/secretary`)
      .set('Authorization', `Bearer ${caretakerToken}`)
      .send({ email: 'secretary@thapar.edu' })
      .expect(201);
  });

  async function registerApprovedTeam(name: string) {
    const token = await signupAndLogin(
      `${name.toLowerCase()}@thapar.edu`,
      name,
    );
    await api()
      .post('/api/hostels/select')
      .set('Authorization', `Bearer ${token}`)
      .send({ hostelId })
      .expect(201);
    return token;
  }

  it('knockout: both semifinal winners advance into the final, which completes the tournament', async () => {
    const deadline = new Date(Date.now() + 86400000).toISOString();
    const tRes = await api()
      .post('/api/tournaments')
      .set('Authorization', `Bearer ${secretaryToken}`)
      .send({
        name: 'Knockout Cup',
        sportId,
        format: 'knockout',
        registrationDeadline: deadline,
      })
      .expect(201);
    const tournamentId = tRes.body.id;

    for (const name of ['Alpha', 'Beta', 'Gamma', 'Delta']) {
      const token = await registerApprovedTeam(name);
      const team = await api()
        .post(`/api/tournaments/${tournamentId}/teams`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Team ${name}` })
        .expect(201);
      await api()
        .post(`/api/teams/${team.body.id}/approve`)
        .set('Authorization', `Bearer ${secretaryToken}`)
        .expect(201);
    }

    const fixturesRes = await api()
      .post(`/api/tournaments/${tournamentId}/fixtures`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .expect(201);
    const roundOne = fixturesRes.body.rounds.find(
      (r: { round: number }) => r.round === 1,
    );
    expect(roundOne.matches).toHaveLength(2);

    for (const match of roundOne.matches) {
      await api()
        .post(`/api/matches/${match.id}/scorecard`)
        .set('Authorization', `Bearer ${secretaryToken}`)
        .send({
          winnerTeamId: match.teamA.id,
          data: { teamAGoals: 2, teamBGoals: 0 },
        })
        .expect(201);
    }

    const afterRoundOne = await api()
      .get(`/api/tournaments/${tournamentId}/fixtures`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .expect(200);
    const final = afterRoundOne.body.rounds.find(
      (r: { round: number }) => r.round === 2,
    ).matches[0];
    expect(final.teamA).not.toBeNull();
    expect(final.teamB).not.toBeNull();

    const tournamentMidway = await api()
      .get('/api/tournaments/mine')
      .set('Authorization', `Bearer ${secretaryToken}`)
      .expect(200);
    expect(tournamentMidway.body[0].status).toBe('in_progress');

    await api()
      .post(`/api/matches/${final.id}/scorecard`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .send({
        winnerTeamId: final.teamA.id,
        data: { teamAGoals: 1, teamBGoals: 0 },
      })
      .expect(201);

    const tournamentAfter = await api()
      .get('/api/tournaments/mine')
      .set('Authorization', `Bearer ${secretaryToken}`)
      .expect(200);
    expect(tournamentAfter.body[0].status).toBe('completed');
  });

  it('league: standings reflect every recorded result (win=3, draw=1, loss=0)', async () => {
    const deadline = new Date(Date.now() + 86400000).toISOString();
    const tRes = await api()
      .post('/api/tournaments')
      .set('Authorization', `Bearer ${secretaryToken}`)
      .send({
        name: 'League Cup',
        sportId,
        format: 'league',
        registrationDeadline: deadline,
      })
      .expect(201);
    const tournamentId = tRes.body.id;

    const teamIds: Record<string, string> = {};
    for (const name of ['Alpha', 'Beta', 'Gamma']) {
      const token = await registerApprovedTeam(name);
      const team = await api()
        .post(`/api/tournaments/${tournamentId}/teams`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Team ${name}` })
        .expect(201);
      teamIds[name] = team.body.id;
      await api()
        .post(`/api/teams/${team.body.id}/approve`)
        .set('Authorization', `Bearer ${secretaryToken}`)
        .expect(201);
    }

    const fixturesRes = await api()
      .post(`/api/tournaments/${tournamentId}/fixtures`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .expect(201);
    const allMatches = fixturesRes.body.rounds.flatMap(
      (r: { matches: unknown[] }) => r.matches,
    ) as { id: string; teamA: { id: string }; teamB: { id: string } }[];
    expect(allMatches).toHaveLength(3);

    // Alpha beats Beta, Alpha draws Gamma, Beta beats Gamma.
    // Expected: Alpha 4pts (1W 1D), Beta 3pts (1W 1L), Gamma 1pt (1D 1L).
    for (const match of allMatches) {
      const aName = Object.entries(teamIds).find(
        ([, id]) => id === match.teamA.id,
      )?.[0];
      const bName = Object.entries(teamIds).find(
        ([, id]) => id === match.teamB.id,
      )?.[0];
      const pair = [aName, bName].sort().join('-');

      let winnerTeamId: string | null;
      let data: { teamAGoals: number; teamBGoals: number };
      if (pair === 'Alpha-Beta') {
        winnerTeamId = teamIds.Alpha;
        data =
          match.teamA.id === teamIds.Alpha
            ? { teamAGoals: 2, teamBGoals: 1 }
            : { teamAGoals: 1, teamBGoals: 2 };
      } else if (pair === 'Alpha-Gamma') {
        winnerTeamId = null;
        data = { teamAGoals: 1, teamBGoals: 1 };
      } else {
        winnerTeamId = teamIds.Beta;
        data =
          match.teamA.id === teamIds.Beta
            ? { teamAGoals: 2, teamBGoals: 0 }
            : { teamAGoals: 0, teamBGoals: 2 };
      }

      await api()
        .post(`/api/matches/${match.id}/scorecard`)
        .set('Authorization', `Bearer ${secretaryToken}`)
        .send({ winnerTeamId, data })
        .expect(201);
    }

    const standingsRes = await api()
      .get(`/api/tournaments/${tournamentId}/standings`)
      .set('Authorization', `Bearer ${secretaryToken}`)
      .expect(200);

    const byName = (teamId: string) =>
      Object.entries(teamIds).find(([, id]) => id === teamId)?.[0];
    const rows = standingsRes.body.standings as {
      teamId: string;
      points: number;
      won: number;
      drawn: number;
      lost: number;
    }[];

    const alpha = rows.find((r) => byName(r.teamId) === 'Alpha')!;
    const beta = rows.find((r) => byName(r.teamId) === 'Beta')!;
    const gamma = rows.find((r) => byName(r.teamId) === 'Gamma')!;

    expect(alpha).toMatchObject({ won: 1, drawn: 1, lost: 0, points: 4 });
    expect(beta).toMatchObject({ won: 1, drawn: 0, lost: 1, points: 3 });
    expect(gamma).toMatchObject({ won: 0, drawn: 1, lost: 1, points: 1 });

    // Standings must be ranked highest points first.
    expect(rows[0].teamId).toBe(teamIds.Alpha);

    const tournamentAfter = await api()
      .get('/api/tournaments/mine')
      .set('Authorization', `Bearer ${secretaryToken}`)
      .expect(200);
    expect(tournamentAfter.body[0].status).toBe('completed');
  });
});
