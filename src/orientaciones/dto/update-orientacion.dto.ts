import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateOrientacionDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  nivel?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
