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
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateApiaryDto {
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

  @ApiPropertyOptional({ example: '12.345.678' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  renapaCode?: string;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  renapaStatus?: string;

  @ApiPropertyOptional({ example: '2027-12-31' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  renapaValidTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateApiaryDto {
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

  @ApiPropertyOptional({ example: '12.345.678' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  renapaCode?: string;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  renapaStatus?: string;

  @ApiPropertyOptional({ example: '2027-12-31' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  renapaValidTo?: string;

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
