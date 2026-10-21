import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { VehicleService } from './vehicle.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';
import { Audit, CurrentUser, Roles } from '../../common/decorators';
import type { AuthenticatedUser } from '../../common/types';

export class ListVehiclesQueryDto {
  @ApiPropertyOptional({ default: false, description: 'Incluir los dados de baja.' })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  all?: boolean;
}

const WRITERS = ['ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'TRANSPORTISTA'] as const;

@ApiTags('Maestros')
@ApiBearerAuth()
@Controller('vehicles')
export class VehicleController {
  constructor(private readonly vehicles: VehicleService) {}

  @Get()
  @ApiOperation({ summary: 'Vehiculos guardados de la organizacion (el ultimo usado primero).' })
  list(@Query() query: ListVehiclesQueryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.vehicles.list(actor, query.all ?? false);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.vehicles.findOne(id, actor);
  }

  @Post()
  @Roles(...WRITERS)
  @Audit('VEHICLE_CREATED', 'vehicle')
  @ApiOperation({ summary: 'Nuevo transporte: conductor, patente y carro.' })
  create(@Body() dto: CreateVehicleDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.vehicles.create(dto, actor);
  }

  @Patch(':id')
  @Roles(...WRITERS)
  @Audit('VEHICLE_UPDATED', 'vehicle')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.vehicles.update(id, dto, actor);
  }
}
