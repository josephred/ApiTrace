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
import { Audit, CorrelationId, CurrentUser, Roles } from '../../common/decorators';
import type { AuthenticatedUser } from '../../common/types';
import {
  CloseDteDto,
  CreateDteDraftDto,
  DteFilterDto,
  IssueManualDteDto,
  NoArrivalDteDto,
  PreflightCheckDto,
  RegularizeDteDto,
  VoidDteDto,
} from './dto/dte.dto';
import { DteService } from './dte.service';

@ApiTags('DT-e API-SEM')
@ApiBearerAuth()
@Controller('dte')
export class DteController {
  constructor(private readonly dteService: DteService) {}

  @Get()
  @ApiOperation({ summary: 'Listar documentos de transito electronicos (DT-e)' })
  list(@Query() filter: DteFilterDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dteService.list(filter, user);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Resumen de tareas y estados del DT-e' })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.dteService.summary(user);
  }

  @Post('preflight')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Evaluacion exhaustiva de condiciones previas a la emision' })
  preflight(@Body() dto: PreflightCheckDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dteService.preflight(dto, user);
  }

  @Post('draft')
  @Roles('ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR')
  @Audit('DTE_DRAFT_CREATED', 'dte')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  @ApiOperation({ summary: 'Crear un borrador de DT-e asociado a un movimiento' })
  createDraft(@Body() dto: CreateDteDraftDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dteService.createDraft(dto, user);
  }

  @Post(':id/issue-manual')
  @Roles('ADMIN', 'PRODUCTOR', 'SALA')
  @Audit('DTE_ISSUED_MANUAL', 'dte')
  @ApiOperation({ summary: 'Emision en modo manual/contingencia con numero y codigo oficial de SIGSA' })
  issueManual(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueManualDteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dteService.issueManual(id, dto, user);
  }

  @Post(':id/request-sigsa')
  @Roles('ADMIN', 'PRODUCTOR', 'SALA')
  @Audit('DTE_REQUESTED_SIGSA', 'dte')
  @ApiOperation({ summary: 'Solicitar emision automatica ante el servicio de SENASA' })
  requestSigsa(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.dteService.requestSigsa(id, user, correlationId);
  }

  @Post(':id/void')
  @Roles('ADMIN', 'PRODUCTOR', 'SALA')
  @Audit('DTE_VOIDED', 'dte')
  @ApiOperation({ summary: 'Anular un DT-e emitido o vigente ante SENASA' })
  voidDte(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidDteDto,
    @CurrentUser() user: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.dteService.voidDte(id, dto, user, correlationId);
  }

  @Post(':id/close')
  @Roles('ADMIN', 'SALA', 'ACOPIADOR')
  @Audit('DTE_CLOSED', 'dte')
  @ApiOperation({ summary: 'Cerrar DT-e en sala de destino mediante codigo de verificacion y cantidad' })
  closeDte(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseDteDto,
    @CurrentUser() user: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.dteService.closeDte(id, dto, user, correlationId);
  }

  @Post(':id/no-arrival')
  @Roles('ADMIN', 'SALA', 'ACOPIADOR', 'PRODUCTOR')
  @Audit('DTE_NO_ARRIVAL', 'dte')
  @ApiOperation({ summary: 'Declarar sin arribo un DT-e en transito' })
  reportNoArrival(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NoArrivalDteDto,
    @CurrentUser() user: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.dteService.reportNoArrival(id, dto, user, correlationId);
  }

  @Post(':id/regularize')
  @Roles('ADMIN', 'SALA')
  @Audit('DTE_REGULARIZED', 'dte')
  @ApiOperation({ summary: 'Regularizar un DT-e vencido o caducado tras arribo extemporaneo' })
  regularize(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegularizeDteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dteService.regularize(id, dto, user);
  }

  @Get('by-movement/:movementId')
  @ApiOperation({ summary: 'Obtener el DT-e asociado a un movimiento' })
  getByMovement(
    @Param('movementId', ParseUUIDPipe) movementId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dteService.getByMovementId(movementId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle completo de un DT-e con bitacora de estados' })
  getById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.dteService.getById(id, user);
  }
}
