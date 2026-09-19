import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EstablishmentService } from './establishment.service';
import {
  AssociateRenspaDto,
  CreateEstablishmentDto,
  UpdateEstablishmentDto,
} from './dto/establishment.dto';
import { ListEstablishmentsQueryDto } from '../../common/dto/filters.dto';
import { Audit, CorrelationId, CurrentUser, Roles } from '../../common/decorators';
import { paginated } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../../common/types';

@ApiTags('Productores y registros')
@ApiBearerAuth()
@Controller('establishments')
export class EstablishmentController {
  constructor(private readonly establishments: EstablishmentService) {}

  @Post()
  @Roles('ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'FRACCIONADOR')
  @Audit('ESTABLISHMENT_CREATED', 'establishment')
  @ApiOperation({ summary: 'CU-06 Registrar establecimiento' })
  create(
    @Body() dto: CreateEstablishmentDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.establishments.create(dto, actor, correlationId);
  }

  @Get()
  async list(
    @Query() query: ListEstablishmentsQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const { rows, total } = await this.establishments.list(query, actor, {
      type: query.type,
      producerId: query.producerId,
    });
    return paginated(rows, total, query);
  }

  @Get('receivers')
  @ApiOperation({
    summary: 'Listar salas de extraccion y acopios habilitados (H-02)',
    description: 'Permite seleccionar destinos inter-empresa para la emision de DT-e.',
  })
  listReceivers(@Query('q') q?: string) {
    return this.establishments.listReceivers(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle del establecimiento con sus RENSPA.' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.establishments.findOneDetailed(id, actor);
  }

  @Patch(':id')
  @Roles('ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'FRACCIONADOR')
  @Audit('ESTABLISHMENT_UPDATED', 'establishment')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEstablishmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.establishments.update(id, dto, actor);
  }

  @Post(':id/renspa')
  @Roles('ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR')
  @Audit('RENSPA_ASSOCIATED', 'renspa_registration')
  @ApiOperation({
    summary: 'CU-06 Asociar RENSPA',
    description: 'El RENSPA vincula productor, actividad y predio. No se confunde con el apiario.',
  })
  associateRenspa(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssociateRenspaDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.establishments.associateRenspa(id, dto, actor, correlationId);
  }

  @Get(':id/renspa')
  listRenspa(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.establishments.listRenspa(id, actor);
  }
}
