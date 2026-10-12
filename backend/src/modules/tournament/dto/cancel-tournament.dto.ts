import { IsNotEmpty, IsString } from 'class-validator';

export class CancelTournamentDto {
  @IsString()
  @IsNotEmpty({ message: 'A cancellation reason is required.' })
  reason: string;
}
