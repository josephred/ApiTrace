import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export const USER_ROLES = [
  'ADMIN',
  'PRODUCTOR',
  'SALA',
  'TRANSPORTISTA',
  'ACOPIADOR',
  'FRACCIONADOR',
  'LABORATORIO',
  'EXPORTADOR',
  'AUDITOR',
  'CONSULTA',
] as const;

export const ORGANIZATION_TYPES = [
  'PRODUCTOR',
  'SALA_EXTRACCION',
  'ACOPIO',
  'FRACCIONADOR',
  'LABORATORIO',
  'TRANSPORTE',
  'EXPORTADOR',
  'ADMINISTRACION',
] as const;

export class RegisterDto {
  @ApiProperty({ example: 'productor@example.com' })
  @IsEmail()
  @MaxLength(180)
  email!: string;

  @ApiProperty({ minLength: 10, example: 'ClaveSegura2026' })
  @IsString()
  @MinLength(10, { message: 'La contrasena debe tener al menos 10 caracteres.' })
  @MaxLength(100)
  password!: string;

  @ApiProperty({ example: 'Maria Gonzalez' })
  @IsString()
  @MaxLength(160)
  fullName!: string;

  @ApiPropertyOptional({
    enum: USER_ROLES,
    description: 'Solo un ADMIN puede asignar un rol distinto de CONSULTA.',
  })
  @IsOptional()
  @IsEnum(USER_ROLES)
  role?: (typeof USER_ROLES)[number];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'productor@apitrace' })
  @IsString()
  email!: string;

  @ApiProperty({ example: 'ClaveSegura2026' })
  @IsString()
  @MaxLength(100)
  password!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  refreshToken!: string;
}

export class UpdateUserRoleDto {
  @ApiProperty({ enum: USER_ROLES })
  @IsEnum(USER_ROLES)
  role!: (typeof USER_ROLES)[number];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'DISABLED'] })
  @IsOptional()
  @IsEnum(['PENDING', 'ACTIVE', 'SUSPENDED', 'DISABLED'])
  status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
}

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Apiarios del Sur SRL' })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @ApiPropertyOptional({ example: '30-71234567-9' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  taxId?: string;

  @ApiProperty({ enum: ORGANIZATION_TYPES })
  @IsEnum(ORGANIZATION_TYPES)
  type!: (typeof ORGANIZATION_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;
}
