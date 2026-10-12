import { IsNotEmpty, IsString } from 'class-validator';

export class SelectHostelDto {
  @IsString()
  @IsNotEmpty()
  hostelId!: string;
}
