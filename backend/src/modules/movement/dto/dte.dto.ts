import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { DTE_STATUSES, TRANSPORT_TYPES } from '../dte.rules';

/** Fecha calendario sin hora, en hora argentina: YYYY-MM-DD. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DAY_MESSAGE = 'debe tener el formato YYYY-MM-DD';

/** Patente tal como la escribe la persona; el servicio la normaliza. */
const PLATE = /^[A-Za-z0-9 .\-]{2,15}$/;

const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

export class DteTransportDto {
  @ApiProperty({ enum: TRANSPORT_TYPES, example: 'CAMIONETA' })
  @IsEnum(TRANSPORT_TYPES)
  type!: (typeof TRANSPORT_TYPES)[number];

  @ApiProperty({ example: 'AA123BC', description: 'Patente del chasis.' })
  @IsString()
  @Matches(PLATE, { message: 'plate no es una patente valida' })
  plate!: string;

  @ApiPropertyOptional({ example: 'AB456CD', description: 'Patente del acoplado, si lo hay.' })
  @IsOptional()
  @IsString()
  @Matches(PLATE, { message: 'trailerPlate no es una patente valida' })
  trailerPlate?: string;
}

/**
 * Solicitud de DT-e API-SEM (especificacion 8.2, endpoint 1).
 *
 * Con `movementId` se ampara un movimiento que ya existe. Sin el, ApiTrace crea
 * el movimiento (material melario, en alzas) en la misma transaccion: para el
 * apicultor "pedir el DT-e" y "registrar el traslado" son el mismo acto.
 */
export class CreateDteRequestDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Movimiento existente a amparar.' })
  @IsOptional()
  @IsUUID()
  movementId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Apiario de origen (si no se indica movementId).',
  })
  @IsOptional()
  @IsUUID()
  apiaryId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Sala de extraccion de destino (si no se indica movementId).',
  })
  @IsOptional()
  @IsUUID()
  destinationEstablishmentId?: string;

  @ApiPropertyOptional({ example: 50, description: 'Alzas que el apicultor estima cosechar.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  estimatedQuantity?: number;

  @ApiProperty({
    example: 80,
    description:
      'Alzas declaradas. Conviene sobreestimar: la sala no puede confirmar mas de lo declarado.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  declaredQuantity!: number;

  @ApiProperty({
    example: '2026-09-22',
    description: 'Fecha de carga (YYYY-MM-DD, hora argentina).',
  })
  @Matches(ISO_DAY, { message: `loadDate ${ISO_DAY_MESSAGE}` })
  loadDate!: string;

  @ApiPropertyOptional({
    example: '2026-09-24',
    description: 'Fecha de vencimiento. Por defecto, carga + 2 dias; maximo carga + 4.',
  })
  @IsOptional()
  @Matches(ISO_DAY, { message: `expiryDate ${ISO_DAY_MESSAGE}` })
  expiryDate?: string;

  @ApiPropertyOptional({ type: DteTransportDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DteTransportDto)
  transport?: DteTransportDto;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Numero de un DT-e ya emitido en SIGSA (web u oficina local). Si se indica, el DT-e queda EMITIDO.',
    example: '022440451-4',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  number?: string;

  @ApiPropertyOptional({ example: '790112', description: 'Codigo de cierre impreso en el DT-e.' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  verificationCode?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'true: pedir la emision a SIGSA en el mismo acto (requiere integracion por API).',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  submit?: boolean;
}

/** Verificacion previa (checklist 9): mismo cuerpo que la solicitud, sin efectos. */
export class PreflightDteDto extends CreateDteRequestDto {}

export class UpdateDteDraftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  estimatedQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  declaredQuantity?: number;

  @ApiPropertyOptional({ example: '2026-09-22' })
  @IsOptional()
  @Matches(ISO_DAY, { message: `loadDate ${ISO_DAY_MESSAGE}` })
  loadDate?: string;

  @ApiPropertyOptional({ example: '2026-09-24' })
  @IsOptional()
  @Matches(ISO_DAY, { message: `expiryDate ${ISO_DAY_MESSAGE}` })
  expiryDate?: string;

  @ApiPropertyOptional({ type: DteTransportDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DteTransportDto)
  transport?: DteTransportDto;
}

export class IssueDteDto {
  @ApiPropertyOptional({
    description:
      'Numero emitido en SIGSA. Si se omite, ApiTrace pide la emision por API (modo simulado o sigsa).',
    example: '022440451-4',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  number?: string;

  @ApiPropertyOptional({ example: '790112' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  verificationCode?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  issuedAt?: string;
}

export class VoidDteDto {
  @ApiProperty({ example: 'Exceso de carga: llegaron 60 alzas y se declararon 50.' })
  @IsString()
  @MinLength(5)
  @MaxLength(600)
  reason!: string;

  @ApiPropertyOptional({
    default: false,
    description: 'true si el arancel ya se abono: el DT-e queda ANULADO; si no, ELIMINADO.',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  feePaid?: boolean;
}

/** Cierre en sala (SITA, especificacion 6.1). */
export class CloseDteRequestDto {
  @ApiPropertyOptional({
    description: 'Numero impreso; si se indica debe coincidir.',
    example: '022440451-4',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  number?: string;

  @ApiPropertyOptional({ example: '790112', description: 'Codigo de cierre impreso en el DT-e.' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  verificationCode?: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'Fecha y hora de arribo a la sala.' })
  @IsOptional()
  @IsDateString()
  arrivalAt?: string;

  @ApiPropertyOptional({ example: 65, description: 'Alzas efectivamente recibidas (Qreal).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  confirmedQuantity?: number;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  closedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(600)
  notes?: string;
}

export class NoArrivalDteDto {
  @ApiProperty({ example: 'La carga no llego a la sala dentro de la vigencia.' })
  @IsString()
  @MinLength(5)
  @MaxLength(600)
  reason!: string;
}

export class RegularizeDteDto {
  @ApiProperty({ example: 'SENASA levanto el bloqueo tras el cierre extemporaneo (nota 1234/26).' })
  @IsString()
  @MinLength(5)
  @MaxLength(600)
  note!: string;
}

export const DTE_PERSPECTIVES = ['emitidos', 'recibidos', 'todos'] as const;

export class ListDteQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: DTE_STATUSES,
    description: 'Estado efectivo (ya considera la vigencia).',
  })
  @IsOptional()
  @IsEnum(DTE_STATUSES)
  status?: (typeof DTE_STATUSES)[number];

  @ApiPropertyOptional({
    enum: DTE_PERSPECTIVES,
    default: 'todos',
    description: 'emitidos: los que emite mi organizacion; recibidos: los que llegan a mis salas.',
  })
  @IsOptional()
  @IsEnum(DTE_PERSPECTIVES)
  perspective?: (typeof DTE_PERSPECTIVES)[number];

  @ApiPropertyOptional({ description: 'Solo los DT-e que pidio el usuario autenticado.' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  mine?: boolean;

  @ApiPropertyOptional({ example: '2026-09-01', description: 'Fecha de carga desde (inclusive).' })
  @IsOptional()
  @Matches(ISO_DAY, { message: `from ${ISO_DAY_MESSAGE}` })
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30', description: 'Fecha de carga hasta (inclusive).' })
  @IsOptional()
  @Matches(ISO_DAY, { message: `to ${ISO_DAY_MESSAGE}` })
  to?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  holderProducerId?: string;
}
