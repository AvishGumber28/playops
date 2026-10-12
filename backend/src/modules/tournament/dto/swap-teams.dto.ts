import { IsIn, IsNotEmpty, IsString } from 'class-validator';

// D-018: the frontend's drag-and-drop swaps the teams sitting in two
// match slots. A "slot" is one side of one match - (matchId, slot).
export class SwapTeamsDto {
  @IsString()
  @IsNotEmpty({ message: 'matchAId is required.' })
  matchAId: string;

  @IsIn(['teamA', 'teamB'], { message: 'slotA must be teamA or teamB.' })
  slotA: 'teamA' | 'teamB';

  @IsString()
  @IsNotEmpty({ message: 'matchBId is required.' })
  matchBId: string;

  @IsIn(['teamA', 'teamB'], { message: 'slotB must be teamA or teamB.' })
  slotB: 'teamA' | 'teamB';
}
