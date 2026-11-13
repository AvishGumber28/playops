import { describe, it, expect } from 'vitest';
import { SCORECARD_TEMPLATES } from './scorecard-templates';

// FR-010: this file mirrors backend/src/modules/results/scorecard-
// templates.ts across the frontend/backend boundary (no shared package -
// see this file's own top comment). These invariants are exactly what
// would silently drift out of sync if one side changed without the
// other.
describe('SCORECARD_TEMPLATES', () => {
  it('only allows a draw for football', () => {
    expect(SCORECARD_TEMPLATES.football.allowDraw).toBe(true);
    expect(SCORECARD_TEMPLATES.cricket.allowDraw).toBe(false);
    expect(SCORECARD_TEMPLATES.basketball.allowDraw).toBe(false);
  });

  it("every field key is namespaced to its own team (teamA.../teamB...)", () => {
    for (const template of Object.values(SCORECARD_TEMPLATES)) {
      for (const field of template.teamAFields) {
        expect(field.key.startsWith('teamA')).toBe(true);
      }
      for (const field of template.teamBFields) {
        expect(field.key.startsWith('teamB')).toBe(true);
      }
    }
  });

  it('teamA and teamB carry the same number of fields for every sport', () => {
    for (const template of Object.values(SCORECARD_TEMPLATES)) {
      expect(template.teamAFields.length).toBe(template.teamBFields.length);
    }
  });

  it('cricket tracks runs, wickets and overs for both teams', () => {
    const keys = SCORECARD_TEMPLATES.cricket.teamAFields.map((f) => f.key);
    expect(keys).toEqual(['teamARuns', 'teamAWickets', 'teamAOvers']);
  });
});
