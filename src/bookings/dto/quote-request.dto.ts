import {
  IsEnum,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ServiceType, VehicleType } from '../../common/enums';
import { LocationDto } from './location.dto';

export class QuoteRequestDto {
  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @ValidateNested()
  @Type(() => LocationDto)
  pickupLocation: LocationDto;

  @ValidateNested()
  @Type(() => LocationDto)
  dropoffLocation: LocationDto;

  @IsDateString()
  pickupDatetime: string;

  @IsNumber()
  @Min(1)
  @Max(16)
  passengerCount: number;

  @IsNumber()
  @Min(0)
  luggageCount: number;

  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @IsBoolean()
  @IsOptional()
  hasMeetAndGreet?: boolean;

  @IsBoolean()
  @IsOptional()
  isReturnJourney?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocationDto)
  @IsOptional()
  viaPoints?: LocationDto[];
}
