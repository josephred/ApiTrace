import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MovementService } from './movement.service';
import { DteService } from './dte.service';
import { DteQueryService } from './dte-query.service';
import { MovementRuleService } from './movement-rule.service';
import {
  CancelMovementDto,
  CloseDteDto,
  CreateDteDto,
  CreateMovementDto,
  DispatchMovementDto,
  ReceiveMovementDto,
  UpdateDteStatusDto,
} from './dto/movement.dto';
import { Audit, CorrelationId, CurrentUser, Roles } from '../../common/decorators';
import { paginated } from '../../common/dto/pagination.dto';
import {
  EffectiveRulesQueryDto,
  ListMovementsQueryDto,
} from '../../common/dto/filters.dto';
import type { AuthenticatedUser } from '../../common/types';

@ApiTags('Movimientos y DT-e')
@ApiBearerAuth()
@Controller('movements')
export class MovementController {
  constructor(
    private readonly movements: MovementService,
    private readonly dte: DteService,
    private readonly dteReads: DteQueryService,
  ) {}

  @Post()
  @Roles('ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'TRANSPORTISTA', 'FRACCIONADOR')
  @Audit('MOVEMENT_CREATED', 'movement')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiOperation({
    summary: 'CU-09 Crear movimiento',
    description:
      'El movimiento es el concepto de dominio. El motor de reglas determina, segun la fecha del traslado, si exige DT-e u otro documento.',
  })
  create(
    @Body() dto: CreateMovementDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.movements.create(dto, actor, correlationId);
  }

  @Get()
  async list(@Query() query: ListMovementsQueryDto, @CurrentUser() actor: AuthenticatedUser) {
    const { rows, total } = await this.movements.list(query, actor, {
      status: query.status,
      establishmentId: query.establishmentId,
    });
    return paginated(rows, total, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle del movimiento con DT-e y recepcion.' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.movements.findOne(id, actor);
  }

  @Post(':id/dispatch')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'TRANSPORTISTA')
  @Audit('MOVEMENT_DISPATCHED', 'movement')
  @ApiOperation({
    summary: 'Despachar el movimiento',
    description: 'Verifica que exista el documento exigido por la regla antes de permitir la salida.',
  })
  dispatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DispatchMovementDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.movements.dispatch(id, dto, actor, correlationId);
  }

  @Post(':id/receive')
  // El productor tambien recibe: un traslado entre apiarios propios o una
  // devolucion terminan en un establecimiento suyo.
  @Roles('ADMIN', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'PRODUCTOR')
  @Audit('MOVEMENT_RECEIVED', 'movement')
  @ApiOperation({
    summary: 'CU-11 Recibir movimiento',
    description: 'Solo la organizacion de destino puede confirmar la recepcion.',
  })
  receive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveMovementDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.movements.receive(id, dto, actor, correlationId);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR')
  @Audit('MOVEMENT_CANCELLED', 'movement')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelMovementDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.movements.cancel(id, dto, actor, correlationId);
  }

  @Post(':id/dte')
  @Roles('ADMIN', 'PRODUCTOR', 'SALA')
  @Audit('DTE_CREATED', 'dte')
  @ApiOperation({
    summary: 'CU-10 Registrar el documento del movimiento',
    description:
      'El DT-e se modela como documento asociado (regla 4). Para traslados apiario -> sala se trata como DT-e API-SEM (alzas, fechas de carga y vencimiento, transporte). Para la gestion completa por usuario ver /dte.',
  })
  createDte(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDteDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.dte.createForMovement(id, dto, actor, correlationId);
  }

  @Get(':id/dte')
  @ApiOperation({ summary: 'DT-e en juego del movimiento (el ultimo no anulado).' })
  getDte(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.dteReads.getByMovement(id, actor);
  }

  @Post(':id/dte/status')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'PRODUCTOR', 'SALA')
  @Audit('DTE_STATUS_UPDATED', 'dte')
  @ApiOperation({
    summary: 'CU-10 Actualizar el estado del DT-e (obsoleto)',
    description:
      'Se conserva por compatibilidad. Usar POST /dte/:id/issue y POST /dte/:id/void. ISSUED emite con numero, CANCELLED elimina, REJECTED rechaza un borrador, APPROVED no cambia nada.',
    deprecated: true,
  })
  updateDteStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDteStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.dte.updateStatusLegacy(id, dto, actor, correlationId);
  }

  @Post(':id/dte/close')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'SALA', 'ACOPIADOR')
  @Audit('DTE_CLOSED', 'dte')
  @ApiOperation({
    summary: 'CU-12 Cerrar el DT-e',
    description:
      'Lo realiza el establecimiento receptor una vez registrada la recepcion. Equivale a POST /dte/:id/close sobre el DT-e en juego del movimiento.',
  })
  closeDte(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseDteDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.dte.closeForMovement(id, dto, actor, correlationId);
  }
}

@ApiTags('Movimientos y DT-e')
@ApiBearerAuth()
@Controller('movement-rules')
export class MovementRuleController {
  constructor(private readonly rules: MovementRuleService) {}

  @Get()
  @ApiOperation({
    summary: 'Reglas documentales configuradas',
    description: 'Permite auditar que normativa se aplicara y desde cuando.',
  })
  list() {
    return this.rules.list();
  }

  @Get('effective')
  @ApiOperation({ summary: 'Reglas vigentes en una fecha dada.' })
  listEffective(@Query() query: EffectiveRulesQueryDto) {
    return this.rules.listEffective(query.at ? new Date(query.at) : new Date());
  }
}
