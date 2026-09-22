import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DteTransportDto } from './dte.dto';

export const MOVEMENT_TYPES = [
  'MATERIAL_MELARIO',
  'MIEL_A_GRANEL',
  'PRODUCTO_FRACCIONADO',
  'MATERIAL_VIVO',
  'MATERIAL_INERTE',
  'OTRO',
] as const;

export const MATERIAL_TYPES = [
  'MATERIAL_MELARIO',
  'MIEL',
  'CERA',
  'POLEN',
  'PROPOLEO',
  'JALEA_REAL',
  'NUCLEO',
  'COLMENA',
  'OTRO',
] as const;

export const UNITS = ['KG', 'LITRO', 'ALZA', 'TAMBOR', 'COLMENA', 'UNIDAD'] as const;

export class CreateMovementDto {
  @ApiProperty({ enum: MOVEMENT_TYPES })
  @IsEnum(MOVEMENT_TYPES)
  movementType!: (typeof MOVEMENT_TYPES)[number];

  @ApiProperty({ enum: MATERIAL_TYPES })
  @IsEnum(MATERIAL_TYPES)
  materialType!: (typeof MATERIAL_TYPES)[number];

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  originEstablishmentId!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Apiario de origen, cuando aplica.' })
  @IsOptional()
  @IsUUID()
  originApiaryId?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  destinationEstablishmentId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  carrierId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  driverName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  driverDocument?: string;

  @ApiProperty({ format: 'date-time', example: '2026-09-15T09:00:00.000Z' })
  @IsDateString()
  scheduledAt!: string;

  @ApiProperty({ example: 850.5, minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantity!: number;

  @ApiProperty({ enum: UNITS })
  @IsEnum(UNITS)
  unit!: (typeof UNITS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class DispatchMovementDto {
  @ApiPropertyOptional({ format: 'date-time', description: 'Por defecto, el momento actual.' })
  @IsOptional()
  @IsDateString()
  dispatchedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ReceiveMovementDto {
  @ApiProperty({ example: 848.2, description: 'Cantidad efectivamente recibida.' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  receivedQuantity!: number;

  @ApiPropertyOptional({ enum: UNITS, description: 'Por defecto, la unidad del movimiento.' })
  @IsOptional()
  @IsEnum(UNITS)
  unit?: (typeof UNITS)[number];

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @ApiPropertyOptional({
    enum: ['ACCEPTED', 'PARTIAL', 'REJECTED'],
    description: 'Si se omite, se deduce comparando cantidades.',
  })
  @IsOptional()
  @IsEnum(['ACCEPTED', 'PARTIAL', 'REJECTED'])
  result?: 'ACCEPTED' | 'PARTIAL' | 'REJECTED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  discrepancyNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CancelMovementDto {
  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  reason!: string;
}

/**
 * Registro del documento de un movimiento existente (POST /movements/:id/dte).
 *
 * Se conserva por compatibilidad: la cola offline de los dispositivos puede
 * tener operaciones guardadas con esta ruta. Para un traslado apiario -> sala
 * el documento se trata como DT-e API-SEM y admite los campos nuevos; para
 * otros traslados (p. ej. un remito) se comporta como antes.
 */
export class CreateDteDto {
  @ApiPropertyOptional({
    description: 'Numero oficial. Si se omite queda en BORRADOR hasta emitirlo.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  number?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @ApiPropertyOptional({
    description: 'Si se omite, se toma el RENSPA vigente del establecimiento de origen.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  originRenspa?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  destinationRenspa?: string;

  @ApiPropertyOptional({
    default: false,
    description:
      'true cuando el numero proviene efectivamente de SIGSA; marca el DT-e como sincronizado.',
  })
  @IsOptional()
  @IsBoolean()
  fromExternalSystem?: boolean;

  @ApiPropertyOptional({ example: 80, description: 'Alzas declaradas (DT-e API-SEM).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  declaredQuantity?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  estimatedQuantity?: number;

  @ApiPropertyOptional({ example: '2026-09-22', description: 'Por defecto, el dia del traslado.' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'loadDate debe tener el formato YYYY-MM-DD' })
  loadDate?: string;

  @ApiPropertyOptional({ example: '2026-09-24', description: 'Por defecto, carga + 2 dias.' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'expiryDate debe tener el formato YYYY-MM-DD' })
  expiryDate?: string;

  @ApiPropertyOptional({ example: '790112' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  verificationCode?: string;

  @ApiPropertyOptional({ type: DteTransportDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DteTransportDto)
  transport?: DteTransportDto;
}

/** @deprecated Usar POST /dte/:id/issue, /void. Se conserva por compatibilidad. */
export class UpdateDteStatusDto {
  @ApiProperty({ enum: ['ISSUED', 'APPROVED', 'REJECTED', 'CANCELLED'] })
  @IsEnum(['ISSUED', 'APPROVED', 'REJECTED', 'CANCELLED'])
  status!: 'ISSUED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(600)
  reason?: string;
}

/** Cierre por la sala (POST /movements/:id/dte/close). Equivale a POST /dte/:id/close. */
export class CloseDteDto {
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  closedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(600)
  notes?: string;

  @ApiPropertyOptional({ example: '022440451-4' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  number?: string;

  @ApiPropertyOptional({ example: '790112' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  verificationCode?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  arrivalAt?: string;

  @ApiPropertyOptional({ example: 65 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  confirmedQuantity?: number;
}
