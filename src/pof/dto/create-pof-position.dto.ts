import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePofPositionDto {
  @IsString()
  @IsNotEmpty()
  plaza_number!: string;

  @IsOptional()
  @IsString()
  subject_name?: string;

  @IsOptional()
  @IsInt()
  hours_count?: number;

  @IsOptional()
  @IsString()
  course?: string;

  @IsOptional()
  @IsString()
  division?: string;

  @IsOptional()
  @IsString()
  shift?: string;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsString()
  revista_status?: string;

  @IsOptional()
  @IsString()
  legal_norm?: string;

  @IsOptional()
  @IsString()
  vacancy_status?: string;

  @IsOptional()
  @IsString()
  modality?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
