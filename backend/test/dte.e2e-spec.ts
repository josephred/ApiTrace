import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { OutboxDispatcher } from '../src/common/services/outbox-dispatcher.service';
import { DRIZZLE, type Database } from '../src/database/database.module';
import { integrationEvent, movementRule } from '../src/database/schema';
import { DteLifecycleService } from '../src/modules/movement/dte-lifecycle.service';
import { addDays, toArDate } from '../src/modules/movement/dte.rules';
import { TABLES } from './tables';

const PASSWORD = 'PruebaSegura2026';
const PREFIX = '/api/v1';

interface Session {
  token: string;
  userId: string;
  organizationId: string | null;
}

/**
 * DT-e API-SEM gestionado por usuario (especificacion tecnica DT-e, secciones
 * 4 a 6) contra HTTP real, PostgreSQL real y el simulador de SIGSA.
 *
 * Las fechas son relativas a hoy (hora argentina) porque la anticipacion y la
 * vigencia dependen del reloj. La suite vacia la base al empezar y al terminar
 * para no depender del orden de ejecucion respecto de las otras suites.
 */
describe('DT-e API-SEM por usuario (e2e)', () => {
  let app: INestApplication;
  let http: App;
  let db: Database;
  let outbox: OutboxDispatcher;
  let lifecycle: DteLifecycleService;

  let admin: Session;
  let productor: Session;
  let sala: Session;
  let ajeno: Session;

  const today = toArDate(new Date());
  const transport = { type: 'CAMIONETA', plate: 'aa-123 bc' };

  const ctx = {
    producerId: '',
    apiaryId: '',
    salaId: '',
    dteA: '',
    movementA: '',
    dteA2: '',
    dteC: '',
    movementC: '',
  };

  const auth = (session: Session) => ({ Authorization: `Bearer ${session.token}` });

  const truncate = async () => {
    await db.execute(sql.raw(`TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`));
  };

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

  const createUser = async (email: string, role: string, organizationId: string | null) => {
    await request(http)
      .post(`${PREFIX}/auth/register`)
      .set(auth(admin))
      .send({
        email,
        password: PASSWORD,
        fullName: email,
        role,
        organizationId: organizationId ?? undefined,
      })
      .expect(201);
    return login(email);
  };

  const createOrg = async (name: string, type: string) => {
    const response = await request(http)
      .post(`${PREFIX}/organizations`)
      .set(auth(admin))
      .send({ name, type })
      .expect(201);
    return response.body.id as string;
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
    outbox = app.get(OutboxDispatcher);
    lifecycle = app.get(DteLifecycleService);

    await truncate();
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

    // Base vacia: el primer usuario registrado queda ADMIN activo.
    await request(http)
      .post(`${PREFIX}/auth/register`)
      .send({ email: 'admin@dte.test', password: PASSWORD, fullName: 'Admin DT-e' })
      .expect(201);
    admin = await login('admin@dte.test');

    const orgApicola = await createOrg('Apicola DT-e', 'PRODUCTOR');
    const orgSala = await createOrg('Sala DT-e', 'SALA_EXTRACCION');
    const orgAjena = await createOrg('Ajena DT-e', 'PRODUCTOR');
    productor = await createUser('productor@dte.test', 'PRODUCTOR', orgApicola);
    sala = await createUser('sala@dte.test', 'SALA', orgSala);
    ajeno = await createUser('ajeno@dte.test', 'PRODUCTOR', orgAjena);

    // Productor, RENAPA, predio y apiario con su codigo RENAPA oficial.
    const producer = await request(http)
      .post(`${PREFIX}/producers`)
      .set(auth(productor))
      .send({ businessName: 'Apicultor DT-e', taxId: '20-30111222-3' })
      .expect(201);
    ctx.producerId = producer.body.id;
    await request(http)
      .post(`${PREFIX}/producers/${ctx.producerId}/renapa`)
      .set(auth(productor))
      .send({ number: 'RENAPA-DTE-0001', status: 'ACTIVE' })
      .expect(201);
    const predio = await request(http)
      .post(`${PREFIX}/establishments`)
      .set(auth(productor))
      .send({ name: 'Predio DT-e', type: 'APIARIO_BASE', producerId: ctx.producerId })
      .expect(201);
    const apiary = await request(http)
      .post(`${PREFIX}/apiaries`)
      .set(auth(productor))
      .send({
        establishmentId: predio.body.id,
        code: 'API-DTE',
        renapaCode: ' b53999-2 ',
        renapaStatus: 'ACTIVE',
      })
      .expect(201);
    ctx.apiaryId = apiary.body.id;
    expect(apiary.body.renapaCode).toBe('B53999-2');

    // La sala, en otra organizacion, con su codigo SENASA.
    const salaEst = await request(http)
      .post(`${PREFIX}/establishments`)
      .set(auth(sala))
      .send({
        name: 'Sala DT-e',
        type: 'SALA_EXTRACCION',
        senasaCode: 'SEF-B-20010',
        senasaStatus: 'ACTIVE',
      })
      .expect(201);
    ctx.salaId = salaEst.body.id;
  });

  afterAll(async () => {
    await truncate();
    await app.close();
  });

  describe('Registros oficiales y destinos', () => {
    it('lista salas habilitadas de otras organizaciones (H-02)', async () => {
      const response = await request(http)
        .get(`${PREFIX}/establishments/receivers`)
        .set(auth(productor))
        .expect(200);
      const found = response.body.data.find((row: { id: string }) => row.id === ctx.salaId);
      expect(found.senasaCode).toBe('SEF-B-20010');
      expect(found.organizationName).toBe('Sala DT-e');
    });

    it('no permite dos apiarios con el mismo RENAPA', async () => {
      const predio = await request(http)
        .post(`${PREFIX}/establishments`)
        .set(auth(productor))
        .send({ name: 'Otro predio', type: 'APIARIO_BASE', producerId: ctx.producerId })
        .expect(201);
      await request(http)
        .post(`${PREFIX}/apiaries`)
        .set(auth(productor))
        .send({ establishmentId: predio.body.id, code: 'API-2', renapaCode: 'B53999-2' })
        .expect(409);
    });

    it('registra la delegacion SENASA del titular', async () => {
      await request(http)
        .put(`${PREFIX}/producers/${ctx.producerId}/senasa-delegations/SIGSA_DTE`)
        .set(auth(productor))
        .send({ status: 'ACEPTADA', formNumber: 'F3283-0001' })
        .expect(200);
      const list = await request(http)
        .get(`${PREFIX}/producers/${ctx.producerId}/senasa-delegations`)
        .set(auth(productor))
        .expect(200);
      expect(
        list.body.map((row: { service: string; status: string }) => `${row.service}:${row.status}`),
      ).toEqual(['SIGSA_DTE:ACEPTADA', 'SITA:NO_INICIADA']);
    });
  });

  describe('Verificacion previa y reglas del tramite', () => {
    it('informa lo que falta antes de pedir la emision', async () => {
      const response = await request(http)
        .post(`${PREFIX}/dte/preflight`)
        .set(auth(productor))
        .send({
          apiaryId: ctx.apiaryId,
          destinationEstablishmentId: ctx.salaId,
          declaredQuantity: 30,
          estimatedQuantity: 30,
          loadDate: today,
        })
        .expect(200);
      expect(response.body.ok).toBe(false);
      const codes = response.body.checks.map(
        (check: { code: string; status: string }) => `${check.code}:${check.status}`,
      );
      expect(codes).toContain('TRANSPORTE:error');
      expect(codes).toContain('CANTIDAD:warning');
      expect(codes).toContain('ORIGEN_RENAPA:ok');
      expect(response.body.suggestion.declaredQuantity).toBe(45);
    });

    it('rechaza un vencimiento de mas de 4 dias', async () => {
      const response = await request(http)
        .post(`${PREFIX}/dte`)
        .set(auth(productor))
        .send({
          apiaryId: ctx.apiaryId,
          destinationEstablishmentId: ctx.salaId,
          declaredQuantity: 80,
          loadDate: today,
          expiryDate: addDays(today, 5),
        })
        .expect(400);
      expect(response.body.code).toBe('VIGENCIA_FUERA_DE_RANGO');
    });

    it('rechaza declarar menos alzas de las estimadas', async () => {
      const response = await request(http)
        .post(`${PREFIX}/dte`)
        .set(auth(productor))
        .send({
          apiaryId: ctx.apiaryId,
          destinationEstablishmentId: ctx.salaId,
          estimatedQuantity: 50,
          declaredQuantity: 40,
          loadDate: today,
        })
        .expect(400);
      expect(response.body.code).toBe('DECLARADA_MENOR_A_ESTIMADA');
    });

    it('no pide la emision con mas de 4 dias de anticipacion', async () => {
      const response = await request(http)
        .post(`${PREFIX}/dte`)
        .set(auth(productor))
        .send({
          apiaryId: ctx.apiaryId,
          destinationEstablishmentId: ctx.salaId,
          declaredQuantity: 80,
          loadDate: addDays(today, 6),
          transport,
          submit: true,
        })
        .expect(422);
      expect(response.body.code).toBe('DTE_VERIFICACION_PREVIA');
    });
  });

  describe('Circuito completo: emision, transito, exceso de carga y cierre', () => {
    it('crea el borrador y su movimiento en una sola operacion', async () => {
      const response = await request(http)
        .post(`${PREFIX}/dte`)
        .set(auth(productor))
        .set('Idempotency-Key', 'dte-e2e-alta-001')
        .send({
          apiaryId: ctx.apiaryId,
          destinationEstablishmentId: ctx.salaId,
          estimatedQuantity: 50,
          declaredQuantity: 80,
          loadDate: today,
          transport,
        })
        .expect(201);
      ctx.dteA = response.body.id;
      ctx.movementA = response.body.movementId;
      expect(response.body.status).toBe('BORRADOR');
      expect(response.body.originCode).toBe('B53999-2');
      expect(response.body.destinationCode).toBe('SEF-B-20010');
      expect(response.body.transportPlate).toBe('AA123BC');
      expect(response.body.expiryDate).toBe(addDays(today, 2));

      const movement = await request(http)
        .get(`${PREFIX}/movements/${ctx.movementA}`)
        .set(auth(productor))
        .expect(200);
      expect(movement.body.requiresDocument).toBe(true);
      expect(movement.body.unit).toBe('ALZA');
      expect(Number(movement.body.quantity)).toBe(50);
    });

    it('un reintento con la misma clave no duplica el DT-e', async () => {
      const retry = await request(http)
        .post(`${PREFIX}/dte`)
        .set(auth(productor))
        .set('Idempotency-Key', 'dte-e2e-alta-001')
        .send({
          apiaryId: ctx.apiaryId,
          destinationEstablishmentId: ctx.salaId,
          estimatedQuantity: 50,
          declaredQuantity: 80,
          loadDate: today,
          transport,
        })
        .expect(201);
      expect(retry.body.id).toBe(ctx.dteA);
      expect(retry.headers['idempotent-replay']).toBe('true');
    });

    it('pide la emision a SIGSA (simulado) y la completa de forma asincrona', async () => {
      const requested = await request(http)
        .post(`${PREFIX}/dte/${ctx.dteA}/issue`)
        .set(auth(productor))
        .send({})
        .expect(200);
      expect(requested.body.status).toBe('SOLICITADO');
      expect(requested.body.issueMode).toBe('SIMULADO');

      await outbox.drain();

      const issued = await request(http)
        .get(`${PREFIX}/dte/${ctx.dteA}`)
        .set(auth(productor))
        .expect(200);
      expect(issued.body.status).toBe('VIGENTE');
      expect(issued.body.aptForTransit).toBe(true);
      expect(issued.body.number).toMatch(/^SIM-\d{9}-\d$/);
      expect(issued.body.verificationCode).toMatch(/^\d{6}$/);
      expect(issued.body.syncStatus).toBe('SYNCHRONIZED');
      expect(issued.body.history.map((h: { toStatus: string }) => h.toStatus)).toEqual([
        'BORRADOR',
        'SOLICITADO',
        'EMITIDO',
        'VIGENTE',
      ]);

      const calls = await db.select().from(integrationEvent);
      expect(
        calls.some((call) => call.operation === 'DTE_EMITIR' && call.status === 'SUCCESS'),
      ).toBe(true);
    });

    it('la sala ve el DT-e que recibe, pero no el codigo de cierre', async () => {
      const response = await request(http)
        .get(`${PREFIX}/dte/${ctx.dteA}`)
        .set(auth(sala))
        .expect(200);
      expect(response.body.verificationCode).toBeNull();
      expect(response.body.hasVerificationCode).toBe(true);
      expect(response.body.perspective).toBe('destino');
    });

    it('un tercero no ve el DT-e', async () => {
      await request(http).get(`${PREFIX}/dte/${ctx.dteA}`).set(auth(ajeno)).expect(403);
      const list = await request(http).get(`${PREFIX}/dte`).set(auth(ajeno)).expect(200);
      expect(list.body.meta.total).toBe(0);
    });

    it('no admite un segundo DT-e en juego para el mismo movimiento', async () => {
      const response = await request(http)
        .post(`${PREFIX}/dte`)
        .set(auth(productor))
        .send({ movementId: ctx.movementA, declaredQuantity: 90, loadDate: today, transport })
        .expect(409);
      expect(response.body.code).toBe('DTE_ACTIVO_EXISTENTE');
    });

    it('bloquea la salida fuera de la vigencia y la permite dentro (semaforo)', async () => {
      const late = await request(http)
        .post(`${PREFIX}/movements/${ctx.movementA}/dispatch`)
        .set(auth(productor))
        .send({ dispatchedAt: `${addDays(today, 5)}T10:00:00.000-03:00` })
        .expect(409);
      expect(late.body.code).toBe('DTE_NO_VIGENTE');

      await request(http)
        .post(`${PREFIX}/movements/${ctx.movementA}/dispatch`)
        .set(auth(productor))
        .send({})
        .expect(200);
    });

    it('rechaza descargar mas alzas de las declaradas (5.2)', async () => {
      const response = await request(http)
        .post(`${PREFIX}/movements/${ctx.movementA}/receive`)
        .set(auth(sala))
        .send({ receivedQuantity: 85, unit: 'ALZA', discrepancyNotes: 'Llegaron mas alzas.' })
        .expect(422);
      expect(response.body.code).toBe('EXCESO_CANTIDAD_DECLARADA');
      expect(response.body.details.declaredQuantity).toBe(80);
    });

    it('anula el DT-e y emite otro con la cantidad corregida', async () => {
      const voided = await request(http)
        .post(`${PREFIX}/dte/${ctx.dteA}/void`)
        .set(auth(productor))
        .send({ reason: 'Exceso de carga: llegaron 85 alzas y se declararon 80.', feePaid: true })
        .expect(200);
      expect(voided.body.status).toBe('ANULADO');

      const replacement = await request(http)
        .post(`${PREFIX}/dte`)
        .set(auth(productor))
        .send({
          movementId: ctx.movementA,
          estimatedQuantity: 85,
          declaredQuantity: 100,
          loadDate: today,
          transport,
          submit: true,
        })
        .expect(201);
      ctx.dteA2 = replacement.body.id;
      expect(replacement.body.status).toBe('SOLICITADO');
      await outbox.drain();

      const movement = await request(http)
        .get(`${PREFIX}/movements/${ctx.movementA}`)
        .set(auth(productor))
        .expect(200);
      expect(movement.body.dte.id).toBe(ctx.dteA2);
      expect(movement.body.dte.status).toBe('VIGENTE');
    });

    it('la sala recibe las alzas reales con el DT-e reemitido', async () => {
      await request(http)
        .post(`${PREFIX}/movements/${ctx.movementA}/receive`)
        .set(auth(sala))
        .send({
          receivedQuantity: 85,
          unit: 'ALZA',
          discrepancyNotes: 'Se estimaron 50, llegaron 85.',
        })
        .expect(201);
    });

    it('exige el codigo de cierre impreso y rechaza uno incorrecto', async () => {
      const missing = await request(http)
        .post(`${PREFIX}/dte/${ctx.dteA2}/close`)
        .set(auth(sala))
        .send({ confirmedQuantity: 85 })
        .expect(422);
      expect(missing.body.code).toBe('CODIGO_CIERRE_REQUERIDO');

      const wrong = await request(http)
        .post(`${PREFIX}/dte/${ctx.dteA2}/close`)
        .set(auth(sala))
        .send({ verificationCode: '000000', confirmedQuantity: 85 })
        .expect(422);
      expect(wrong.body.code).toBe('CODIGO_CIERRE_INVALIDO');
    });

    it('solo la sala de destino cierra', async () => {
      // El rol PRODUCTOR no cierra DT-e: lo frena el control de roles.
      await request(http)
        .post(`${PREFIX}/dte/${ctx.dteA2}/close`)
        .set(auth(productor))
        .send({ confirmedQuantity: 85 })
        .expect(403);
    });

    it('cierra con Qreal <= Qdeclarada y habilita la extraccion', async () => {
      const own = await request(http)
        .get(`${PREFIX}/dte/${ctx.dteA2}`)
        .set(auth(productor))
        .expect(200);

      const closed = await request(http)
        .post(`${PREFIX}/dte/${ctx.dteA2}/close`)
        .set(auth(sala))
        .send({
          number: own.body.number,
          verificationCode: own.body.verificationCode,
          confirmedQuantity: 85,
        })
        .expect(200);
      expect(closed.body.status).toBe('CERRADO');
      expect(closed.body.confirmedQuantity).toBe(85);

      await request(http)
        .post(`${PREFIX}/extractions`)
        .set(auth(sala))
        .send({
          establishmentId: ctx.salaId,
          inputs: [{ movementId: ctx.movementA, quantity: 85, unit: 'ALZA' }],
          startedAt: new Date().toISOString(),
        })
        .expect(201);
    });
  });

  describe('Registro manual, extraccion y sin arribo', () => {
    it('registra un DT-e emitido en SIGSA y no deja extraer sin cierre', async () => {
      const created = await request(http)
        .post(`${PREFIX}/dte`)
        .set(auth(productor))
        .send({
          apiaryId: ctx.apiaryId,
          destinationEstablishmentId: ctx.salaId,
          declaredQuantity: 30,
          loadDate: today,
          transport,
          number: '022440451-4',
          verificationCode: '790112',
        })
        .expect(201);
      ctx.dteC = created.body.id;
      ctx.movementC = created.body.movementId;
      expect(created.body.status).toBe('VIGENTE');
      expect(created.body.issueMode).toBe('MANUAL');

      await request(http)
        .post(`${PREFIX}/movements/${ctx.movementC}/dispatch`)
        .set(auth(productor))
        .send({})
        .expect(200);
      await request(http)
        .post(`${PREFIX}/movements/${ctx.movementC}/receive`)
        .set(auth(sala))
        .send({ receivedQuantity: 30, unit: 'ALZA' })
        .expect(201);

      const blocked = await request(http)
        .post(`${PREFIX}/extractions`)
        .set(auth(sala))
        .send({
          establishmentId: ctx.salaId,
          inputs: [{ movementId: ctx.movementC, quantity: 30, unit: 'ALZA' }],
          startedAt: new Date().toISOString(),
        })
        .expect(409);
      expect(blocked.body.code).toBe('DTE_SIN_CERRAR');
    });

    it('no admite registrar dos veces el mismo numero oficial', async () => {
      const response = await request(http)
        .post(`${PREFIX}/dte`)
        .set(auth(productor))
        .send({
          apiaryId: ctx.apiaryId,
          destinationEstablishmentId: ctx.salaId,
          declaredQuantity: 30,
          loadDate: today,
          transport,
          number: '022440451-4',
        })
        .expect(409);
      expect(response.body.code).toBe('NUMERO_DTE_DUPLICADO');
    });

    it('la sala declara sin arribo un DT-e vigente que nunca llego', async () => {
      const created = await request(http)
        .post(`${PREFIX}/dte`)
        .set(auth(productor))
        .send({
          apiaryId: ctx.apiaryId,
          destinationEstablishmentId: ctx.salaId,
          declaredQuantity: 20,
          loadDate: today,
          transport,
          number: '022440452-2',
        })
        .expect(201);
      await request(http)
        .post(`${PREFIX}/movements/${created.body.movementId}/dispatch`)
        .set(auth(productor))
        .send({})
        .expect(200);

      const response = await request(http)
        .post(`${PREFIX}/dte/${created.body.id}/no-arrival`)
        .set(auth(sala))
        .send({ reason: 'La carga no llego a la sala.' })
        .expect(200);
      expect(response.body.status).toBe('SIN_ARRIBO');
    });
  });

  describe('Gestion por usuario', () => {
    it('el productor lista lo que emite; la sala, lo que recibe', async () => {
      const issued = await request(http)
        .get(`${PREFIX}/dte?perspective=emitidos&pageSize=50`)
        .set(auth(productor))
        .expect(200);
      const ids = issued.body.data.map((row: { id: string }) => row.id);
      expect(ids).toEqual(expect.arrayContaining([ctx.dteA, ctx.dteA2, ctx.dteC]));
      expect(issued.body.data[0].movementCode).toMatch(/^MOV-/);

      const received = await request(http)
        .get(`${PREFIX}/dte?perspective=recibidos&status=VIGENTE`)
        .set(auth(sala))
        .expect(200);
      expect(received.body.data.map((row: { id: string }) => row.id)).toEqual([ctx.dteC]);

      const mine = await request(http)
        .get(`${PREFIX}/dte?mine=true&status=ANULADO`)
        .set(auth(productor))
        .expect(200);
      expect(mine.body.data.map((row: { id: string }) => row.id)).toEqual([ctx.dteA]);
    });

    it('resume estados y tareas para el panel', async () => {
      const producerView = await request(http)
        .get(`${PREFIX}/dte/summary`)
        .set(auth(productor))
        .expect(200);
      expect(producerView.body.issued.CERRADO).toBe(1);
      expect(producerView.body.issued.ANULADO).toBe(1);
      expect(producerView.body.integration.mode).toBe('simulado');

      const salaView = await request(http).get(`${PREFIX}/dte/summary`).set(auth(sala)).expect(200);
      expect(salaView.body.tasks.pendingClosure).toBe(1);
    });
  });

  describe('Vigencia con el reloj y bloqueo por caducidad', () => {
    let lapsedId = '';

    it('vence y caduca un DT-e sin cierre, dejando cada paso en el historial', async () => {
      const created = await request(http)
        .post(`${PREFIX}/dte`)
        .set(auth(productor))
        .send({
          apiaryId: ctx.apiaryId,
          destinationEstablishmentId: ctx.salaId,
          declaredQuantity: 10,
          loadDate: addDays(today, -6),
          expiryDate: addDays(today, -4),
          transport,
          number: '022440453-1',
        })
        .expect(201);
      lapsedId = created.body.id;
      // Hoy esta dentro de la gracia: vencido pero todavia cerrable.
      expect(created.body.status).toBe('VENCIDO');

      const later = new Date(Date.now() + 2 * 86_400_000);
      await lifecycle.refresh({ dteId: lapsedId }, later);

      const detail = await request(http)
        .get(`${PREFIX}/dte/${lapsedId}`)
        .set(auth(productor))
        .expect(200);
      expect(detail.body.status).toBe('CADUCADO');
      const steps = detail.body.history.map(
        (h: { toStatus: string; source: string }) => `${h.toStatus}:${h.source}`,
      );
      expect(steps).toEqual([
        'EMITIDO:USUARIO',
        'VIGENTE:SISTEMA',
        'VENCIDO:SISTEMA',
        'CADUCADO:SISTEMA',
      ]);
    });

    it('bloquea al titular hasta que se regulariza', async () => {
      const body = {
        apiaryId: ctx.apiaryId,
        destinationEstablishmentId: ctx.salaId,
        declaredQuantity: 10,
        loadDate: today,
        transport,
      };
      const blocked = await request(http)
        .post(`${PREFIX}/dte/preflight`)
        .set(auth(productor))
        .send(body)
        .expect(200);
      expect(blocked.body.checks.map((check: { code: string }) => check.code)).toContain(
        'TITULAR_BLOQUEADO',
      );

      await request(http)
        .post(`${PREFIX}/dte/${lapsedId}/regularize`)
        .set(auth(admin))
        .send({ note: 'SENASA levanto el bloqueo (prueba).' })
        .expect(200);

      const free = await request(http)
        .post(`${PREFIX}/dte/preflight`)
        .set(auth(productor))
        .send(body)
        .expect(200);
      expect(free.body.checks.map((check: { code: string }) => check.code)).not.toContain(
        'TITULAR_BLOQUEADO',
      );
    });
  });
});
