import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCursoDto {
  @IsString()
  @IsNotEmpty()
  nivel!: string;

  @IsString()
  @IsNotEmpty()
  anio!: string;

  @IsOptional()
  @IsString()
  division?: string;

  @IsOptional()
  @IsInt()
  orientacion_id?: number;

  @IsInt()
  @IsNotEmpty()
  establecimiento_id!: number;
}
