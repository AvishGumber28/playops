import { IsDateString, IsIn, IsNotEmpty, IsString } from 'class-validator';

export class CreateTournamentDto {
  @IsString()
  @IsNotEmpty({ message: 'Tournament name is required.' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'A sport is required.' })
  sportId: string;

  @IsIn(['knockout', 'league'], {
    message: 'Format must be knockout or league.',
  })
  format: 'knockout' | 'league';

  // ISO date/datetime string from the frontend - the service parses it
  // and rejects anything in the past (FR-005).
  @IsDateString({}, { message: 'A valid registration deadline is required.' })
  registrationDeadline: string;
}
