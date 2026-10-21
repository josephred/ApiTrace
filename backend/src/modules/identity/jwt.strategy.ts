import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import { user } from '../../database/schema';
import type { AuthenticatedUser, UserRoleName } from '../../common/types';

export interface JwtPayload {
  sub: string;
  email: string | null;
  role: UserRoleName;
  org: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  /**
   * Se relee el usuario en cada request: un token valido no debe seguir
   * habilitando a una cuenta suspendida ni conservar un rol ya revocado.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const rows = await this.db.select().from(user).where(eq(user.id, payload.sub)).limit(1);
    const record = rows[0];
    if (!record) {
      throw new UnauthorizedException('El usuario del token ya no existe.');
    }
    if (record.status !== 'ACTIVE') {
      throw new UnauthorizedException(`La cuenta se encuentra en estado ${record.status}.`);
    }
    return {
      id: record.id,
      email: record.email,
      fullName: record.fullName,
      role: record.role,
      organizationId: record.organizationId,
    };
  }
}
