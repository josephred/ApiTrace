import 'reflect-metadata';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  const apiPrefix = config.getOrThrow<string>('apiPrefix');
  const port = config.getOrThrow<number>('port');
  const corsOrigins = config.getOrThrow<string[]>('corsOrigins');

  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(compression());
  // Los origenes se aceptan con o sin esquema: Render inyecta el host pelado
  // (`apitrace-web.onrender.com`) y el navegador envia el origen completo.
  const allowedOrigins = corsOrigins.map((origin) =>
    origin.includes('://') ? origin : `https://${origin}`,
  );
  app.enableCors({
    origin: corsOrigins.includes('*') ? true : allowedOrigins,
    credentials: true,
    // El cliente necesita leer el correlation id para reportar incidencias,
    // y la marca de respuesta idempotente para no duplicar en la cola offline.
    exposedHeaders: ['x-correlation-id', 'idempotent-replay'],
  });

  app.setGlobalPrefix(apiPrefix, { exclude: ['health', 'ready'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.enableShutdownHooks();

  if (config.get<boolean>('swagger.enabled')) {
    const swaggerPath = config.getOrThrow<string>('swagger.path');
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('ApiTrace API')
        .setDescription(
          'Plataforma de trazabilidad apicola argentina. ' +
            'Modelo canonico propio; SENASA/SIGSA, ARCA y SIFeGA se integran mediante adaptadores.',
        )
        .setVersion('0.1.0')
        .addBearerAuth()
        .addTag('Identidad y acceso', 'CU-01 a CU-03')
        .addTag('Productores y registros', 'CU-04 a CU-06')
        .addTag('Produccion primaria', 'CU-07 y CU-08')
        .addTag('Movimientos y DT-e', 'CU-09 a CU-12')
        .addTag('Extraccion, lotes y tambores', 'CU-13 a CU-16, CU-21, CU-24, CU-25')
        .addTag('Trazabilidad', 'CU-17 a CU-19')
        .addTag('Auditoria', 'CU-33 y CU-34')
        .addTag('Operacion', 'Health checks')
        .build(),
    );
    SwaggerModule.setup(swaggerPath, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log(`OpenAPI disponible en /${swaggerPath}`);
  }

  await app.listen(port, '0.0.0.0');
  logger.log(`ApiTrace API escuchando en el puerto ${port} (prefijo /${apiPrefix})`);
}

void bootstrap();
