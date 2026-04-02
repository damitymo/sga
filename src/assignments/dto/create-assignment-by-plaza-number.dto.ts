import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAssignmentByPlazaNumberDto {
  @IsInt()
  agent_id!: number;

  @IsString()
  @IsNotEmpty()
  plaza_number!: string;

  @IsString()
  @IsIn(['DESIGNACION', 'BAJA'])
  movement_type!: 'DESIGNACION' | 'BAJA';

  @IsOptional()
  @IsString()
  @IsIn(['DECRETO', 'RESOLUCION_MINISTERIAL', 'DISPOSICION', 'RI'])
  legal_norm_type?: 'DECRETO' | 'RESOLUCION_MINISTERIAL' | 'DISPOSICION' | 'RI';

  @IsOptional()
  @IsString()
  legal_norm_number?: string;

  @IsOptional()
  @IsString()
  assignment_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;

  @IsOptional()
  @IsString()
  @IsIn(['TITULAR', 'INTERINO', 'SUPLENTE'])
  character_type?: 'TITULAR' | 'INTERINO' | 'SUPLENTE';

  @IsOptional()
  @IsString()
  status?: 'ACTIVA' | 'FINALIZADA';

  @IsOptional()
  @IsString()
  notes?: string;
}
