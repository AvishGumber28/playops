import { IsDateString, IsIn } from 'class-validator';
import { SLOT_HOURS } from '../venue.constants';

export class RequestVenueDto {
  @IsDateString({}, { message: 'A valid date is required.' })
  date: string;

  @IsIn(SLOT_HOURS, { message: 'hour must be one of the fixed 1-hour slots.' })
  hour: string;
}
