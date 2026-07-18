import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateLicenseDto {
  @IsInt()
  @IsNotEmpty()
  agent_id!: number;

  @IsInt()
  @IsNotEmpty()
  license_type_id!: number;

  @IsDateString()
  start_date!: string;

  @IsDateString()
  end_date!: string;

  @IsOptional()
  @IsString()
  observations?: string;
}
