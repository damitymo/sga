import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateLicenseDto {
  @IsOptional()
  @IsInt()
  agent_id?: number;

  @IsOptional()
  @IsInt()
  license_type_id?: number;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsString()
  observations?: string;
}
