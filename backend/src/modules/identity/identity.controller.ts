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
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { IdentityService } from './identity.service';
import {
  CreateOrganizationDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  SignupDto,
  UpdateUserRoleDto,
} from './dto/auth.dto';
import { Audit, CurrentUser, Public, Roles } from '../../common/decorators';
import { PaginationQueryDto, paginated } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../../common/types';

@ApiTags('Identidad y acceso')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'CU-01 Registrar usuario',
    description:
      'El primer usuario del sistema queda ADMIN activo. Los siguientes nacen PENDING hasta que un ADMIN les asigna rol.',
  })
  register(@Body() dto: RegisterDto, @CurrentUser() actor?: AuthenticatedUser) {
    return this.auth.register(dto, actor);
  }

  @Public()
  @Post('signup')
  // Alta publica: un tope propio por IP, mas estricto que el general.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Crear cuenta de apicultor (nombre, CUIT, RENAPA y contrasena)',
    description:
      'Crea organizacion, productor, RENAPA pendiente de verificacion y usuario PRODUCTOR activo, y devuelve la sesion iniciada. Luego se entra con la CUIT.',
  })
  signup(@Body() dto: SignupDto, @Req() req: Request) {
    return this.auth.signup(dto, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'CU-02 Autenticar usuario' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar el access token (rota el refresh token).' })
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revocar un refresh token.' })
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Datos del usuario autenticado.' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}

@ApiTags('Identidad y acceso')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly identity: IdentityService) {}

  @Get()
  @Roles('ADMIN', 'AUDITOR')
  @ApiOperation({ summary: 'Listar usuarios.' })
  async list(@Query() query: PaginationQueryDto) {
    const { rows, total } = await this.identity.listUsers(query);
    return paginated(rows, total, query);
  }

  @Get(':id')
  @Roles('ADMIN', 'AUDITOR')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.identity.getUser(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @Audit('USER_ROLE_UPDATED', 'user')
  @ApiOperation({ summary: 'CU-03 Administrar rol, organizacion y estado.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.identity.updateUser(id, dto, actor);
  }
}

@ApiTags('Identidad y acceso')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly identity: IdentityService) {}

  @Get()
  @ApiOperation({ summary: 'Listar organizaciones (tenants).' })
  async list(@Query() query: PaginationQueryDto) {
    const { rows, total } = await this.identity.listOrganizations(query);
    return paginated(rows, total, query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.identity.getOrganization(id);
  }

  @Post()
  @Roles('ADMIN')
  @Audit('ORGANIZATION_CREATED', 'organization')
  create(@Body() dto: CreateOrganizationDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.identity.createOrganization(dto, actor);
  }
}
