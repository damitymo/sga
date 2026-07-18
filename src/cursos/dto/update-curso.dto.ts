import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateCursoDto {
  @IsOptional()
  @IsString()
  nivel?: string;

  @IsOptional()
  @IsString()
  anio?: string;

  @IsOptional()
  @IsString()
  division?: string;

  @IsOptional()
  @IsInt()
  orientacion_id?: number;

  @IsOptional()
  @IsInt()
  establecimiento_id?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
