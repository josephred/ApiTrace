import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PlacesService } from './places.service';
import { CurrentUser } from '../../common/decorators';
import type { AuthenticatedUser } from '../../common/types';
import { PLACE_TYPES, type PlaceType } from '../movement/cargo';

export class ListPlacesQueryDto {
  @ApiProperty({ enum: ['origin', 'destination'], description: 'Paso 4 (origen) o paso 5 (destino).' })
  @IsEnum(['origin', 'destination'])
  side!: 'origin' | 'destination';

  @ApiProperty({ enum: PLACE_TYPES })
  @IsEnum(PLACE_TYPES)
  type!: PlaceType;

  @ApiPropertyOptional({ description: 'Busqueda por nombre, codigo, RENAPA, RNE o zona.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

@ApiTags('Maestros')
@ApiBearerAuth()
@Controller('places')
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lugares para el asistente del DT-e',
    description:
      'Apiarios, fincas, depositos y salas del tipo pedido. Como origen, solo los propios; como destino, ademas las salas y acopios activos de otras organizaciones.',
  })
  list(@Query() query: ListPlacesQueryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.places.list(query, actor);
  }

  @Get('map')
  @ApiOperation({ summary: 'Lugares con ubicacion para el mapa, y los propios que todavia no la tienen.' })
  map(@CurrentUser() actor: AuthenticatedUser) {
    return this.places.map(actor);
  }
}
