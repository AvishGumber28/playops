import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty({ message: 'A title is required.' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'A message body is required.' })
  body: string;

  // Omitted - hostel-wide, every resident of the Secretary's hostel.
  // Set - narrowed to just that tournament's approved, registered teams.
  @IsOptional()
  @IsString()
  tournamentId?: string;
}
