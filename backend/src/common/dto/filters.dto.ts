import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from './pagination.dto';

/**
 * Los filtros de listado se declaran como DTO y no como `@Query('x')` sueltos:
 * el ValidationPipe corre con forbidNonWhitelisted, de modo que un parametro no
 * declarado se rechaza con 400 en lugar de ignorarse silenciosamente.
 */

export class ListEstablishmentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: [
      'APIARIO_BASE',
      'SALA_EXTRACCION',
      'ACOPIO',
      'FRACCIONADORA',
      'DEPOSITO',
      'LABORATORIO',
      'OTRO',
      'FINCA_POLINIZACION',
    ],
  })
  @IsOptional()
  @IsEnum([
    'APIARIO_BASE',
    'SALA_EXTRACCION',
    'ACOPIO',
    'FRACCIONADORA',
    'DEPOSITO',
    'LABORATORIO',
    'OTRO',
    'FINCA_POLINIZACION',
  ])
  type?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  producerId?: string;
}

export class ListApiariesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  establishmentId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Solo los apiarios de esa zona.' })
  @IsOptional()
  @IsUUID()
  zoneId?: string;
}

export class ListMovementsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: [
      'DRAFT',
      'DISPATCHED',
      'IN_TRANSIT',
      'RECEIVED',
      'PARTIALLY_RECEIVED',
      'REJECTED',
      'CANCELLED',
    ],
  })
  @IsOptional()
  @IsEnum([
    'DRAFT',
    'DISPATCHED',
    'IN_TRANSIT',
    'RECEIVED',
    'PARTIALLY_RECEIVED',
    'REJECTED',
    'CANCELLED',
  ])
  status?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Origen o destino.' })
  @IsOptional()
  @IsUUID()
  establishmentId?: string;
}

export class ListExtractionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  establishmentId?: string;
}

export class ListLotsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'CLOSED', 'BLOCKED', 'DISPATCHED', 'CONSUMED'] })
  @IsOptional()
  @IsEnum(['OPEN', 'CLOSED', 'BLOCKED', 'DISPATCHED', 'CONSUMED'])
  status?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  establishmentId?: string;
}

export class ListDrumsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  lotId?: string;

  @ApiPropertyOptional({
    enum: ['EMPTY', 'FILLED', 'IN_STOCK', 'IN_TRANSIT', 'DISPATCHED', 'CONSUMED'],
  })
  @IsOptional()
  @IsEnum(['EMPTY', 'FILLED', 'IN_STOCK', 'IN_TRANSIT', 'DISPATCHED', 'CONSUMED'])
  status?: string;
}

export class AuditQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'movement' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  entityId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @ApiPropertyOptional({ example: 'MOVEMENT_CREATED' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  action?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class TraceabilityEventQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'MovementCreated' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  eventType?: string;

  @ApiPropertyOptional({ example: 'lot' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  entityType?: string;
}

export class EffectiveRulesQueryDto {
  @ApiPropertyOptional({ format: 'date-time', description: 'Fecha ISO. Por defecto, hoy.' })
  @IsOptional()
  @IsDateString()
  at?: string;
}
