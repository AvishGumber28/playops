import { IsEmail, IsNotEmpty } from 'class-validator';

export class AddPlayerDto {
  @IsEmail({}, { message: 'A valid student email is required.' })
  @IsNotEmpty()
  email: string;
}
