import { IsNumber, IsBoolean, IsOptional, Min } from 'class-validator';

export class SpecialRequirementsDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  childSeats?: number;

  @IsBoolean()
  @IsOptional()
  wheelchairAccess?: boolean;

  @IsBoolean()
  @IsOptional()
  pets?: boolean;
}
