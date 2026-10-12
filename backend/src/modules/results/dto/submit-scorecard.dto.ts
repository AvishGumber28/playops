import { IsObject, IsString, ValidateIf } from 'class-validator';

// The per-sport field set inside `data` isn't decorator-validatable (it
// depends on which sport the match belongs to) - ResultsService checks
// that against the sport's own scorecard template. `winnerTeamId` is
// nullable (a draw), but only ever a string when it isn't null.
export class SubmitScorecardDto {
  @ValidateIf((o: SubmitScorecardDto) => o.winnerTeamId !== null)
  @IsString()
  winnerTeamId: string | null;

  @IsObject()
  data: Record<string, number>;
}
