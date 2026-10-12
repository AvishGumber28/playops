import { IsDateString, IsIn, IsNotEmpty, IsString } from 'class-validator';
import { SLOT_HOURS } from '../../venue/venue.constants';

export class ScheduleMatchDto {
  @IsString()
  @IsNotEmpty({ message: 'A venue is required.' })
  venueId: string;

  @IsDateString({}, { message: 'A valid date is required.' })
  date: string;

  @IsIn(SLOT_HOURS, { message: 'hour must be one of the fixed 1-hour slots.' })
  hour: string;
}
