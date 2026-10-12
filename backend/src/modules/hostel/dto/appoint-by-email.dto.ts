import { IsEmail, IsNotEmpty } from 'class-validator';

// Shared by all four appointment endpoints (Secretary/Proctor/Gym
// Secretary/Mess Secretary, D-011) - the Caretaker identifies the
// appointee by their college email rather than picking from a fetched
// roster.
export class AppointByEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
