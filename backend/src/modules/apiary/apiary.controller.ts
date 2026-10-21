import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiaryService } from './apiary.service';
import { CreateApiaryDto, CreateHiveDto, UpdateApiaryDto, UpdateHiveDto } from './dto/apiary.dto';
import { Audit, CorrelationId, CurrentUser, Roles } from '../../common/decorators';
import { paginated } from '../../common/dto/pagination.dto';
import { ListApiariesQueryDto } from '../../common/dto/filters.dto';
import type { AuthenticatedUser } from '../../common/types';

@ApiTags('Produccion primaria')
@ApiBearerAuth()
@Controller('apiaries')
export class ApiaryController {
  constructor(private readonly apiaries: ApiaryService) {}

  @Post()
  @Roles('ADMIN', 'PRODUCTOR')
  @Audit('APIARY_CREATED', 'apiary')
  @ApiOperation({
    summary: 'CU-07 Registrar apiario',
    description: 'El apiario pertenece al establecimiento, no directamente al RENSPA (regla 3).',
  })
  create(
    @Body() dto: CreateApiaryDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.apiaries.create(dto, actor, correlationId);
  }

  @Get()
  async list(@Query() query: ListApiariesQueryDto, @CurrentUser() actor: AuthenticatedUser) {
    const { rows, total } = await this.apiaries.list(query, actor, {
      establishmentId: query.establishmentId,
      zoneId: query.zoneId,
    });
    return paginated(rows, total, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.apiaries.findOne(id, actor);
  }

  @Patch(':id')
  @Roles('ADMIN', 'PRODUCTOR')
  @Audit('APIARY_UPDATED', 'apiary')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApiaryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.apiaries.update(id, dto, actor);
  }

  @Post(':id/hives')
  @Roles('ADMIN', 'PRODUCTOR')
  @Audit('HIVE_CREATED', 'hive')
  @ApiOperation({ summary: 'CU-08 Registrar colmena' })
  addHive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateHiveDto,
    @CurrentUser() actor: AuthenticatedUser,
    @CorrelationId() correlationId: string,
  ) {
    return this.apiaries.addHive(id, dto, actor, correlationId);
  }

  @Get(':id/hives')
  listHives(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.apiaries.listHives(id, actor);
  }

  @Patch(':id/hives/:hiveId')
  @Roles('ADMIN', 'PRODUCTOR')
  @Audit('HIVE_UPDATED', 'hive')
  @ApiOperation({ summary: 'CU-08 Editar colmena o darla de baja logica.' })
  updateHive(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('hiveId', ParseUUIDPipe) hiveId: string,
    @Body() dto: UpdateHiveDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.apiaries.updateHive(id, hiveId, dto, actor);
  }
}
