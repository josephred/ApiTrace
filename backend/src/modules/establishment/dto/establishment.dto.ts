import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

const REGISTRATION_STATUSES = [
  'PENDING_VERIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'EXPIRED',
  'CANCELLED',
] as const;

/** Habilitacion SENASA del establecimiento (la sala es el destino del DT-e API-SEM). */
class EstablishmentSenasaFields {
  @ApiPropertyOptional({
    example: 'SEF-B-20010',
    description: 'Codigo SENASA del establecimiento habilitado (sala: SEF-Letra-N°).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  senasaCode?: string;

  @ApiPropertyOptional({ enum: REGISTRATION_STATUSES, default: 'PENDING_VERIFICATION' })
  @IsOptional()
  @IsEnum(REGISTRATION_STATUSES)
  senasaStatus?: (typeof REGISTRATION_STATUSES)[number];

  @ApiPropertyOptional({ example: '2027-12-31', description: 'Vigencia de la habilitacion (YYYY-MM-DD).' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'senasaValidTo debe tener el formato YYYY-MM-DD' })
  senasaValidTo?: string;
}

export const ESTABLISHMENT_TYPES = [
  'APIARIO_BASE',
  'SALA_EXTRACCION',
  'ACOPIO',
  'FRACCIONADORA',
  'DEPOSITO',
  'LABORATORIO',
  'OTRO',
] as const;

export class CreateEstablishmentDto extends EstablishmentSenasaFields {
  @ApiProperty({ example: 'Sala de Extraccion San Andres' })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ enum: ESTABLISHMENT_TYPES })
  @IsEnum(ESTABLISHMENT_TYPES)
  type!: (typeof ESTABLISHMENT_TYPES)[number];

  @ApiPropertyOptional({ format: 'uuid', description: 'Productor responsable, si corresponde.' })
  @IsOptional()
  @IsUUID()
  producerId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Solo ADMIN puede crear en otra organizacion.' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  locality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string;

  @ApiPropertyOptional({ example: -34.5703 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: -59.1053 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ description: 'RNE (SIFeGA). Referencia externa, no PK.' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  rne?: string;
}

export class UpdateEstablishmentDto extends EstablishmentSenasaFields {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ enum: ESTABLISHMENT_TYPES })
  @IsOptional()
  @IsEnum(ESTABLISHMENT_TYPES)
  type?: (typeof ESTABLISHMENT_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  locality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  rne?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] })
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

/** CU-06: el RENSPA vincula productor, actividad y establecimiento. */
export class AssociateRenspaDto {
  @ApiProperty({ example: '01.002.0.00123/45' })
  @IsString()
  @MaxLength(60)
  number!: string;

  @ApiProperty({ format: 'uuid', description: 'Productor titular del RENSPA.' })
  @IsUUID()
  producerId!: string;

  @ApiPropertyOptional({ example: 'Apicola' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  activity?: string;

  @ApiPropertyOptional({
    enum: ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED'],
  })
  @IsOptional()
  @IsEnum(['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED'])
  status?: 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  validTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  sourceNote?: string;
}

/** Destinos habilitados de cualquier organizacion (hallazgo H-02 de la guia de pantallas). */
export class ListReceiversQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['SALA_EXTRACCION', 'ACOPIO', 'FRACCIONADORA'], default: 'SALA_EXTRACCION' })
  @IsOptional()
  @IsEnum(['SALA_EXTRACCION', 'ACOPIO', 'FRACCIONADORA'])
  type?: 'SALA_EXTRACCION' | 'ACOPIO' | 'FRACCIONADORA';
}
