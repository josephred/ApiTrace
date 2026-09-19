import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export const TRANSPORT_TYPES = ['PROPIO', 'CONTRATADO', 'DESTINATARIO'] as const;
export type TransportType = (typeof TRANSPORT_TYPES)[number];

export class CreateDteDraftDto {
  @ApiProperty({ description: 'ID del movimiento asociado', format: 'uuid' })
  @IsUUID()
  movementId!: string;

  @ApiPropertyOptional({ description: 'Productor titular (opcional si ya figura en el movimiento)' })
  @IsOptional()
  @IsUUID()
  holderProducerId?: string;

  @ApiProperty({ description: 'Fecha de carga autorizada (YYYY-MM-DD)', example: '2026-03-20' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'loadDate debe tener formato YYYY-MM-DD' })
  loadDate!: string;

  @ApiProperty({ description: 'Fecha de vencimiento (YYYY-MM-DD, entre 2 y 4 dias despues)', example: '2026-03-23' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'expiryDate debe tener formato YYYY-MM-DD' })
  expiryDate!: string;

  @ApiProperty({ description: 'Cantidad declarada (ej. alzas o kg)', example: 120 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  declaredQuantity!: number;

  @ApiPropertyOptional({ enum: TRANSPORT_TYPES, default: 'PROPIO' })
  @IsOptional()
  @IsEnum(TRANSPORT_TYPES)
  transportType?: TransportType;

  @ApiProperty({ description: 'Patente del vehiculo de transporte', example: 'AF123CD' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  transportPlate!: string;

  @ApiPropertyOptional({ description: 'Patente del acoplado o trailer (opcional)', example: '101AA123BB' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  transportTrailerPlate?: string;

  @ApiPropertyOptional({ description: 'Motivo de transito segun SENASA', default: 'EXTRACCION' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  transitReason?: string;

  @ApiPropertyOptional({ description: 'Observaciones generales del DT-e' })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  notes?: string;
}

export class PreflightCheckDto {
  @ApiProperty({ description: 'ID del movimiento a evaluar', format: 'uuid' })
  @IsUUID()
  movementId!: string;

  @ApiPropertyOptional({ description: 'Fecha de carga simulada (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  loadDate?: string;

  @ApiPropertyOptional({ description: 'Fecha de vencimiento simulada (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  expiryDate?: string;

  @ApiPropertyOptional({ description: 'Cantidad declarada a comprobar' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  declaredQuantity?: number;

  @ApiPropertyOptional({ description: 'Patente a comprobar' })
  @IsOptional()
  @IsString()
  transportPlate?: string;
}

export class IssueManualDteDto {
  @ApiProperty({ description: 'Numero oficial de DT-e otorgado por SENASA', example: 'DTE-2026-00049281' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  number!: string;

  @ApiProperty({ description: 'Codigo de verificacion de cierre oficial (3 a 12 caracteres)', example: 'VER-8849' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(40)
  verificationCode!: string;

  @ApiPropertyOptional({ description: 'URL o identificador del documento PDF oficial descargado' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  pdfUrl?: string;

  @ApiPropertyOptional({ description: 'Fecha de emision (ISO o YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  issuedAt?: string;
}

export class VoidDteDto {
  @ApiProperty({ description: 'Motivo de anulacion ante SENASA', example: 'Lluvia persistente imposibilita transito por camino vecinal' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(600)
  reason!: string;
}

export class CloseDteDto {
  @ApiProperty({ description: 'Codigo de verificacion impreso en el DT-e oficial' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(40)
  verificationCode!: string;

  @ApiProperty({ description: 'Cantidad efectivamente arribada a sala', example: 110 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  confirmedQuantity!: number;

  @ApiPropertyOptional({ description: 'Fecha y hora de arribo (ISO)' })
  @IsOptional()
  @IsString()
  arrivalAt?: string;

  @ApiPropertyOptional({ description: 'Observaciones de cierre en sala' })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  notes?: string;
}

export class NoArrivalDteDto {
  @ApiProperty({ description: 'Motivo o circunstancia por la cual el cargamento no llego al destino previsto' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(600)
  reason!: string;
}

export class RegularizeDteDto {
  @ApiProperty({ description: 'Cantidad efectivamente arribada y recepcionada', example: 105 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  confirmedQuantity!: number;

  @ApiProperty({ description: 'Nota justificativa de regularizacion extemporanea' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(600)
  regularizationNote!: string;
}

export class DteFilterDto {
  @ApiPropertyOptional({ enum: ['ISSUED', 'RECEIVED', 'ALL'], default: 'ALL' })
  @IsOptional()
  @IsEnum(['ISSUED', 'RECEIVED', 'ALL'])
  perspective?: 'ISSUED' | 'RECEIVED' | 'ALL';

  @ApiPropertyOptional({ description: 'Filtrar por estado oficial del DT-e' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;

  @ApiPropertyOptional({ description: 'Busqueda por numero o codigo' })
  @IsOptional()
  @IsString()
  search?: string;
}
