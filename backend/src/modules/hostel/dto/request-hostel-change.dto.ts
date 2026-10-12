import { IsNotEmpty, IsString } from 'class-validator';

export class RequestHostelChangeDto {
  @IsString()
  @IsNotEmpty()
  requestedHostelId!: string;
}
