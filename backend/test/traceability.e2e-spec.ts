import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { DRIZZLE, type Database } from '../src/database/database.module';
import { movementRule } from '../src/database/schema';

const PASSWORD = 'PruebaSegura2026';
const PREFIX = '/api/v1';

interface Session {
  token: string;
  userId: string;
  organizationId: string | null;
}

/**
 * Recorre la columna vertebral del MVP tal como la define el documento de
 * casos de uso (CU-04 a CU-18) contra HTTP real y PostgreSQL real.
 * Si esta prueba pasa, el modelo puede representar la trazabilidad en ambos sentidos.
 */
describe('ApiTrace - columna vertebral CU-04 a CU-18 (e2e)', () => {
  let app: INestApplication;
  let http: App;
  let db: Database;

  let admin: Session;
  let productorUser: Session;
  let salaUser: Session;
  let acopioUser: Session;

  const ctx = {
    orgProductor: '',
    orgSala: '',
    orgAcopio: '',
    producerId: '',
    estApiario: '',
    estSala: '',
    estAcopio: '',
    apiaryId: '',
    movementId: '',
    extractionId: '',
    lotSalaId: '',
    drumId: '',
    lotAcopioId: '',
  };

  const auth = (session: Session) => ({ Authorization: `Bearer ${session.token}` });

  const login = async (email: string): Promise<Session> => {
    const response = await request(http)
      .post(`${PREFIX}/auth/login`)
      .send({ email, password: PASSWORD })
      .expect(200);
    return {
      token: response.body.accessToken,
      userId: response.body.user.id,
      organizationId: response.body.user.organizationId,
    };
  };

  const createUser = async (
    email: string,
    fullName: string,
    role: string,
    organizationId: string | null,
  ): Promise<Session> => {
    await request(http)
      .post(`${PREFIX}/auth/register`)
      .set(auth(admin))
      .send({ email, password: PASSWORD, fullName, role, organizationId: organizationId ?? undefined })
      .expect(201);
    return login(email);
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready'] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    http = app.getHttpServer() as App;
    db = app.get<Database>(DRIZZLE);

    // La regla normativa se carga explicitamente: la prueba verifica su vigencia.
    await db.insert(movementRule).values([
      {
        name: 'Regla general sin documento',
        requiresDocument: false,
        effectiveFrom: new Date('2020-01-01T00:00:00Z'),
        priority: 900,
      },
      {
        name: 'DT-e obligatorio material melario apiario -> sala',
        movementType: 'MATERIAL_MELARIO',
        materialType: 'MATERIAL_MELARIO',
        originType: 'APIARIO_BASE',
        destinationType: 'SALA_EXTRACCION',
        requiresDocument: true,
        requiredDocumentType: 'DTE',
        effectiveFrom: new Date('2026-08-01T00:00:00Z'),
        priority: 10,
      },
    ]);

    // El primer usuario registrado queda ADMIN activo.
    await request(http)
      .post(`${PREFIX}/auth/register`)
      .send({ email: 'admin@test.local', password: PASSWORD, fullName: 'Admin Test' })
      .expect(201);
    admin = await login('admin@test.local');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('CU-01 a CU-03 - identidad y organizaciones', () => {
    it('crea las organizaciones participantes', async () => {
      const orgs = [
        { name: 'Org Productor', type: 'PRODUCTOR', key: 'orgProductor' as const },
        { name: 'Org Sala', type: 'SALA_EXTRACCION', key: 'orgSala' as const },
        { name: 'Org Acopio', type: 'ACOPIO', key: 'orgAcopio' as const },
      ];
      for (const org of orgs) {
        const response = await request(http)
          .post(`${PREFIX}/organizations`)
          .set(auth(admin))
          .send({ name: org.name, type: org.type })
          .expect(201);
        ctx[org.key] = response.body.id;
      }
    });

    it('crea usuarios con rol y organizacion', async () => {
      productorUser = await createUser(
        'productor@test.local',
        'Productor Test',
        'PRODUCTOR',
        ctx.orgProductor,
      );
      salaUser = await createUser('sala@test.local', 'Sala Test', 'SALA', ctx.orgSala);
      acopioUser = await createUser('acopio@test.local', 'Acopio Test', 'ACOPIADOR', ctx.orgAcopio);

      expect(productorUser.organizationId).toBe(ctx.orgProductor);
      expect(salaUser.organizationId).toBe(ctx.orgSala);
    });

    it('rechaza credenciales invalidas sin revelar si el correo existe', async () => {
      const response = await request(http)
        .post(`${PREFIX}/auth/login`)
        .send({ email: 'productor@test.local', password: 'incorrecta' })
        .expect(401);
      expect(response.body.message).toBe('Credenciales invalidas.');

      const unknown = await request(http)
        .post(`${PREFIX}/auth/login`)
        .send({ email: 'noexiste@test.local', password: 'incorrecta' })
        .expect(401);
      expect(unknown.body.message).toBe(response.body.message);
    });
  });

  describe('CU-04 a CU-08 - productor, registros oficiales y produccion primaria', () => {
    it('CU-04: registra el productor', async () => {
      const response = await request(http)
        .post(`${PREFIX}/producers`)
        .set(auth(productorUser))
        .send({
          businessName: 'Apicultor de Prueba',
          personType: 'FISICA',
          taxId: '20-30111222-3',
          province: 'Buenos Aires',
        })
        .expect(201);
      ctx.producerId = response.body.id;
      expect(response.body.organizationId).toBe(ctx.orgProductor);
      // El CUIT se normaliza sin guiones: el identificador externo no es la PK.
      expect(response.body.taxId).toBe('20301112223');
    });

    it('CU-05: asocia el RENAPA como registro propio, no como campo del productor', async () => {
      const response = await request(http)
        .post(`${PREFIX}/producers/${ctx.producerId}/renapa`)
        .set(auth(productorUser))
        .send({ number: 'RENAPA-TEST-0001', status: 'ACTIVE' })
        .expect(201);
      expect(response.body.producerId).toBe(ctx.producerId);
      expect(response.body.syncStatus).toBe('PENDING_SYNC');
    });

    it('CU-05: impide asociar el mismo RENAPA a dos productores', async () => {
      const otro = await request(http)
        .post(`${PREFIX}/producers`)
        .set(auth(productorUser))
        .send({ businessName: 'Otro Apicultor' })
        .expect(201);

      await request(http)
        .post(`${PREFIX}/producers/${otro.body.id}/renapa`)
        .set(auth(productorUser))
        .send({ number: 'RENAPA-TEST-0001' })
        .expect(409);
    });

    it('CU-06: registra establecimientos y asocia sus RENSPA', async () => {
      const apiarioBase = await request(http)
        .post(`${PREFIX}/establishments`)
        .set(auth(productorUser))
        .send({
          name: 'Predio de Prueba',
          type: 'APIARIO_BASE',
          producerId: ctx.producerId,
          latitude: -34.6,
          longitude: -59.1,
        })
        .expect(201);
      ctx.estApiario = apiarioBase.body.id;

      await request(http)
        .post(`${PREFIX}/establishments/${ctx.estApiario}/renspa`)
        .set(auth(productorUser))
        .send({ number: '01.001.0.00001/01', producerId: ctx.producerId, status: 'ACTIVE' })
        .expect(201);

      const sala = await request(http)
        .post(`${PREFIX}/establishments`)
        .set(auth(salaUser))
        .send({ name: 'Sala de Prueba', type: 'SALA_EXTRACCION' })
        .expect(201);
      ctx.estSala = sala.body.id;

      const acopio = await request(http)
        .post(`${PREFIX}/establishments`)
        .set(auth(acopioUser))
        .send({ name: 'Acopio de Prueba', type: 'ACOPIO' })
        .expect(201);
      ctx.estAcopio = acopio.body.id;
    });

    it('CU-07 y CU-08: registra el apiario y sus colmenas', async () => {
      const apiary = await request(http)
        .post(`${PREFIX}/apiaries`)
        .set(auth(productorUser))
        .send({ establishmentId: ctx.estApiario, code: 'api-001', name: 'Apiario Test' })
        .expect(201);
      ctx.apiaryId = apiary.body.id;
      expect(apiary.body.code).toBe('API-001');

      for (const code of ['COL-001', 'COL-002', 'COL-003']) {
        await request(http)
          .post(`${PREFIX}/apiaries/${ctx.apiaryId}/hives`)
          .set(auth(productorUser))
          .send({ code })
          .expect(201);
      }

      const detail = await request(http)
        .get(`${PREFIX}/apiaries/${ctx.apiaryId}`)
        .set(auth(productorUser))
        .expect(200);
      // hive_count se recalcula sobre las colmenas activas, no se acumula.
      expect(detail.body.hiveCount).toBe(3);
    });

    it('rechaza un apiario duplicado dentro del mismo establecimiento', async () => {
      await request(http)
        .post(`${PREFIX}/apiaries`)
        .set(auth(productorUser))
        .send({ establishmentId: ctx.estApiario, code: 'API-001' })
        .expect(409);
    });
  });

  describe('Motor de reglas normativas versionadas', () => {
    it('no exige DT-e para un traslado anterior al 01/08/2026', async () => {
      const response = await request(http)
        .post(`${PREFIX}/movements`)
        .set(auth(productorUser))
        .send({
          movementType: 'MATERIAL_MELARIO',
          materialType: 'MATERIAL_MELARIO',
          originEstablishmentId: ctx.estApiario,
          originApiaryId: ctx.apiaryId,
          destinationEstablishmentId: ctx.estSala,
          scheduledAt: '2026-07-15T09:00:00.000Z',
          quantity: 100,
          unit: 'KG',
        })
        .expect(201);
      expect(response.body.requiresDocument).toBe(false);

      await request(http)
        .post(`${PREFIX}/movements/${response.body.id}/cancel`)
        .set(auth(productorUser))
        .send({ reason: 'Movimiento de prueba de vigencia normativa.' })
        .expect(200);
    });

    it('exige DT-e para el mismo traslado a partir del 01/08/2026', async () => {
      const response = await request(http)
        .post(`${PREFIX}/movements`)
        .set(auth(productorUser))
        .send({
          movementType: 'MATERIAL_MELARIO',
          materialType: 'MATERIAL_MELARIO',
          originEstablishmentId: ctx.estApiario,
          originApiaryId: ctx.apiaryId,
          destinationEstablishmentId: ctx.estSala,
          scheduledAt: '2026-11-10T09:00:00.000Z',
          quantity: 900,
          unit: 'KG',
        })
        .expect(201);
      ctx.movementId = response.body.id;
      expect(response.body.requiresDocument).toBe(true);
      expect(response.body.requiredDocumentType).toBe('DTE');
      expect(response.body.code).toMatch(/^MOV-2026-\d{6}$/);
    });
  });

  describe('CU-09 a CU-12 - movimiento y DT-e', () => {
    it('rechaza origen y destino identicos', async () => {
      await request(http)
        .post(`${PREFIX}/movements`)
        .set(auth(productorUser))
        .send({
          movementType: 'MIEL_A_GRANEL',
          materialType: 'MIEL',
          originEstablishmentId: ctx.estSala,
          destinationEstablishmentId: ctx.estSala,
          scheduledAt: '2026-11-10T09:00:00.000Z',
          quantity: 10,
          unit: 'KG',
        })
        .expect(400);
    });

    it('bloquea el despacho mientras falte el DT-e exigido', async () => {
      const response = await request(http)
        .post(`${PREFIX}/movements/${ctx.movementId}/dispatch`)
        .set(auth(productorUser))
        .send({})
        .expect(409);
      expect(String(response.body.message)).toContain('DT-e');
    });

    it('CU-10: registra el DT-e y permite despachar', async () => {
      const dte = await request(http)
        .post(`${PREFIX}/movements/${ctx.movementId}/dte`)
        .set(auth(productorUser))
        .send({ number: 'DTE-TEST-0001' })
        .expect(201);
      expect(dte.body.status).toBe('ISSUED');
      expect(dte.body.syncStatus).toBe('PENDING_SYNC');
      expect(dte.body.originRenspa).toBe('01.001.0.00001/01');

      await request(http)
        .post(`${PREFIX}/movements/${ctx.movementId}/dispatch`)
        .set(auth(productorUser))
        .send({ dispatchedAt: '2026-11-10T10:00:00.000Z' })
        .expect(200);
    });

    it('CU-11: solo el destino puede registrar la recepcion', async () => {
      await request(http)
        .post(`${PREFIX}/movements/${ctx.movementId}/receive`)
        .set(auth(productorUser))
        .send({ receivedQuantity: 900 })
        .expect(409);

      const response = await request(http)
        .post(`${PREFIX}/movements/${ctx.movementId}/receive`)
        .set(auth(salaUser))
        .send({
          receivedQuantity: 898,
          receivedAt: '2026-11-10T14:00:00.000Z',
          discrepancyNotes: 'Merma de 2 kg en el traslado.',
        })
        .expect(201);
      expect(response.body.hasDiscrepancy).toBe(true);
      expect(response.body.result).toBe('PARTIAL');
    });

    it('exige justificar una diferencia de cantidad', async () => {
      const otro = await request(http)
        .post(`${PREFIX}/movements`)
        .set(auth(productorUser))
        .send({
          movementType: 'MATERIAL_MELARIO',
          materialType: 'MATERIAL_MELARIO',
          originEstablishmentId: ctx.estApiario,
          originApiaryId: ctx.apiaryId,
          destinationEstablishmentId: ctx.estSala,
          scheduledAt: '2026-11-11T09:00:00.000Z',
          quantity: 50,
          unit: 'KG',
        })
        .expect(201);

      await request(http)
        .post(`${PREFIX}/movements/${otro.body.id}/dte`)
        .set(auth(productorUser))
        .send({ number: 'DTE-TEST-0002' })
        .expect(201);
      await request(http)
        .post(`${PREFIX}/movements/${otro.body.id}/dispatch`)
        .set(auth(productorUser))
        .send({})
        .expect(200);

      await request(http)
        .post(`${PREFIX}/movements/${otro.body.id}/receive`)
        .set(auth(salaUser))
        .send({ receivedQuantity: 30 })
        .expect(400);
    });

    it('CU-12: cierra el DT-e solo despues de la recepcion', async () => {
      const response = await request(http)
        .post(`${PREFIX}/movements/${ctx.movementId}/dte/close`)
        .set(auth(salaUser))
        .send({ closedAt: '2026-11-10T15:00:00.000Z' })
        .expect(200);
      expect(response.body.status).toBe('CLOSED');
      expect(response.body.closedAt).toBeTruthy();
    });

    it('no permite cerrar dos veces el mismo DT-e', async () => {
      await request(http)
        .post(`${PREFIX}/movements/${ctx.movementId}/dte/close`)
        .set(auth(salaUser))
        .send({})
        .expect(409);
    });

    it('respeta la clave de idempotencia ante un reintento', async () => {
      const payload = {
        movementType: 'MIEL_A_GRANEL',
        materialType: 'MIEL',
        originEstablishmentId: ctx.estSala,
        destinationEstablishmentId: ctx.estAcopio,
        scheduledAt: '2026-12-01T09:00:00.000Z',
        quantity: 120,
        unit: 'KG',
      };
      const first = await request(http)
        .post(`${PREFIX}/movements`)
        .set(auth(salaUser))
        .set('Idempotency-Key', 'clave-de-prueba-001')
        .send(payload)
        .expect(201);

      const retry = await request(http)
        .post(`${PREFIX}/movements`)
        .set(auth(salaUser))
        .set('Idempotency-Key', 'clave-de-prueba-001')
        .send(payload)
        .expect(201);

      expect(retry.body.id).toBe(first.body.id);
      expect(retry.headers['idempotent-replay']).toBe('true');
    });
  });

  describe('CU-13 a CU-16 - extraccion, lote y tambores', () => {
    it('CU-13: registra la extraccion consumiendo el movimiento recibido', async () => {
      const response = await request(http)
        .post(`${PREFIX}/extractions`)
        .set(auth(salaUser))
        .send({
          establishmentId: ctx.estSala,
          inputs: [{ movementId: ctx.movementId, quantity: 898, unit: 'KG' }],
          startedAt: '2026-11-11T08:00:00.000Z',
          finishedAt: '2026-11-11T17:00:00.000Z',
          outputQuantity: 600,
        })
        .expect(201);
      ctx.extractionId = response.body.id;
      expect(response.body.status).toBe('COMPLETED');
    });

    it('impide que un movimiento alimente dos extracciones', async () => {
      await request(http)
        .post(`${PREFIX}/extractions`)
        .set(auth(salaUser))
        .send({
          establishmentId: ctx.estSala,
          inputs: [{ movementId: ctx.movementId, quantity: 100, unit: 'KG' }],
          startedAt: '2026-11-12T08:00:00.000Z',
        })
        .expect(409);
    });

    it('CU-14 y CU-15: crea el lote heredando la trazabilidad de la extraccion', async () => {
      const response = await request(http)
        .post(`${PREFIX}/lots`)
        .set(auth(salaUser))
        .send({
          establishmentId: ctx.estSala,
          extractionId: ctx.extractionId,
          productionDate: '2026-11-11T17:00:00.000Z',
          quantity: 600,
          unit: 'KG',
          honeyType: 'Multifloral',
        })
        .expect(201);
      ctx.lotSalaId = response.body.id;

      const detail = await request(http)
        .get(`${PREFIX}/lots/${ctx.lotSalaId}`)
        .set(auth(salaUser))
        .expect(200);
      // La arista hacia la extraccion se agrega sola: un lote de sala nunca queda sin origen.
      expect(detail.body.inputs).toHaveLength(1);
      expect(detail.body.inputs[0].sourceType).toBe('EXTRACTION');
    });

    it('CU-16: registra tambores sin superar la cantidad del lote', async () => {
      const first = await request(http)
        .post(`${PREFIX}/lots/${ctx.lotSalaId}/drums`)
        .set(auth(salaUser))
        .send({ netWeight: 300, tareWeight: 25, grossWeight: 325 })
        .expect(201);
      ctx.drumId = first.body.id;

      await request(http)
        .post(`${PREFIX}/lots/${ctx.lotSalaId}/drums`)
        .set(auth(salaUser))
        .send({ netWeight: 300 })
        .expect(201);

      // El tercer tambor excederia los 600 kg declarados por el lote.
      await request(http)
        .post(`${PREFIX}/lots/${ctx.lotSalaId}/drums`)
        .set(auth(salaUser))
        .send({ netWeight: 100 })
        .expect(409);
    });

    it('rechaza un peso neto que no cierra con bruto menos tara', async () => {
      await request(http)
        .post(`${PREFIX}/lots/${ctx.lotSalaId}/drums`)
        .set(auth(salaUser))
        .send({ netWeight: 10, tareWeight: 25, grossWeight: 100 })
        .expect(400);
    });

    it('crea el lote de acopio a partir del lote de sala y descuenta disponibilidad', async () => {
      const response = await request(http)
        .post(`${PREFIX}/lots`)
        .set(auth(acopioUser))
        .send({
          establishmentId: ctx.estAcopio,
          lotType: 'ACOPIO',
          productionDate: '2026-12-02T09:00:00.000Z',
          quantity: 400,
          unit: 'KG',
          inputs: [{ sourceType: 'LOT', sourceLotId: ctx.lotSalaId, quantity: 400, unit: 'KG' }],
        })
        .expect(201);
      ctx.lotAcopioId = response.body.id;

      const origen = await request(http)
        .get(`${PREFIX}/lots/${ctx.lotSalaId}`)
        .set(auth(salaUser))
        .expect(200);
      expect(Number(origen.body.availableQuantity)).toBeCloseTo(200, 3);
    });

    it('impide consumir mas de lo disponible en el lote de origen', async () => {
      await request(http)
        .post(`${PREFIX}/lots`)
        .set(auth(acopioUser))
        .send({
          establishmentId: ctx.estAcopio,
          lotType: 'ACOPIO',
          productionDate: '2026-12-03T09:00:00.000Z',
          quantity: 500,
          unit: 'KG',
          inputs: [{ sourceType: 'LOT', sourceLotId: ctx.lotSalaId, quantity: 500, unit: 'KG' }],
        })
        .expect(409);
    });
  });

  describe('CU-17 y CU-18 - trazabilidad en ambos sentidos', () => {
    it('CU-17: desde el lote de acopio reconstruye toda la cadena hasta el productor', async () => {
      const response = await request(http)
        .get(`${PREFIX}/lots/${ctx.lotAcopioId}/trace/backward`)
        .set(auth(acopioUser))
        .expect(200);

      const types = new Set<string>(response.body.nodes.map((node: { type: string }) => node.type));
      for (const expected of [
        'lot',
        'extraction',
        'movement',
        'dte',
        'reception',
        'apiary',
        'establishment',
        'renspa',
        'producer',
        'renapa',
      ]) {
        expect(types.has(expected)).toBe(true);
      }

      expect(response.body.summary.producers.map((p: { id: string }) => p.id)).toContain(
        ctx.producerId,
      );
      expect(response.body.summary.renspa).toContain('01.001.0.00001/01');
      // Cada RENAPA se atribuye a su productor, no a todos.
      const apicultor = response.body.summary.producers.find(
        (p: { id: string }) => p.id === ctx.producerId,
      );
      expect(apicultor.renapa).toEqual(['RENAPA-TEST-0001']);
      expect(response.body.summary.apiaries[0].establishmentId).toBe(ctx.estApiario);
    });

    it('CU-17: desde un tambor llega al mismo origen', async () => {
      const response = await request(http)
        .get(`${PREFIX}/drums/${ctx.drumId}/trace/backward`)
        .set(auth(salaUser))
        .expect(200);
      expect(response.body.root.type).toBe('drum');
      expect(response.body.summary.producers.map((p: { id: string }) => p.id)).toContain(
        ctx.producerId,
      );
    });

    it('CU-18: desde el apiario llega a los lotes y tambores derivados', async () => {
      const response = await request(http)
        .get(`${PREFIX}/traceability/forward/apiary/${ctx.apiaryId}`)
        .set(auth(productorUser))
        .expect(200);

      const lotCodes = response.body.summary.lots.map((l: { id: string }) => l.id);
      expect(lotCodes).toContain(ctx.lotSalaId);
      expect(lotCodes).toContain(ctx.lotAcopioId);
      expect(response.body.summary.drums.length).toBeGreaterThanOrEqual(2);
    });

    it('CU-19: el historial del movimiento contiene sus eventos en orden', async () => {
      const response = await request(http)
        .get(`${PREFIX}/traceability/timeline/movement/${ctx.movementId}`)
        .set(auth(salaUser))
        .expect(200);

      const eventTypes = response.body.events.map((e: { eventType: string }) => e.eventType);
      expect(eventTypes).toEqual([
        'MovementCreated',
        'DteCreated',
        'MovementDispatched',
        'MovementReceived',
        'DteClosed',
      ]);
    });

    it('detecta huecos de trazabilidad en un lote sin origen', async () => {
      const huerfano = await request(http)
        .post(`${PREFIX}/lots`)
        .set(auth(acopioUser))
        .send({
          establishmentId: ctx.estAcopio,
          lotType: 'ACOPIO',
          productionDate: '2026-12-05T09:00:00.000Z',
          quantity: 50,
          unit: 'KG',
        })
        .expect(201);

      const response = await request(http)
        .get(`${PREFIX}/lots/${huerfano.body.id}/trace/backward`)
        .set(auth(acopioUser))
        .expect(200);

      expect(response.body.gaps.map((g: { code: string }) => g.code)).toContain(
        'LOT_WITHOUT_INPUTS',
      );
      expect(response.body.complete).toBe(false);
    });
  });

  describe('Autorizacion contextual', () => {
    it('un productor no accede a un lote de otra organizacion', async () => {
      await request(http)
        .get(`${PREFIX}/lots/${ctx.lotAcopioId}`)
        .set(auth(productorUser))
        .expect(403);
    });

    it('el listado solo devuelve entidades del ambito del usuario', async () => {
      const response = await request(http)
        .get(`${PREFIX}/lots`)
        .set(auth(salaUser))
        .expect(200);
      const ids = response.body.data.map((row: { id: string }) => row.id);
      expect(ids).toContain(ctx.lotSalaId);
      expect(ids).not.toContain(ctx.lotAcopioId);
    });

    it('el ADMIN ve todas las organizaciones', async () => {
      const response = await request(http).get(`${PREFIX}/lots`).set(auth(admin)).expect(200);
      const ids = response.body.data.map((row: { id: string }) => row.id);
      expect(ids).toContain(ctx.lotSalaId);
      expect(ids).toContain(ctx.lotAcopioId);
    });

    it('un movimiento es visible desde ambos extremos de la cadena', async () => {
      await request(http)
        .get(`${PREFIX}/movements/${ctx.movementId}`)
        .set(auth(productorUser))
        .expect(200);
      await request(http)
        .get(`${PREFIX}/movements/${ctx.movementId}`)
        .set(auth(salaUser))
        .expect(200);
      await request(http)
        .get(`${PREFIX}/movements/${ctx.movementId}`)
        .set(auth(acopioUser))
        .expect(403);
    });

    it('un rol de solo lectura no puede escribir', async () => {
      const auditor = await createUser('auditor@test.local', 'Auditor Test', 'AUDITOR', null);
      await request(http)
        .post(`${PREFIX}/producers`)
        .set(auth(auditor))
        .send({ businessName: 'No deberia crearse' })
        .expect(403);
      // Pero si puede consultar.
      await request(http).get(`${PREFIX}/producers`).set(auth(auditor)).expect(200);
    });
  });

  describe('CU-33 y CU-34 - auditoria', () => {
    it('registra automaticamente las operaciones relevantes', async () => {
      const response = await request(http)
        .get(`${PREFIX}/audit/events`)
        .query({ entityType: 'movement', pageSize: 100 })
        .set(auth(admin))
        .expect(200);

      const actions = response.body.data.map((row: { action: string }) => row.action);
      expect(actions).toContain('MOVEMENT_CREATED');
      expect(actions).toContain('MOVEMENT_RECEIVED');
      expect(response.body.data[0].actorEmail).toBeTruthy();
    });

    it('un rol sin permiso no consulta la auditoria', async () => {
      await request(http).get(`${PREFIX}/audit/events`).set(auth(salaUser)).expect(403);
    });
  });

  describe('Operacion', () => {
    it('expone health y readiness sin autenticacion', async () => {
      await request(http).get('/health').expect(200);
      const ready = await request(http).get('/ready').expect(200);
      expect(ready.body.checks.database.status).toBe('ok');
    });
  });
});
