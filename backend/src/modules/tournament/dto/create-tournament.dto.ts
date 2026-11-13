import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTournamentDto {
  @IsString()
  @IsNotEmpty({ message: 'Tournament name is required.' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description must be 500 characters or fewer.' })
  description?: string;

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
