import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProducerService } from './producer.service';
import {
  AssociateRenapaDto,
  CreateProducerDto,
  SENASA_SERVICES,
  UpdateProducerDto,
  UpsertSenasaDelegationDto,
} from './dto/producer.dto';
import { Audit, CorrelationId, CurrentUser, Roles } from '../../common/decorators';
import { PaginationQueryDto, paginated } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../../common/types';

@ApiTags('Productores y registros')
@ApiBearerAuth()
@Controller('producers')
export class ProducerController {
  constructor(private readonly producers: ProducerService) {}

  @Post()
  @Roles('ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR')
  @Audit('PRODUCER_CREATED', 'producer')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Evita duplicados ante reintentos de red.',
  })
  @ApiOperation({
    summary: 'CU-04 Registrar productor',
    description: 'Crea la representacion interna del productor. El CUIT es opcional y externo.',
  })
  create(
    @Body() dto: CreateProducerDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.producers.create(dto, actor, correlationId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar productores del ambito del usuario.' })
  async list(@Query() query: PaginationQueryDto, @CurrentUser() actor: AuthenticatedUser) {
    const { rows, total } = await this.producers.list(query, actor);
    return paginated(rows, total, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle del productor con sus registros RENAPA.' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.producers.findOneDetailed(id, actor);
  }

  @Patch(':id')
  @Roles('ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR')
  @Audit('PRODUCER_UPDATED', 'producer')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProducerDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.producers.update(id, dto, actor);
  }

  @Post(':id/renapa')
  @Roles('ADMIN', 'PRODUCTOR')
  @Audit('RENAPA_ASSOCIATED', 'renapa_registration')
  @ApiOperation({
    summary: 'CU-05 Asociar RENAPA al productor',
    description:
      'El RENAPA se modela como registro propio (regla 1 del mapa del dominio) y queda PENDING_SYNC hasta que exista integracion con SENASA.',
  })
  associateRenapa(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssociateRenapaDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.producers.associateRenapa(id, dto, actor, correlationId);
  }

  @Get(':id/renapa')
  listRenapa(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.producers.listRenapa(id, actor);
  }

  @Get(':id/senasa-delegations')
  @ApiOperation({
    summary: 'Delegaciones SENASA del titular',
    description:
      'Estado de la delegacion de SIGSA (emitir DT-e) y SITA (cerrar en sala) en la CUIT de ApiTrace.',
  })
  listDelegations(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.producers.listDelegations(id, actor);
  }

  @Put(':id/senasa-delegations/:service')
  @Roles('ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR')
  @Audit('SENASA_DELEGATION_UPDATED', 'senasa_delegation')
  @ApiOperation({
    summary: 'Registrar el estado de una delegacion',
    description:
      'La delegacion se realiza en ARCA (Administrador de Relaciones, F3283/E); aca se registra su estado.',
  })
  upsertDelegation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('service', new ParseEnumPipe(SENASA_SERVICES)) service: (typeof SENASA_SERVICES)[number],
    @Body() dto: UpsertSenasaDelegationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.producers.upsertDelegation(id, service, dto, actor);
  }
}
