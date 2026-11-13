import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RequestEquipmentDto {
  @IsInt()
  @Min(1, { message: 'Quantity must be at least 1.' })
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Reason must be 200 characters or fewer.' })
  reason?: string;
}
