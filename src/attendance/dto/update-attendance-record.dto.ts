import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateAttendanceRecordDto {
  @IsOptional()
  @IsInt()
  agent_id?: number;

  @IsOptional()
  @IsDateString()
  attendance_date?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  raw_code?: string;

  @IsOptional()
  @IsString()
  condition_type?: string;

  @IsOptional()
  @IsString()
  shift?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  source_sheet_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  source_agent_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  source_dni?: string;

  @IsOptional()
  @IsString()
  observation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  import_batch_id?: string;
}
