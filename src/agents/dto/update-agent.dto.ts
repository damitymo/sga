import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsString()
  dni?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsDateString()
  birth_date?: string;

  @IsOptional()
  @IsString()
  sex?: string;

  @IsOptional()
  @IsString()
  marital_status?: string;

  @IsOptional()
  @IsString()
  birth_place?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  teaching_file_number?: string;

  @IsOptional()
  @IsString()
  board_file_number?: string;

  @IsOptional()
  @IsString()
  secondary_board_number?: string;

  @IsOptional()
  @IsDateString()
  school_entry_date?: string;

  @IsOptional()
  @IsDateString()
  teaching_entry_date?: string;

  @IsOptional()
  @IsString()
  titles?: string;

  @IsOptional()
  @IsString()
  identity_card_number?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  legal_norm_type?: string;

  @IsOptional()
  @IsString()
  legal_norm_number?: string;

  @IsOptional()
  @IsString()
  character_type?: string;
}
