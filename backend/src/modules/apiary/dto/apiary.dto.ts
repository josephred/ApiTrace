import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
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
} from 'class-validator';

export const REGISTRATION_STATUSES = [
  'PENDING_VERIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'EXPIRED',
  'CANCELLED',
] as const;

/**
 * Identificacion oficial del apiario en RENAPA. Es el origen del DT-e API-SEM:
 * sin ella SIGSA no emite. Se comparte entre el alta y la edicion.
 */
class ApiaryRenapaFields {
  @ApiPropertyOptional({
    example: 'B53999-2',
    description: 'Codigo RENAPA del apiario: Letra-N°RENAPA-N°Apiario.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  renapaCode?: string;

  @ApiPropertyOptional({ enum: REGISTRATION_STATUSES, default: 'PENDING_VERIFICATION' })
  @IsOptional()
  @IsEnum(REGISTRATION_STATUSES)
  renapaStatus?: (typeof REGISTRATION_STATUSES)[number];

  @ApiPropertyOptional({ example: '2027-06-30', description: 'Vigencia de la habilitacion (YYYY-MM-DD).' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'renapaValidTo debe tener el formato YYYY-MM-DD' })
  renapaValidTo?: string;
}

export class CreateApiaryDto extends ApiaryRenapaFields {
  @ApiProperty({ format: 'uuid', description: 'Establecimiento al que pertenece el apiario.' })
  @IsUUID()
  establishmentId!: string;

  @ApiProperty({ example: 'API-001', description: 'Codigo unico dentro del establecimiento.' })
  @IsString()
  @MaxLength(60)
  code!: string;

  @ApiPropertyOptional({ example: 'Monte Grande' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ example: -34.6037 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: -58.3816 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  longitude?: number;

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

  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  hiveCount?: number;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  registeredAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateApiaryDto extends ApiaryRenapaFields {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

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
  @IsInt()
  @Min(0)
  @Max(100000)
  hiveCount?: number;

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

export class CreateHiveDto {
  @ApiProperty({ example: 'COL-0001' })
  @IsString()
  @MaxLength(60)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  identifier?: string;

  @ApiPropertyOptional({ example: 'Langstroth' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  type?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  installedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateHiveDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  identifier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  type?: string;

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
