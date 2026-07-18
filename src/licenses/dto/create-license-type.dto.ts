import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateLicenseTypeDto {
  @IsString()
  @IsNotEmpty()
  article!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsString()
  applicable_to?: string;

  @IsOptional()
  @IsBoolean()
  paid?: boolean;

  @IsOptional()
  @IsBoolean()
  affects_presentismo?: boolean;

  @IsOptional()
  @IsInt()
  max_days_per_year?: number;

  @IsOptional()
  @IsInt()
  max_days_per_month?: number;

  @IsOptional()
  @IsInt()
  max_days_continuous?: number;
}
