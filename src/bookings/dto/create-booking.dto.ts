import {
  IsEnum,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsString,
  IsEmail,
  IsArray,
  ValidateNested,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ServiceType, VehicleType } from '../../common/enums';
import { LocationDto } from './location.dto';
import { SpecialRequirementsDto } from './special-requirements.dto';

export class CreateBookingDto {
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

  @IsString()
  @IsOptional()
  flightNumber?: string;

  @IsString()
  @IsOptional()
  terminal?: string;

  @IsBoolean()
  @IsOptional()
  hasMeetAndGreet?: boolean;

  @ValidateNested()
  @Type(() => SpecialRequirementsDto)
  @IsOptional()
  specialRequirements?: SpecialRequirementsDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocationDto)
  @IsOptional()
  viaPoints?: LocationDto[];

  // Customer Details
  @IsString()
  @MinLength(1)
  customerName: string;

  @IsEmail()
  customerEmail: string;

  @IsString()
  @MinLength(10)
  customerPhone: string;

  // Return Journey
  @IsBoolean()
  @IsOptional()
  isReturnJourney?: boolean;

  @IsDateString()
  @IsOptional()
  returnPickupDatetime?: string;
}
