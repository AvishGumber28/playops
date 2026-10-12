// FR-010: which `data` fields a scorecard needs, and whether the sport
// permits a draw (`winnerTeamId: null`), keyed by Sport.scorecardTemplate
// (seeded as 'cricket' | 'football' | 'basketball' - see prisma/seed.ts).
// Adding a sport with a new template is a data change (seed a new Sport
// row) plus one new entry here - not a schema change, matching how the
// Sport table itself is documented to extend (database-design.md).
export type ScorecardTemplate = {
  fields: string[];
  allowDraw: boolean;
};

export const SCORECARD_TEMPLATES: Record<string, ScorecardTemplate> = {
  cricket: {
    fields: [
      'teamARuns',
      'teamAWickets',
      'teamAOvers',
      'teamBRuns',
      'teamBWickets',
      'teamBOvers',
    ],
    allowDraw: false,
  },
  football: {
    fields: ['teamAGoals', 'teamBGoals'],
    allowDraw: true,
  },
  basketball: {
    fields: ['teamAPoints', 'teamBPoints'],
    allowDraw: false,
  },
};
