import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateEstablecimientoDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  cue?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
