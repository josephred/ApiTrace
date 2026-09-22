import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit, CorrelationId, CurrentUser, Roles } from '../../common/decorators';
import type { AuthenticatedUser } from '../../common/types';
import { DteService } from './dte.service';
import { DteQueryService } from './dte-query.service';
import {
  CloseDteRequestDto,
  CreateDteRequestDto,
  IssueDteDto,
  ListDteQueryDto,
  NoArrivalDteDto,
  PreflightDteDto,
  RegularizeDteDto,
  UpdateDteDraftDto,
  VoidDteDto,
} from './dto/dte.dto';

/**
 * DT-e por usuario (especificacion DT-e, seccion 8.2).
 *
 * Correspondencia con la especificacion:
 *   POST /api/v1/tramites/dte        -> POST /dte (submit=true para enviar a SIGSA)
 *   POST /api/v1/sita/dtes/cierre    -> POST /dte/:id/close
 * Se conservan las convenciones de la API existente (recursos en ingles,
 * camelCase, Idempotency-Key) en lugar de las del documento.
 */
@ApiTags('DT-e')
@ApiBearerAuth()
@Controller('dte')
export class DteController {
  constructor(
    private readonly dtes: DteService,
    private readonly reads: DteQueryService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'DT-e del usuario',
    description:
      'Los que emite su organizacion (perspective=emitidos), los que llegan a sus salas (recibidos) o ambos. El estado ya contempla la vigencia.',
  })
  list(@Query() query: ListDteQueryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.reads.list(query, actor);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Resumen por estado y tareas pendientes (panel).' })
  summary(@CurrentUser() actor: AuthenticatedUser) {
    return this.reads.summary(actor);
  }

  @Get('integration')
  @ApiOperation({
    summary: 'Canal de emision activo (manual, simulado, sigsa) y parametros normativos.',
  })
  integration() {
    return this.reads.integrationInfo();
  }

  @Post('preflight')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'PRODUCTOR')
  @ApiOperation({
    summary: 'Verificacion previa sin efectos',
    description:
      'Revisa RENAPA del apiario, habilitacion de la sala, titular, vigencia, anticipacion, cantidad y transporte, igual que antes de pedir la emision.',
  })
  preflight(@Body() dto: PreflightDteDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.reads.preflight(dto, actor);
  }

  @Post()
  @Roles('ADMIN', 'PRODUCTOR')
  @Audit('DTE_CREATED', 'dte')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiOperation({
    summary: 'CU-10 Solicitar DT-e API-SEM',
    description:
      'Crea el borrador (y el movimiento, si no se indica movementId). Con number registra un DT-e ya emitido en SIGSA; con submit=true pide la emision por API.',
  })
  create(
    @Body() dto: CreateDteRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.dtes.create(dto, actor, correlationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle del DT-e con historial y acciones disponibles.' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.reads.findOne(id, actor);
  }

  @Patch(':id')
  @Roles('ADMIN', 'PRODUCTOR')
  @Audit('DTE_DRAFT_UPDATED', 'dte')
  @ApiOperation({ summary: 'Editar un borrador (cantidades, fechas, transporte).' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDteDraftDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.dtes.updateDraft(id, dto, actor);
  }

  @Post(':id/issue')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'PRODUCTOR')
  @Audit('DTE_ISSUED', 'dte')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiOperation({
    summary: 'Emitir un borrador',
    description:
      'Con number: registra el DT-e emitido en SIGSA. Sin number: pide la emision por API y queda SOLICITADO hasta la respuesta.',
  })
  issue(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueDteDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.dtes.issue(id, dto, actor, correlationId);
  }

  @Post(':id/void')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'PRODUCTOR')
  @Audit('DTE_VOIDED', 'dte')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiOperation({
    summary: 'Anular o eliminar',
    description: 'ANULADO si el arancel se abono (feePaid=true); ELIMINADO si no.',
  })
  void(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidDteDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.dtes.void(id, dto, actor, correlationId);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'SALA', 'ACOPIADOR')
  @Audit('DTE_CLOSED', 'dte')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiOperation({
    summary: 'CU-12 Cierre en sala (SITA)',
    description:
      'Numero y codigo de cierre impresos, fecha de arribo y alzas reales. Qreal no puede superar la cantidad declarada (422 EXCESO_CANTIDAD_DECLARADA).',
  })
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseDteRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.dtes.close(id, dto, actor, correlationId);
  }

  @Post(':id/no-arrival')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'SALA', 'ACOPIADOR')
  @Audit('DTE_NO_ARRIVAL', 'dte')
  @ApiOperation({ summary: 'La sala declara que la carga no arribo (SIN ARRIBO).' })
  noArrival(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NoArrivalDteDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.dtes.reportNoArrival(id, dto, actor, correlationId);
  }

  @Post(':id/regularize')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @Audit('DTE_REGULARIZED', 'dte')
  @ApiOperation({
    summary: 'Registrar que SENASA regularizo un DT-e caducado (levanta el bloqueo).',
  })
  regularize(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegularizeDteDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.dtes.regularize(id, dto, actor, correlationId);
  }
}
