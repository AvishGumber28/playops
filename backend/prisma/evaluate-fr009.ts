import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { HostelService } from '../src/modules/hostel/hostel.service';
import { TeamService } from '../src/modules/tournament/team.service';
import { TournamentService } from '../src/modules/tournament/tournament.service';
import { FixtureService } from '../src/modules/tournament/fixture.service';
import { MatchSchedulingService } from '../src/modules/scheduling/match-scheduling.service';
import { ConflictService } from '../src/modules/scheduling/conflict.service';
import { SLOT_HOURS, splitHour } from '../src/modules/venue/venue.constants';

// Phase 17: generates real, measurable evidence for FR-009 (the Conflict
// Detection & Rescheduling Engine - this project's stated core technical
// contribution), by actually driving the real service layer through
// deliberately engineered scenarios and reading back what really
// happened. Run against the LOCAL DEV database only - never production -
// and everything it creates lives under one clearly-named tournament per
// scenario, queryable in isolation from any other data in that database.
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
  const schedulingSvc = app.get(MatchSchedulingService, { strict: false });
  const conflictSvc = app.get(ConflictService, { strict: false });

  const stamp = Date.now();
  const hostel = await prisma.hostel.findUniqueOrThrow({ where: { code: 'A' } });
  const caretaker = await prisma.user.findUniqueOrThrow({
    where: { email: 'ACaretaker@thapar.edu' },
  });
  const football = await prisma.sport.findUniqueOrThrow({ where: { name: 'Football' } });
  const footballGround = await prisma.venue.findUniqueOrThrow({
    where: { name: 'Football Ground' },
  });
  const cricketGround = await prisma.venue.findUniqueOrThrow({
    where: { name: 'Cricket Ground' },
  });

  function daysFromNow(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  async function student(label: string): Promise<string> {
    const email = `fr009.${label}.${stamp}@thapar.edu`;
    const { user } = await auth.signup({ name: `FR009 ${label}`, email, password: 'EvalPass123!' });
    await hostelSvc.selectHostel(user.id, hostel.id);
    return user.id;
  }

  const secretaryId = await student('secretary');
  await hostelSvc.appointSecretary(
    caretaker.id,
    hostel.id,
    `fr009.secretary.${stamp}@thapar.edu`,
  );

  const teamCaptains = await Promise.all(
    ['t1', 't2', 't3', 't4'].map((label) => student(label)),
  );

  // ---- Scenario A: league tournament, two matches engineered to share a
  // team at the same date+time but different venues - the venue check
  // can't catch this (different venues), only the team check can. ----

  const leagueCup = await tournamentSvc.createTournament(secretaryId, {
    name: `FR009 Eval League ${stamp}`,
    sportId: football.id,
    format: 'league',
    registrationDeadline: daysFromNow(1),
  });
  const leagueTeamIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const created = await teamSvc.createTeam(teamCaptains[i], leagueCup.id, {
      name: `FR009 League Team ${i + 1}`,
    });
    leagueTeamIds.push(created.id);
  }
  const leagueFixtures = await fixtureSvc.generateFixtures(secretaryId, leagueCup.id);
  const leagueMatches = leagueFixtures.rounds.flatMap((r) => r.matches);

  // Find two matches from different rounds that share a team.
  let clashA: (typeof leagueMatches)[number] | null = null;
  let clashB: (typeof leagueMatches)[number] | null = null;
  outer: for (const a of leagueMatches) {
    for (const b of leagueMatches) {
      if (a.id === b.id || a.round === b.round) continue;
      const teamsA = [a.teamA!.id, a.teamB!.id];
      if (teamsA.includes(b.teamA!.id) || teamsA.includes(b.teamB!.id)) {
        clashA = a;
        clashB = b;
        break outer;
      }
    }
  }
  if (!clashA || !clashB) throw new Error('Could not find two matches sharing a team.');

  const clashDate = daysFromNow(5);
  await schedulingSvc.scheduleMatch(secretaryId, clashA.id, {
    venueId: footballGround.id,
    date: clashDate,
    hour: '09:00-10:00',
  });
  await schedulingSvc.scheduleMatch(secretaryId, clashB.id, {
    venueId: cricketGround.id, // different venue - venue check won't fire
    date: clashDate,
    hour: '09:00-10:00', // same date+time - team check should fire
  });
  // Also schedule one more, genuinely non-conflicting match, to confirm
  // the scan doesn't false-positive on unrelated matches.
  const clean = leagueMatches.find((m) => m.id !== clashA!.id && m.id !== clashB!.id);
  if (clean) {
    await schedulingSvc.scheduleMatch(secretaryId, clean.id, {
      venueId: footballGround.id,
      date: daysFromNow(6),
      hour: '10:00-11:00',
    });
  }

  const scanResult = await conflictSvc.checkTournament(secretaryId, leagueCup.id);
  const loggedForLeague = await conflictSvc.getConflicts(secretaryId, leagueCup.id);

  // ---- Scenario B: cancel a scheduled match with a free venue calendar -
  // the engine should find and apply a real alternative slot. ----

  const cupB = await tournamentSvc.createTournament(secretaryId, {
    name: `FR009 Eval Reschedule-OK ${stamp}`,
    sportId: football.id,
    format: 'knockout',
    registrationDeadline: daysFromNow(1),
  });
  const bTeams: string[] = [];
  for (let i = 0; i < 4; i++) {
    const created = await teamSvc.createTeam(teamCaptains[i], cupB.id, {
      name: `FR009 B Team ${i + 1}`,
    });
    bTeams.push(created.id);
  }
  const bFixtures = await fixtureSvc.generateFixtures(secretaryId, cupB.id);
  const bMatch = bFixtures.rounds[0].matches[0];
  await schedulingSvc.scheduleMatch(secretaryId, bMatch.id, {
    venueId: footballGround.id,
    date: daysFromNow(10),
    hour: '14:00-15:00',
  });
  const cancelOk = await schedulingSvc.cancelMatch(secretaryId, bMatch.id, {
    reason: 'FR-009 evaluation: venue double-booked by mistake.',
  });

  // ---- Scenario C: cancel a scheduled match whose venue's entire 30-day
  // window is already saturated - the engine should correctly report no
  // alternative found, not silently fail or invent one. The saturation
  // itself is a deliberately engineered fixture (bulk-inserted directly,
  // bypassing the normal request/approve flow purely to set up this
  // boundary condition fast), not a naturally-occurring scenario. ----

  const cupC = await tournamentSvc.createTournament(secretaryId, {
    name: `FR009 Eval Reschedule-FAIL ${stamp}`,
    sportId: football.id,
    format: 'knockout',
    registrationDeadline: daysFromNow(1),
  });
  const cTeams: string[] = [];
  for (let i = 0; i < 4; i++) {
    const created = await teamSvc.createTeam(teamCaptains[i], cupC.id, {
      name: `FR009 C Team ${i + 1}`,
    });
    cTeams.push(created.id);
  }
  const cFixtures = await fixtureSvc.generateFixtures(secretaryId, cupC.id);
  const cMatch = cFixtures.rounds[0].matches[0];
  const cBaseDate = daysFromNow(20);
  await schedulingSvc.scheduleMatch(secretaryId, cMatch.id, {
    venueId: cricketGround.id,
    date: cBaseDate,
    hour: '09:00-10:00',
  });

  // Saturate every slot in the 30-day search window at Cricket Ground,
  // for every day EXCEPT today's own booking above (avoiding a unique
  // partial-index collision with it).
  const saturationRows: { venueId: string; date: Date; startTime: string; endTime: string; status: string; source: string }[] = [];
  const base = new Date(cBaseDate);
  for (let offset = 1; offset <= 30; offset++) {
    const d = new Date(base);
    d.setDate(d.getDate() + offset);
    for (const hour of SLOT_HOURS) {
      const [startTime, endTime] = splitHour(hour);
      saturationRows.push({
        venueId: cricketGround.id,
        date: d,
        startTime,
        endTime,
        status: 'approved',
        source: 'admin_manual',
      });
    }
  }
  await prisma.venueBooking.createMany({ data: saturationRows });

  const cancelFail = await schedulingSvc.cancelMatch(secretaryId, cMatch.id, {
    reason: 'FR-009 evaluation: venue double-booked, but every nearby slot is already full.',
  });

  // ---- Real measured results ----

  console.log('\n=== FR-009 evaluation results (real, measured) ===\n');
  console.log('Scenario A - proactive team-clash detection:');
  console.log(`  Conflicts returned by checkTournament(): ${scanResult.conflicts.length}`);
  console.log(`  ConflictLog rows persisted: ${loggedForLeague.length}`);
  console.log(`  Types logged: ${loggedForLeague.map((c) => c.type).join(', ')}`);
  console.log(`  Clean (non-conflicting) match correctly NOT flagged: ${scanResult.conflicts.length === 1 ? 'yes' : 'NO - unexpected'}`);

  console.log('\nScenario B - cancellation with a free venue calendar:');
  console.log(`  cancelled: ${cancelOk.cancelled}`);
  console.log(`  rescheduled: ${cancelOk.rescheduled !== null}`);
  console.log(`  message: ${cancelOk.message}`);

  console.log('\nScenario C - cancellation with a saturated venue calendar:');
  console.log(`  Saturation rows inserted: ${saturationRows.length}`);
  console.log(`  cancelled: ${cancelFail.cancelled}`);
  console.log(`  rescheduled: ${cancelFail.rescheduled !== null}`);
  console.log(`  message: ${cancelFail.message}`);

  const allEvalConflictLogs = await prisma.conflictLog.count({
    where: { tournamentId: { in: [leagueCup.id, cupB.id, cupC.id] } },
  });
  const byResolution = await prisma.conflictLog.groupBy({
    by: ['resolution'],
    where: { tournamentId: { in: [leagueCup.id, cupB.id, cupC.id] } },
    _count: true,
  });
  console.log(`\nTotal ConflictLog rows across all 3 scenarios: ${allEvalConflictLogs}`);
  console.log('Breakdown by resolution:', JSON.stringify(byResolution, null, 2));

  await app.close();
}

main().catch((e) => {
  console.error('FR-009 evaluation failed:', e);
  process.exit(1);
});
