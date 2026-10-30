import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { PhotoInputDto } from '../../media/dto/photo.dto';

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

  @ApiPropertyOptional({ type: PhotoInputDto, description: 'Foto de la sala (o del lugar).' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PhotoInputDto)
  photo?: PhotoInputDto;
}

/**
 * RENSPA del campo tal como lo informa el apicultor: numeros con puntos, barra
 * o guiones (ej. 01.002.0.00123/45). Se controla la forma, no el padron.
 */
export const FIELD_RENSPA = /^[0-9][0-9 ./-]{6,58}[0-9]$/;

/** Los espacios de los bordes no cuentan: «  01.002.0.00123/45 » es valido. */
const trimRenspa = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

/**
 * «Finca / Polinizacion» (doc 14): la zona del apicultor, las colmenas que
 * lleva a polinizar y el RENSPA del campo. La zona sirve para cualquier
 * establecimiento; colmenas y RENSPA del campo, solo para la finca.
 */
class EstablishmentPlaceFields extends EstablishmentSenasaFields {
  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Zona existente; null la quita.' })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  zoneId?: string | null;

  @ApiPropertyOptional({ example: 'Valle de Uco', description: 'Zona nueva (o existente) por nombre.' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  zoneName?: string;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 100000,
    description: 'Colmenas que el apicultor lleva a polinizar (solo FINCA_POLINIZACION).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  hiveCount?: number;

  @ApiPropertyOptional({
    example: '01.002.0.00123/45',
    nullable: true,
    description: 'RENSPA del campo, opcional (solo FINCA_POLINIZACION). Vacio o null lo quita.',
  })
  @IsOptional()
  @Transform(trimRenspa)
  @ValidateIf((_object, value) => value !== null && value !== '')
  @IsString()
  @MaxLength(60)
  @Matches(FIELD_RENSPA, {
    message: 'renspaNumber: el RENSPA son numeros con puntos y barra (ej. 01.002.0.00123/45).',
  })
  renspaNumber?: string | null;
}

export const ESTABLISHMENT_TYPES = [
  'APIARIO_BASE',
  'SALA_EXTRACCION',
  'ACOPIO',
  'FRACCIONADORA',
  'DEPOSITO',
  'LABORATORIO',
  'OTRO',
  'FINCA_POLINIZACION',
] as const;

export class CreateEstablishmentDto extends EstablishmentPlaceFields {
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

export class UpdateEstablishmentDto extends EstablishmentPlaceFields {
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
