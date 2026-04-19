import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  full_name!: string;

  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  @IsIn(['ADMIN', 'ADMINISTRATIVO', 'AGENTE'])
  role?: 'ADMIN' | 'ADMINISTRATIVO' | 'AGENTE';

  @IsOptional()
  @IsInt()
  agent_id?: number;
}
