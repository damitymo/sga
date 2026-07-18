import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateLicenseTypeDto {
  @IsOptional()
  @IsString()
  article?: string;

  @IsOptional()
  @IsString()
  description?: string;

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

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
