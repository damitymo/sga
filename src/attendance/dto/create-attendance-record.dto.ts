import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAttendanceRecordDto {
  @IsInt()
  agent_id!: number;

  @IsDateString()
  @IsNotEmpty()
  attendance_date!: string;

  // Status/condition_type/shift llegan como string y los normaliza el service
  // (acepta aliases tipo 'P', 'IJ', 'TM', etc.), así que no los tipamos como enum acá.
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
