import {
  IsDateString,
  IsNumber,
  IsOptional,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SpecialRequirementsDto } from './special-requirements.dto';

export class UpdateBookingDto {
  @IsDateString()
  @IsOptional()
  pickupDatetime?: string;

  @IsNumber()
  @Min(1)
  @Max(16)
  @IsOptional()
  passengerCount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  luggageCount?: number;

  @ValidateNested()
  @Type(() => SpecialRequirementsDto)
  @IsOptional()
  specialRequirements?: SpecialRequirementsDto;
}
