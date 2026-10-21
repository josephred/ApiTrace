import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { applyBodyLimits } from '../src/body-limits';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { cuitCheckDigit } from '../src/common/utils/cuit';
import { DRIZZLE, type Database } from '../src/database/database.module';
import { movementRule } from '../src/database/schema';
import { toArDate } from '../src/modules/movement/dte.rules';
import { TABLES } from './tables';

const PASSWORD = 'PruebaSegura2026';
const PREFIX = '/api/v1';

/** PNG de 1x1: alcanza para probar el camino de la foto sin depender de archivos. */
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** CUIT valida a partir de prefijo y DNI. */
const cuit = (prefix: string, dni: string): string => {
  const firstTen = `${prefix}${dni.padStart(8, '0')}`;
  return `${firstTen}${cuitCheckDigit(firstTen)}`;
};

interface Session {
  token: string;
  userId: string;
  organizationId: string | null;
}

/**
 * Rediseno de pantallas (doc 13): «Creá tu cuenta», maestros de datos
 * (zonas, apiarios con foto, salas, transportes), lugares para el asistente y
 * el tramite DT-e de cinco pasos con cualquier carga.
 */
describe('Cuenta, maestros y tramite DT-e de cinco pasos (e2e)', () => {
  let app: NestExpressApplication;
  let http: App;
  let db: Database;

  let admin: Session;
  let apicultor: Session;
  let sala: Session;
  let fraccionador: Session;

  const today = toArDate(new Date());
  const apicultorCuit = cuit('20', '30555111');

  const ctx = {
    zoneId: '',
    apiaryA: '',
    apiaryB: '',
    photoA: '',
    salaExtraccion: '',
    salaFotoId: '',
    salaFraccionamiento: '',
    finca: '',
    vehicleId: '',
    tramiteId: '',
  };

  const auth = (session: Session) => ({ Authorization: `Bearer ${session.token}` });

  const truncate = async () => {
    await db.execute(sql.raw(`TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`));
  };

  const login = async (identifier: string, password = PASSWORD): Promise<Session> => {
    const response = await request(http)
      .post(`${PREFIX}/auth/login`)
      .send({ email: identifier, password })
      .expect(200);
    return {
      token: response.body.accessToken,
      userId: response.body.user.id,
      organizationId: response.body.user.organizationId,
    };
  };

  const createOrgUser = async (email: string, role: string, orgName: string, orgType: string) => {
    const org = await request(http)
      .post(`${PREFIX}/organizations`)
      .set(auth(admin))
      .send({ name: orgName, type: orgType })
      .expect(201);
    await request(http)
      .post(`${PREFIX}/auth/register`)
      .set(auth(admin))
      .send({ email, password: PASSWORD, fullName: email, role, organizationId: org.body.id })
      .expect(201);
    return login(email);
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    applyBodyLimits(app);
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready'] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    http = app.getHttpServer() as App;
    db = app.get<Database>(DRIZZLE);

    await truncate();
    await db.insert(movementRule).values({
      name: 'Regla general sin documento',
      requiresDocument: false,
      effectiveFrom: new Date('2020-01-01T00:00:00Z'),
      priority: 900,
    });

    await request(http)
      .post(`${PREFIX}/auth/register`)
      .send({ email: 'admin@maestros.test', password: PASSWORD, fullName: 'Admin maestros' })
      .expect(201);
    admin = await login('admin@maestros.test');
    sala = await createOrgUser('sala@maestros.test', 'SALA', 'Sala Bravo', 'SALA_EXTRACCION');
    fraccionador = await createOrgUser(
      'fracc@maestros.test',
      'FRACCIONADOR',
      'Miel Frascos',
      'FRACCIONADOR',
    );
  });

  afterAll(async () => {
    await truncate();
    await app.close();
  });

  // ------------------------------------------------------------------ cuenta
  describe('Creá tu cuenta', () => {
    it('crea la cuenta del apicultor con nombre, CUIT, RENAPA y contrasena', async () => {
      const response = await request(http)
        .post(`${PREFIX}/auth/signup`)
        .send({
          fullName: '  Juan   Perez ',
          taxId: `${apicultorCuit.slice(0, 2)}-${apicultorCuit.slice(2, 10)}-${apicultorCuit.slice(10)}`,
          renapa: ' b53999 ',
          password: 'Colmena2026',
        })
        .expect(201);
      expect(response.body.accessToken).toBeTruthy();
      expect(response.body.user).toMatchObject({ fullName: 'Juan Perez', role: 'PRODUCTOR', email: null });
      expect(response.body.user.organizationId).toBeTruthy();
    });

    it('entra con la CUIT, con o sin guiones', async () => {
      apicultor = await login(apicultorCuit, 'Colmena2026');
      const dashed = `${apicultorCuit.slice(0, 2)}-${apicultorCuit.slice(2, 10)}-${apicultorCuit.slice(10)}`;
      await login(dashed, 'Colmena2026');
      await request(http)
        .post(`${PREFIX}/auth/login`)
        .send({ email: apicultorCuit, password: 'otra-clave' })
        .expect(401);
    });

    it('deja al productor con su RENAPA pendiente de verificacion', async () => {
      const list = await request(http).get(`${PREFIX}/producers`).set(auth(apicultor)).expect(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0]).toMatchObject({ businessName: 'Juan Perez', taxId: apicultorCuit });
      const detail = await request(http)
        .get(`${PREFIX}/producers/${list.body.data[0].id}`)
        .set(auth(apicultor))
        .expect(200);
      expect(detail.body.renapa).toEqual([
        expect.objectContaining({ number: 'B53999', status: 'PENDING_VERIFICATION' }),
      ]);
    });

    it('rechaza CUIT invalida, CUIT o RENAPA repetidos y contrasena corta', async () => {
      const invalid = await request(http)
        .post(`${PREFIX}/auth/signup`)
        .send({ fullName: 'Otro', taxId: '20-12345678-5', renapa: 'B1', password: 'Colmena2026' })
        .expect(400);
      expect(invalid.body.code).toBe('CUIT_INVALIDA');

      const repeated = await request(http)
        .post(`${PREFIX}/auth/signup`)
        .send({ fullName: 'Otro', taxId: apicultorCuit, renapa: 'B77777', password: 'Colmena2026' })
        .expect(409);
      expect(repeated.body.code).toBe('CUIT_REGISTRADA');

      const renapa = await request(http)
        .post(`${PREFIX}/auth/signup`)
        .send({ fullName: 'Otro', taxId: cuit('27', '30555112'), renapa: 'B53999', password: 'Colmena2026' })
        .expect(409);
      expect(renapa.body.code).toBe('RENAPA_REGISTRADO');

      await request(http)
        .post(`${PREFIX}/auth/signup`)
        .send({ fullName: 'Otro', taxId: cuit('27', '30555113'), renapa: 'B88888', password: 'corta' })
        .expect(400);
    });
  });

  // ------------------------------------------------------------------ zonas
  describe('Apiarios por zona', () => {
    it('crea zonas sin repetir el nombre', async () => {
      const created = await request(http)
        .post(`${PREFIX}/zones`)
        .set(auth(apicultor))
        .send({ name: '  Valle   de Uco ' })
        .expect(201);
      ctx.zoneId = created.body.id;
      expect(created.body.name).toBe('Valle de Uco');
      await request(http)
        .post(`${PREFIX}/zones`)
        .set(auth(apicultor))
        .send({ name: 'valle de uco' })
        .expect(409);
    });

    it('registra un apiario con zona, ubicacion, colmenas y foto, sin predio ni codigo', async () => {
      const response = await request(http)
        .post(`${PREFIX}/apiaries`)
        .set(auth(apicultor))
        .send({
          name: 'La Rotonda',
          zoneId: ctx.zoneId,
          latitude: -33.5791,
          longitude: -69.0158,
          hiveCount: 45,
          photo: { dataUrl: PNG_1PX, thumbnailDataUrl: PNG_1PX, width: 1, height: 1 },
        })
        .expect(201);
      ctx.apiaryA = response.body.id;
      ctx.photoA = response.body.photoId;
      expect(response.body).toMatchObject({ code: 'API-001', hiveCount: 45, zoneId: ctx.zoneId });
      expect(ctx.photoA).toBeTruthy();

      const predios = await request(http)
        .get(`${PREFIX}/establishments?type=APIARIO_BASE`)
        .set(auth(apicultor))
        .expect(200);
      expect(predios.body.data).toHaveLength(1);
      expect(predios.body.data[0].name).toBe('Apiarios de Juan Perez');
    });

    it('crea la zona al vuelo por nombre y numera el siguiente apiario', async () => {
      const response = await request(http)
        .post(`${PREFIX}/apiaries`)
        .set(auth(apicultor))
        .send({ name: 'UPA 5', zoneName: 'Zona Norte', hiveCount: 20 })
        .expect(201);
      ctx.apiaryB = response.body.id;
      expect(response.body.code).toBe('API-002');

      const zones = await request(http).get(`${PREFIX}/zones`).set(auth(apicultor)).expect(200);
      expect(zones.body.map((row: { name: string; apiaryCount: number }) => `${row.name}:${row.apiaryCount}`)).toEqual([
        'Valle de Uco:1',
        'Zona Norte:1',
      ]);

      const filtered = await request(http)
        .get(`${PREFIX}/apiaries?zoneId=${ctx.zoneId}`)
        .set(auth(apicultor))
        .expect(200);
      expect(filtered.body.data.map((row: { name: string; zoneName: string }) => `${row.name}/${row.zoneName}`)).toEqual([
        'La Rotonda/Valle de Uco',
      ]);
    });

    it('sirve la foto y su miniatura solo a la organizacion duena', async () => {
      const full = await request(http).get(`${PREFIX}/media/${ctx.photoA}`).set(auth(apicultor)).expect(200);
      expect(full.body.dataUrl).toBe(PNG_1PX);
      await request(http).get(`${PREFIX}/media/${ctx.photoA}/thumbnail`).set(auth(apicultor)).expect(200);
      await request(http).get(`${PREFIX}/media/${ctx.photoA}`).set(auth(sala)).expect(404);
    });

    it('rechaza una foto de mas de 3 MB', async () => {
      const big = `data:image/jpeg;base64,${Buffer.alloc(3 * 1024 * 1024 + 10, 7).toString('base64')}`;
      const response = await request(http)
        .post(`${PREFIX}/apiaries`)
        .set(auth(apicultor))
        .send({ name: 'Pesado', photo: { dataUrl: big } })
        .expect(413);
      expect(response.body.code).toBe('FOTO_DEMASIADO_GRANDE');
    });
  });

  // ------------------------------------------------------------------ salas
  describe('Salas y otros lugares', () => {
    it('registra la sala de extraccion con RNE, ubicacion y foto publica', async () => {
      const response = await request(http)
        .post(`${PREFIX}/establishments`)
        .set(auth(sala))
        .send({
          name: 'Bravo Tunuyan',
          type: 'SALA_EXTRACCION',
          rne: ' rne-13-000901 ',
          senasaCode: 'SEF-M-00901',
          senasaStatus: 'ACTIVE',
          latitude: -33.5762,
          longitude: -69.0153,
          photo: { dataUrl: PNG_1PX },
        })
        .expect(201);
      ctx.salaExtraccion = response.body.id;
      ctx.salaFotoId = response.body.photoId;
      expect(response.body.rne).toBe('RNE-13-000901');
      // La sala es destino publico: su foto la ve tambien el apicultor.
      await request(http).get(`${PREFIX}/media/${ctx.salaFotoId}`).set(auth(apicultor)).expect(200);
    });

    it('registra la sala de fraccionamiento y la finca de polinizacion', async () => {
      const fracc = await request(http)
        .post(`${PREFIX}/establishments`)
        .set(auth(fraccionador))
        .send({ name: 'Miel Frascos', type: 'FRACCIONADORA', rne: 'RNE-13-003080', latitude: -32.89, longitude: -68.84 })
        .expect(201);
      ctx.salaFraccionamiento = fracc.body.id;
      const finca = await request(http)
        .post(`${PREFIX}/establishments`)
        .set(auth(apicultor))
        .send({ name: 'Finca Los Almendros', type: 'FINCA_POLINIZACION', latitude: -33.6, longitude: -69.1 })
        .expect(201);
      ctx.finca = finca.body.id;
    });
  });

  // ------------------------------------------------------------- transportes
  describe('Transportes', () => {
    it('guarda conductor, patente y carro normalizados', async () => {
      const response = await request(http)
        .post(`${PREFIX}/vehicles`)
        .set(auth(apicultor))
        .send({
          driverName: ' Juan  Perez ',
          plate: 'ab 123 cd',
          trailerPlate: 'ac-456-ef',
          type: 'CAMIONETA',
          name: 'Camioneta Hilux',
        })
        .expect(201);
      ctx.vehicleId = response.body.id;
      expect(response.body).toMatchObject({
        driverName: 'Juan Perez',
        plate: 'AB123CD',
        trailerPlate: 'AC456EF',
        organizationId: apicultor.organizationId,
      });
    });

    it('no repite la patente en la misma organizacion, si en otra', async () => {
      await request(http)
        .post(`${PREFIX}/vehicles`)
        .set(auth(apicultor))
        .send({ driverName: 'Otro chofer', plate: 'AB123CD' })
        .expect(409);
      await request(http)
        .post(`${PREFIX}/vehicles`)
        .set(auth(sala))
        .send({ driverName: 'Flete', plate: 'AB123CD', type: 'CAMION' })
        .expect(201);
      const list = await request(http).get(`${PREFIX}/vehicles`).set(auth(apicultor)).expect(200);
      expect(list.body.map((row: { plate: string }) => row.plate)).toEqual(['AB123CD']);
    });
  });

  // ------------------------------------------------------------------ lugares
  describe('Lugares del asistente y del mapa', () => {
    it('como origen ofrece solo lo propio; como destino, tambien las salas de otros', async () => {
      const apiaries = await request(http)
        .get(`${PREFIX}/places?side=origin&type=APIARIO`)
        .set(auth(apicultor))
        .expect(200);
      expect(apiaries.body.map((row: { name: string }) => row.name)).toEqual(['La Rotonda', 'UPA 5']);
      expect(apiaries.body[0]).toMatchObject({ zoneName: 'Valle de Uco', hiveCount: 45, own: true });

      const ownSalas = await request(http)
        .get(`${PREFIX}/places?side=origin&type=SALA_EXTRACCION`)
        .set(auth(apicultor))
        .expect(200);
      expect(ownSalas.body).toEqual([]);

      const salas = await request(http)
        .get(`${PREFIX}/places?side=destination&type=SALA_EXTRACCION`)
        .set(auth(apicultor))
        .expect(200);
      expect(salas.body).toEqual([
        expect.objectContaining({
          id: ctx.salaExtraccion,
          code: 'SEF-M-00901',
          codeLabel: 'Habilitacion',
          own: false,
          organizationName: 'Sala Bravo',
        }),
      ]);

      const fincas = await request(http)
        .get(`${PREFIX}/places?side=destination&type=FINCA_POLINIZACION`)
        .set(auth(sala))
        .expect(200);
      expect(fincas.body).toEqual([]);
    });

    it('arma el mapa con lo que tiene ubicacion y avisa lo que no', async () => {
      const response = await request(http).get(`${PREFIX}/places/map`).set(auth(apicultor)).expect(200);
      const names = response.body.places.map((row: { name: string }) => row.name).sort();
      expect(names).toEqual(['Bravo Tunuyan', 'Finca Los Almendros', 'La Rotonda', 'Miel Frascos']);
      expect(response.body.withoutLocation).toEqual([
        expect.objectContaining({ name: 'UPA 5', placeType: 'APIARIO' }),
      ]);
    });
  });

  // ------------------------------------------------------------------ tramite
  describe('Nuevo tramite DT-e de cinco pasos', () => {
    it('verifica colmenas de un apiario a una finca como tramite manual, con el vehiculo guardado', async () => {
      const response = await request(http)
        .post(`${PREFIX}/dte/preflight`)
        .set(auth(apicultor))
        .send({
          cargoType: 'COLMENAS',
          apiaryId: ctx.apiaryA,
          destinationEstablishmentId: ctx.finca,
          declaredQuantity: 24,
          loadDate: today,
          vehicleId: ctx.vehicleId,
        })
        .expect(200);
      expect(response.body).toMatchObject({ ok: true, kind: 'TRAMITE' });
      const codes = response.body.checks.map((check: { code: string; status: string }) => `${check.code}:${check.status}`);
      expect(codes).toEqual(
        expect.arrayContaining(['ORIGEN:ok', 'DESTINO:ok', 'CANTIDAD:ok', 'TRANSPORTE:ok', 'EMISION_MANUAL:info']),
      );
    });

    it('crea el tramite en borrador con la carga, el recorrido y el transporte del vehiculo', async () => {
      const response = await request(http)
        .post(`${PREFIX}/dte`)
        .set(auth(apicultor))
        .send({
          cargoType: 'COLMENAS',
          apiaryId: ctx.apiaryA,
          destinationEstablishmentId: ctx.finca,
          declaredQuantity: 24,
          loadDate: today,
          vehicleId: ctx.vehicleId,
        })
        .expect(201);
      ctx.tramiteId = response.body.id;
      expect(response.body).toMatchObject({
        status: 'BORRADOR',
        issueMode: 'MANUAL',
        transportPlate: 'AB123CD',
        transportTrailerPlate: 'AC456EF',
        declaredQuantity: 24,
      });

      const detail = await request(http).get(`${PREFIX}/dte/${ctx.tramiteId}`).set(auth(apicultor)).expect(200);
      expect(detail.body.movement).toMatchObject({ cargoType: 'COLMENAS', unit: 'COLMENA', driverName: 'Juan Perez' });
      expect(detail.body.destination.name).toBe('Finca Los Almendros');
      expect(detail.body.allowedActions).toContain('issueManual');
      expect(detail.body.allowedActions).not.toContain('requestEmission');
    });

    it('no pide a SIGSA un tramite que no es API-SEM', async () => {
      const response = await request(http)
        .post(`${PREFIX}/dte`)
        .set(auth(apicultor))
        .send({
          cargoType: 'COLMENAS',
          apiaryId: ctx.apiaryA,
          destinationEstablishmentId: ctx.finca,
          declaredQuantity: 10,
          loadDate: today,
          vehicleId: ctx.vehicleId,
          submit: true,
        })
        .expect(400);
      expect(response.body.code).toBe('TRAMITE_SOLO_MANUAL');
    });

    it('lleva nucleos de un apiario a otro del mismo predio, pero no al mismo apiario', async () => {
      await request(http)
        .post(`${PREFIX}/dte`)
        .set(auth(apicultor))
        .send({
          cargoType: 'NUCLEOS',
          apiaryId: ctx.apiaryA,
          destinationApiaryId: ctx.apiaryB,
          declaredQuantity: 8,
          loadDate: today,
          vehicleId: ctx.vehicleId,
        })
        .expect(201);
      const same = await request(http)
        .post(`${PREFIX}/dte`)
        .set(auth(apicultor))
        .send({
          cargoType: 'NUCLEOS',
          apiaryId: ctx.apiaryA,
          destinationApiaryId: ctx.apiaryA,
          declaredQuantity: 8,
          loadDate: today,
        })
        .expect(400);
      expect(same.body.code).toBe('ORIGEN_IGUAL_DESTINO');
    });

    it('alzas de un apiario a una sala de extraccion siguen siendo API-SEM, con el transporte del vehiculo', async () => {
      const response = await request(http)
        .post(`${PREFIX}/dte/preflight`)
        .set(auth(apicultor))
        .send({
          apiaryId: ctx.apiaryA,
          destinationEstablishmentId: ctx.salaExtraccion,
          declaredQuantity: 100,
          loadDate: today,
          vehicleId: ctx.vehicleId,
        })
        .expect(200);
      expect(response.body.kind).toBe('API_SEM');
      const transport = response.body.checks.find((check: { code: string }) => check.code === 'TRANSPORTE');
      expect(transport).toMatchObject({ status: 'ok', message: 'CAMIONETA AB123CD + acoplado AC456EF' });
    });

    it('la sala despacha tambores a una sala de fraccionamiento; el apicultor no puede despachar desde una sala ajena', async () => {
      const response = await request(http)
        .post(`${PREFIX}/dte`)
        .set(auth(sala))
        .send({
          cargoType: 'TAMBORES',
          originEstablishmentId: ctx.salaExtraccion,
          destinationEstablishmentId: ctx.salaFraccionamiento,
          declaredQuantity: 12,
          loadDate: today,
          transport: { type: 'CAMION', plate: 'AE123BB' },
        })
        .expect(201);
      expect(response.body).toMatchObject({ status: 'BORRADOR', declaredQuantity: 12 });

      await request(http)
        .post(`${PREFIX}/dte`)
        .set(auth(apicultor))
        .send({
          cargoType: 'TAMBORES',
          originEstablishmentId: ctx.salaExtraccion,
          destinationEstablishmentId: ctx.salaFraccionamiento,
          declaredQuantity: 12,
          loadDate: today,
        })
        .expect(403);
    });
  });
});
