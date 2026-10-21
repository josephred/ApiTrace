import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { configuration, validateConfig, type AppConfig } from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { IdentityModule } from './modules/identity/identity.module';
import { HealthModule } from './modules/health/health.module';
import { ProducerModule } from './modules/producer/producer.module';
import { EstablishmentModule } from './modules/establishment/establishment.module';
import { ApiaryModule } from './modules/apiary/apiary.module';
import { MovementModule } from './modules/movement/movement.module';
import { ProductionModule } from './modules/production/production.module';
import { TraceabilityModule } from './modules/traceability/traceability.module';
import { AuditModule } from './modules/audit/audit.module';
import { MediaModule } from './modules/media/media.module';
import { ZoneModule } from './modules/zone/zone.module';
import { TransportModule } from './modules/transport/transport.module';
import { PlacesModule } from './modules/places/places.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [() => validateConfig(configuration()) as unknown as Record<string, unknown>],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const throttle = config.getOrThrow<AppConfig['throttle']>('throttle');
        return { throttlers: [{ ttl: throttle.ttlMs, limit: throttle.limit }] };
      },
    }),
    DatabaseModule,
    CommonModule,
    HealthModule,
    MediaModule,
    IdentityModule,
    ProducerModule,
    EstablishmentModule,
    ApiaryModule,
    MovementModule,
    ProductionModule,
    TraceabilityModule,
    AuditModule,
    ZoneModule,
    TransportModule,
    PlacesModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
