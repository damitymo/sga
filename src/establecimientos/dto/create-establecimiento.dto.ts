import { IsNotEmpty, IsString } from 'class-validator';

export class CreateEstablecimientoDto {
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  cue!: string;
}
