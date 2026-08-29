import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class SignupDto {
  @IsNotEmpty({ message: 'Name is required.' })
  name: string;

  @IsEmail({}, { message: 'A valid email address is required.' })
  email: string;

  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  password: string;
}
