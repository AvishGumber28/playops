import { IsNotEmpty, IsString } from 'class-validator';

export class CancelMatchDto {
  @IsString()
  @IsNotEmpty({ message: 'A cancellation reason is required.' })
  reason: string;
}
