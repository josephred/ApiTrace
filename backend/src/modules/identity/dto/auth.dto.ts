import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
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

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * «Creá tu cuenta»: alta del apicultor desde el telefono (migracion 0003).
 *
 * Nombre, CUIT, RENAPA y contrasena. La cuenta nace activa como PRODUCTOR,
 * con su organizacion, su ficha de productor y el RENAPA «pendiente de
 * verificacion»: puede cargar apiarios y armar DT-e, pero SIGSA no emite hasta
 * que el RENAPA este habilitado y la delegacion aceptada.
 */
export class SignupDto {
  @ApiProperty({ example: 'Juan Perez' })
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'Escribi el nombre completo.' })
  @MaxLength(160)
  fullName!: string;

  @ApiProperty({ example: '20-12345678-6', description: 'CUIT con o sin guiones.' })
  @Transform(trim)
  @IsString()
  @Matches(/^[\d\s.-]{11,16}$/, { message: 'La CUIT tiene 11 digitos.' })
  taxId!: string;

  @ApiProperty({ example: 'B53999', description: 'Numero de RENAPA del productor.' })
  @Transform(trim)
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9 ./-]{1,58}$/, {
    message: 'El RENAPA lleva letras y numeros (por ejemplo B53999).',
  })
  renapa!: string;

  @ApiProperty({ minLength: 8, example: 'Colmena2026' })
  @IsString()
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres.' })
  @MaxLength(100)
  password!: string;
}

export class LoginDto {
  @ApiProperty({
    example: 'productor@apitrace',
    description: 'Correo, CUIT (11 digitos, con o sin guiones) o nombre corto de las cuentas demo.',
  })
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
