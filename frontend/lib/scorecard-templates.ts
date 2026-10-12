// FR-010. Mirrors backend/src/modules/results/scorecard-templates.ts -
// same duplication-across-the-boundary this project already accepts for
// enum-shaped values (no shared package between frontend/backend; see
// lib/venue-constants.ts's SLOT_HOURS for the established precedent).
export type ScorecardField = { key: string; label: string };

export type ScorecardTemplate = {
  allowDraw: boolean;
  teamAFields: ScorecardField[];
  teamBFields: ScorecardField[];
};

export const SCORECARD_TEMPLATES: Record<string, ScorecardTemplate> = {
  cricket: {
    allowDraw: false,
    teamAFields: [
      { key: 'teamARuns', label: 'Runs' },
      { key: 'teamAWickets', label: 'Wickets' },
      { key: 'teamAOvers', label: 'Overs' },
    ],
    teamBFields: [
      { key: 'teamBRuns', label: 'Runs' },
      { key: 'teamBWickets', label: 'Wickets' },
      { key: 'teamBOvers', label: 'Overs' },
    ],
  },
  football: {
    allowDraw: true,
    teamAFields: [{ key: 'teamAGoals', label: 'Goals' }],
    teamBFields: [{ key: 'teamBGoals', label: 'Goals' }],
  },
  basketball: {
    allowDraw: false,
    teamAFields: [{ key: 'teamAPoints', label: 'Points' }],
    teamBFields: [{ key: 'teamBPoints', label: 'Points' }],
  },
};
