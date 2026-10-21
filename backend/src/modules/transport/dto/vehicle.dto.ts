import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Tipos de vehiculo del maestro de transportes. ACOPLADO es el camion con
 * acoplado: en el DT-e viaja como CAMION con la patente del acoplado.
 */
export const VEHICLE_KINDS = ['CAMIONETA', 'CAMION', 'ACOPLADO', 'FURGON', 'UTILITARIO', 'OTRO'] as const;
export type VehicleKind = (typeof VEHICLE_KINDS)[number];

/** Patente como la escribe la persona («AB 123 CD»); el servicio la normaliza. */
const PLATE = /^[A-Za-z0-9 .-]{5,12}$/;

export class CreateVehicleDto {
  @ApiProperty({ example: 'Juan Perez', description: 'Nombre completo del conductor.' })
  @IsString()
  @MinLength(3, { message: 'Escribi el nombre completo del conductor.' })
  @MaxLength(160)
  driverName!: string;

  @ApiProperty({ example: 'AB 123 CD', description: 'Patente del vehiculo.' })
  @IsString()
  @Matches(PLATE, { message: 'La patente lleva letras y numeros, por ejemplo AB 123 CD.' })
  plate!: string;

  @ApiPropertyOptional({ example: 'AC 456 EF', description: 'Patente del carro o acoplado, si lleva.' })
  @IsOptional()
  @IsString()
  @Matches(PLATE, { message: 'La patente del carro lleva letras y numeros, por ejemplo AC 456 EF.' })
  trailerPlate?: string;

  @ApiPropertyOptional({ enum: VEHICLE_KINDS, default: 'CAMIONETA' })
  @IsOptional()
  @IsEnum(VEHICLE_KINDS)
  type?: VehicleKind;

  @ApiPropertyOptional({ example: 'Camioneta Hilux', description: 'Como lo reconocen en el campo.' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;
}

export class UpdateVehicleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  driverName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(PLATE, { message: 'La patente lleva letras y numeros, por ejemplo AB 123 CD.' })
  plate?: string;

  @ApiPropertyOptional({ description: 'Vacio quita el carro.' })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  trailerPlate?: string;

  @ApiPropertyOptional({ enum: VEHICLE_KINDS })
  @IsOptional()
  @IsEnum(VEHICLE_KINDS)
  type?: VehicleKind;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}
