import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateAssignmentDto {
  @IsOptional()
  @IsString()
  @IsIn(['DESIGNACION', 'BAJA'])
  movement_type?: 'DESIGNACION' | 'BAJA';

  @IsOptional()
  @IsString()
  resolution_number?: string;

  @IsOptional()
  @IsString()
  legal_norm?: string;

  @IsOptional()
  @IsString()
  @IsIn(['DECRETO', 'RESOLUCION_MINISTERIAL', 'DISPOSICION', 'RI'])
  legal_norm_type?: 'DECRETO' | 'RESOLUCION_MINISTERIAL' | 'DISPOSICION' | 'RI';

  @IsOptional()
  @IsString()
  legal_norm_number?: string;

  @IsOptional()
  @IsString()
  @IsIn(['TITULAR', 'INTERINO', 'SUPLENTE'])
  character_type?: 'TITULAR' | 'INTERINO' | 'SUPLENTE';

  @IsOptional()
  @IsString()
  assignment_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ACTIVA', 'FINALIZADA'])
  status?: 'ACTIVA' | 'FINALIZADA';

  @IsOptional()
  @IsString()
  notes?: string;
}
