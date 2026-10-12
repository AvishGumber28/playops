import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class SignupDto {
  @IsNotEmpty({ message: 'Name is required.' })
  name: string;

  @IsEmail({}, { message: 'A valid email address is required.' })
  email: string;

  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  password: string;

  // D-012: self-reported, optional - nothing about a valid PlayOps
  // account requires either of these. photoUrl is a link to an image,
  // not an uploaded file (no file storage in this project), so it's
  // just a string, not validated as a strict URL - keeping this lenient
  // matters more here than rejecting a slightly malformed link.
  @IsOptional()
  @IsString()
  rollNumber?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}
