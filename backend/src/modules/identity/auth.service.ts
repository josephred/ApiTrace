import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { createHmac, randomBytes } from 'node:crypto';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { organization, refreshToken, user } from '../../database/schema';
import { AuditService } from '../../common/services/audit.service';
import type { AuthenticatedUser } from '../../common/types';
import type { JwtPayload } from './jwt.strategy';
import type { LoginDto, RegisterDto } from './dto/auth.dto';

/**
 * Dominios de las cuentas de demostracion, en orden de preferencia, para el
 * atajo de ingresar solo el nombre corto ("admin", "productor").
 */
const DEMO_LOGIN_DOMAINS = [
  'apitrace',
  'apitrace.test',
  'apitrace.ar',
  'apigestion.test',
  'beetrace.test',
] as const;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  tokenType: 'Bearer';
  user: AuthenticatedUser;
}

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  /**
   * CU-01. El primer usuario del sistema queda ADMIN activo: sin eso no habria
   * forma de administrar la plataforma recien desplegada. Los siguientes nacen
   * en CONSULTA/PENDING y requieren que un ADMIN les asigne rol (CU-03).
   */
  async register(dto: RegisterDto, actor?: AuthenticatedUser | null): Promise<AuthenticatedUser> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.db.select().from(user).where(eq(user.email, email)).limit(1);
    if (existing.length > 0) {
      throw new ConflictException('Ya existe un usuario con ese correo.');
    }

    const isFirstUser = (await this.db.select({ id: user.id }).from(user).limit(1)).length === 0;
    const actorIsAdmin = actor?.role === 'ADMIN';

    if ((dto.role || dto.organizationId) && !isFirstUser && !actorIsAdmin) {
      throw new ForbiddenException('Solo un ADMIN puede asignar rol u organizacion al registrar.');
    }

    if (dto.organizationId) {
      const org = await this.db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.id, dto.organizationId))
        .limit(1);
      if (org.length === 0) {
        throw new ConflictException('La organizacion indicada no existe.');
      }
    }

    const passwordHash = await hash(dto.password, BCRYPT_ROUNDS);
    const [created] = await this.db
      .insert(user)
      .values({
        email,
        passwordHash,
        fullName: dto.fullName.trim(),
        role: isFirstUser ? 'ADMIN' : (dto.role ?? 'CONSULTA'),
        status: isFirstUser || actorIsAdmin ? 'ACTIVE' : 'PENDING',
        organizationId: dto.organizationId ?? null,
      })
      .returning();

    const result: AuthenticatedUser = {
      id: created.id,
      email: created.email,
      fullName: created.fullName,
      role: created.role,
      organizationId: created.organizationId,
    };

    await this.audit.record({
      action: 'USER_REGISTERED',
      entityType: 'user',
      entityId: created.id,
      actor: actor ?? result,
      after: { email: result.email, role: result.role, status: created.status },
    });

    return result;
  }

  /** CU-02. */
  async login(dto: LoginDto, context?: { ip?: string; userAgent?: string }): Promise<AuthTokens> {
    const typed = dto.email.trim().toLowerCase();
    // Un correo completo identifica una sola cuenta: se busca exacto. Un nombre
    // corto ("productor") es el atajo de las cuentas de demostracion y se
    // resuelve en un orden fijo, para que nunca dependa del orden de la base.
    const candidates = typed.includes('@')
      ? [typed]
      : DEMO_LOGIN_DOMAINS.map((domain) => `${typed}@${domain}`);

    const rows = await this.db.select().from(user).where(inArray(user.email, candidates));
    const record = candidates
      .map((candidate) => rows.find((row) => row.email === candidate))
      .find((row) => row !== undefined);

    // Mensaje unico para credenciales invalidas: no revelar si el correo existe.
    const invalid = new UnauthorizedException('Credenciales invalidas.');
    if (!record) {
      // Hash ficticio para igualar el tiempo de respuesta y no filtrar la existencia.
      await compare(dto.password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
      throw invalid;
    }

    // Solo la contrasena guardada abre la cuenta. No hay contrasenas "de prueba"
    // aceptadas por dominio: en produccion serian una puerta abierta para
    // cualquier cuenta @apitrace (ver docs/plan-dte/09, hallazgo S-01).
    if (!(await compare(dto.password, record.passwordHash))) {
      throw invalid;
    }
    if (record.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        `La cuenta se encuentra en estado ${record.status}. Contacte a un administrador.`,
      );
    }

    await this.db.update(user).set({ lastLoginAt: new Date() }).where(eq(user.id, record.id));

    const authenticated: AuthenticatedUser = {
      id: record.id,
      email: record.email,
      fullName: record.fullName,
      role: record.role,
      organizationId: record.organizationId,
    };

    await this.audit.record({
      action: 'USER_LOGIN',
      entityType: 'user',
      entityId: record.id,
      actor: authenticated,
      ip: context?.ip,
      userAgent: context?.userAgent,
    });

    return this.issueTokens(authenticated, context);
  }

  async refresh(token: string, context?: { ip?: string; userAgent?: string }): Promise<AuthTokens> {
    const tokenHash = this.hashRefreshToken(token);
    const rows = await this.db
      .select()
      .from(refreshToken)
      .where(and(eq(refreshToken.tokenHash, tokenHash), isNull(refreshToken.revokedAt)))
      .limit(1);

    const record = rows[0];
    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token invalido o expirado.');
    }

    const userRows = await this.db.select().from(user).where(eq(user.id, record.userId)).limit(1);
    const account = userRows[0];
    if (!account || account.status !== 'ACTIVE') {
      throw new UnauthorizedException('La cuenta ya no esta habilitada.');
    }

    // Rotacion: el refresh usado se revoca al emitir el siguiente.
    await this.db
      .update(refreshToken)
      .set({ revokedAt: new Date() })
      .where(eq(refreshToken.id, record.id));

    return this.issueTokens(
      {
        id: account.id,
        email: account.email,
        fullName: account.fullName,
        role: account.role,
        organizationId: account.organizationId,
      },
      context,
    );
  }

  async logout(token: string): Promise<void> {
    await this.db
      .update(refreshToken)
      .set({ revokedAt: new Date() })
      .where(eq(refreshToken.tokenHash, this.hashRefreshToken(token)));
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db
      .update(refreshToken)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshToken.userId, userId), isNull(refreshToken.revokedAt)));
  }

  private async issueTokens(
    account: AuthenticatedUser,
    context?: { ip?: string; userAgent?: string },
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: account.id,
      email: account.email,
      role: account.role,
      org: account.organizationId,
    };
    const ttl = this.config.getOrThrow<string>('jwt.accessTtl');
    const expiresIn = ttl as JwtSignOptions['expiresIn'];
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      expiresIn,
    });

    // El refresh es opaco y aleatorio: se guarda hasheado, nunca en claro.
    const raw = randomBytes(48).toString('hex');
    const days = this.config.get<number>('jwt.refreshTtlDays') ?? 14;
    await this.db.insert(refreshToken).values({
      userId: account.id,
      tokenHash: this.hashRefreshToken(raw),
      expiresAt: new Date(Date.now() + days * 86_400_000),
      ip: context?.ip ?? null,
      userAgent: context?.userAgent?.slice(0, 300) ?? null,
    });

    return { accessToken, refreshToken: raw, expiresIn: ttl, tokenType: 'Bearer', user: account };
  }

  private hashRefreshToken(token: string): string {
    return createHmac('sha256', this.config.getOrThrow<string>('jwt.refreshSecret'))
      .update(token)
      .digest('hex');
  }
}
