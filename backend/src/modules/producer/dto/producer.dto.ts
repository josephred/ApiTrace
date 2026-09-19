import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

/** CUIT/CUIL argentino: 11 digitos, con o sin guiones. */
export const CUIT_REGEX = /^\d{2}-?\d{8}-?\d$/;

export class CreateProducerDto {
  @ApiProperty({ example: 'Apicultura Los Talas' })
  @IsString()
  @MaxLength(200)
  businessName!: string;

  @ApiPropertyOptional({ enum: ['FISICA', 'JURIDICA'], default: 'FISICA' })
  @IsOptional()
  @IsEnum(['FISICA', 'JURIDICA'])
  personType?: 'FISICA' | 'JURIDICA';

  @ApiPropertyOptional({ example: '20-12345678-9', description: 'CUIT. Identificador fiscal externo, nunca PK.' })
  @IsOptional()
  @Matches(CUIT_REGEX, { message: 'El CUIT debe tener 11 digitos (formato 20-12345678-9).' })
  taxId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Solo ADMIN puede crear en otra organizacion.' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

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

  @ApiPropertyOptional({ example: 'Buenos Aires' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string;

  @ApiPropertyOptional({ example: 'Lujan' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  locality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateProducerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessName?: string;

  @ApiPropertyOptional({ enum: ['FISICA', 'JURIDICA'] })
  @IsOptional()
  @IsEnum(['FISICA', 'JURIDICA'])
  personType?: 'FISICA' | 'JURIDICA';

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(CUIT_REGEX, { message: 'El CUIT debe tener 11 digitos (formato 20-12345678-9).' })
  taxId?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  locality?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] })
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

/** CU-05: el RENAPA es un registro propio, no un campo del productor. */
export class AssociateRenapaDto {
  @ApiProperty({ example: 'RENAPA-2026-004512' })
  @IsString()
  @MaxLength(60)
  number!: string;

  @ApiPropertyOptional({
    enum: ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED'],
    default: 'PENDING_VERIFICATION',
    description:
      'Mientras no exista integracion con SENASA el alta queda PENDING_VERIFICATION.',
  })
  @IsOptional()
  @IsEnum(['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED'])
  status?: 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @ApiPropertyOptional({ description: 'Origen del dato cuando se carga manualmente.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  sourceNote?: string;
}

export class UpsertSenasaDelegationDto {
  @ApiProperty({ enum: ['SIGSA_DTE', 'SITA'], example: 'SIGSA_DTE' })
  @IsEnum(['SIGSA_DTE', 'SITA'])
  service!: 'SIGSA_DTE' | 'SITA';

  @ApiProperty({
    enum: ['NO_INICIADA', 'PENDIENTE', 'ACEPTADA', 'REVOCADA', 'RECHAZADA'],
    example: 'ACEPTADA',
  })
  @IsEnum(['NO_INICIADA', 'PENDIENTE', 'ACEPTADA', 'REVOCADA', 'RECHAZADA'])
  status!: 'NO_INICIADA' | 'PENDIENTE' | 'ACEPTADA' | 'REVOCADA' | 'RECHAZADA';

  @ApiPropertyOptional({ example: '30-71829384-5', description: 'CUIT de la empresa delegada en ARCA' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  delegatedToTaxId?: string;

  @ApiPropertyOptional({ example: 'F3283-99481', description: 'Numero de formulario F3283/E de ARCA' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  formNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(600)
  notes?: string;
}

