import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ZoneService } from './zone.service';
import { Audit, CurrentUser, Roles } from '../../common/decorators';
import type { AuthenticatedUser } from '../../common/types';

export class ZoneDto {
  @ApiProperty({ example: 'Valle de Uco' })
  @IsString()
  @MinLength(2, { message: 'El nombre de la zona tiene al menos 2 letras.' })
  @MaxLength(120)
  name!: string;
}

export class ListZonesQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Solo ADMIN y AUDITOR: zonas de otra organizacion.' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

@ApiTags('Maestros')
@ApiBearerAuth()
@Controller('zones')
export class ZoneController {
  constructor(private readonly zones: ZoneService) {}

  @Get()
  @ApiOperation({ summary: 'Zonas de la organizacion, con la cantidad de apiarios de cada una.' })
  list(@Query() query: ListZonesQueryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.zones.list(actor, query.organizationId);
  }

  @Post()
  @Roles('ADMIN', 'PRODUCTOR')
  @Audit('ZONE_CREATED', 'zone')
  create(@Body() dto: ZoneDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.zones.create(dto.name, actor);
  }

  @Patch(':id')
  @Roles('ADMIN', 'PRODUCTOR')
  @Audit('ZONE_RENAMED', 'zone')
  rename(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ZoneDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.zones.rename(id, dto.name, actor);
  }

  @Delete(':id')
  @Roles('ADMIN', 'PRODUCTOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit('ZONE_DELETED', 'zone')
  @ApiOperation({ summary: 'Borra la zona; sus apiarios y fincas quedan sin zona.' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    await this.zones.remove(id, actor);
  }
}
