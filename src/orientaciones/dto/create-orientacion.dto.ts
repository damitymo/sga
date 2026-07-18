import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateOrientacionDto {
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsOptional()
  @IsString()
  nivel?: string;
}
