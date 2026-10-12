import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateEquipmentItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Item name is required.' })
  name: string;

  @IsInt()
  @Min(1, { message: 'Starting quantity must be at least 1.' })
  totalQuantity: number;
}
