/**
 * Seed de demostracion.
 *
 * Recorre la columna vertebral completa del MVP usando los servicios de dominio
 * (no INSERTs sueltos), de modo que se generen los mismos codigos, eventos de
 * trazabilidad y registros de auditoria que en produccion. Sirve como prueba de
 * humo del dominio ademas de como juego de datos:
 *
 *   PRODUCTOR -> RENAPA -> RENSPA -> APIARIO -> MOVIMIENTO -> DT-e -> SALA
 *             -> EXTRACCION -> LOTE -> TAMBOR -> MOVIMIENTO -> ACOPIO -> LOTE MEZCLA
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type Database } from './database.module';
import { carrier, movementRule, organization, user, vehicle } from './schema';
import { IdentityService } from '../modules/identity/identity.service';
import { AuthService } from '../modules/identity/auth.service';
import { ProducerService } from '../modules/producer/producer.service';
import { EstablishmentService } from '../modules/establishment/establishment.service';
import { ApiaryService } from '../modules/apiary/apiary.service';
import { MovementService } from '../modules/movement/movement.service';
import { DteService } from '../modules/movement/dte.service';
import { ExtractionService } from '../modules/production/extraction.service';
import { LotService } from '../modules/production/lot.service';
import { DrumService } from '../modules/production/drum.service';
import type { AuthenticatedUser } from '../common/types';

const logger = new Logger('seed');

const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? 'ApiTrace2026!';

/**
 * Reglas documentales iniciales. La segunda refleja el esquema informado por
 * SENASA para 2026: DT-e obligatorio en el traslado de material apicola melario
 * desde apiarios hacia salas de extraccion, gestionado en SIGSA y cerrado por
 * la sala receptora. Se expresa con vigencia para poder consultar el pasado.
 */
const MOVEMENT_RULES = [
  {
    name: 'Regla general: movimientos sin documento sanitario obligatorio',
    movementType: null,
    materialType: null,
    originType: null,
    destinationType: null,
    requiresDocument: false,
    requiredDocumentType: null,
    effectiveFrom: new Date('2020-01-01T00:00:00Z'),
    effectiveTo: null,
    priority: 900,
    legalReference: null,
    notes: 'Comodin de menor prioridad: se aplica cuando ninguna regla especifica coincide.',
  },
  {
    name: 'DT-e obligatorio: material melario de apiario a sala de extraccion',
    movementType: 'MATERIAL_MELARIO' as const,
    materialType: 'MATERIAL_MELARIO' as const,
    originType: 'APIARIO_BASE' as const,
    destinationType: 'SALA_EXTRACCION' as const,
    requiresDocument: true,
    requiredDocumentType: 'DTE' as const,
    effectiveFrom: new Date('2026-08-01T00:00:00Z'),
    effectiveTo: null,
    priority: 10,
    legalReference:
      'SENASA - Optimizacion de controles de movimientos de material apicola desde apiarios a salas de extraccion (vigencia 01/08/2026). Gestion en SIGSA; cierre por la sala.',
    notes:
      'Antes del 01/08/2026 este mismo traslado no exigia DT-e: por eso la regla tiene vigencia y no esta hardcodeada.',
  },
  {
    name: 'Documento de respaldo: miel a granel entre establecimientos',
    movementType: 'MIEL_A_GRANEL' as const,
    materialType: 'MIEL' as const,
    originType: null,
    destinationType: null,
    requiresDocument: true,
    requiredDocumentType: 'REMITO' as const,
    effectiveFrom: new Date('2020-01-01T00:00:00Z'),
    effectiveTo: null,
    priority: 100,
    legalReference: null,
    notes: 'Remito comercial. Ajustar segun la operatoria real de cada jurisdiccion.',
  },
];

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const db = app.get<Database>(DRIZZLE);
  const identity = app.get(IdentityService);
  const auth = app.get(AuthService);
  const producers = app.get(ProducerService);
  const establishments = app.get(EstablishmentService);
  const apiaries = app.get(ApiaryService);
  const movements = app.get(MovementService);
  const dteService = app.get(DteService);
  const extractions = app.get(ExtractionService);
  const lots = app.get(LotService);
  const drums = app.get(DrumService);

  try {
    const existing = await db.select({ id: organization.id }).from(organization).limit(1);
    if (existing.length > 0 && process.env.SEED_FORCE !== 'true') {
      logger.warn('La base ya tiene datos. Use SEED_FORCE=true o npm run db:reset para reiniciar.');
      return;
    }

    // ---------------------------------------------------------------- reglas
    const ruleCount = await db.select({ c: sql<number>`cast(count(*) as int)` }).from(movementRule);
    if ((ruleCount[0]?.c ?? 0) === 0) {
      await db.insert(movementRule).values(MOVEMENT_RULES as never);
      logger.log(`Reglas documentales cargadas: ${MOVEMENT_RULES.length}`);
    }

    // -------------------------------------------------------- organizaciones
    const platformAdmin = await ensureAdmin(auth, db);

    const orgProductor = await identity.createOrganization(
      {
        name: 'Apiarios del Sur',
        legalName: 'Apiarios del Sur SRL',
        taxId: '30-71234567-9',
        type: 'PRODUCTOR',
        email: 'contacto@apiariosdelsur.example',
      },
      platformAdmin,
    );

    const orgSala = await identity.createOrganization(
      {
        name: 'Sala San Andres',
        legalName: 'Extractora San Andres SA',
        taxId: '30-70987654-3',
        type: 'SALA_EXTRACCION',
      },
      platformAdmin,
    );

    const orgAcopio = await identity.createOrganization(
      {
        name: 'Acopio Pampa',
        legalName: 'Acopio Pampa SA',
        taxId: '30-70555444-1',
        type: 'ACOPIO',
      },
      platformAdmin,
    );

    const orgLab = await identity.createOrganization(
      { name: 'Laboratorio Mielab', type: 'LABORATORIO', taxId: '30-70111222-5' },
      platformAdmin,
    );

    // --------------------------------------------------------------- usuarios
    const userProductor = await createUser(
      auth,
      identity,
      platformAdmin,
      'productor@apitrace',
      'Maria Gonzalez',
      'PRODUCTOR',
      orgProductor.id,
    );
    const userSala = await createUser(
      auth,
      identity,
      platformAdmin,
      'sala@apitrace',
      'Jorge Diaz',
      'SALA',
      orgSala.id,
    );
    const userAcopio = await createUser(
      auth,
      identity,
      platformAdmin,
      'acopio@apitrace',
      'Lucia Ferrari',
      'ACOPIADOR',
      orgAcopio.id,
    );
    await createUser(
      auth,
      identity,
      platformAdmin,
      'auditor@apitrace',
      'Auditor Externo',
      'AUDITOR',
      null,
    );
    await createUser(
      auth,
      identity,
      platformAdmin,
      'laboratorio@apitrace',
      'Lab Mielab',
      'LABORATORIO',
      orgLab.id,
    );

    // -------------------------------------------------- productor y registros
    const productor = await producers.create(
      {
        businessName: 'Maria Gonzalez - Apicultura',
        personType: 'FISICA',
        taxId: '27-28456789-4',
        province: 'Buenos Aires',
        locality: 'Lujan',
        email: 'maria@apiariosdelsur.example',
      },
      userProductor,
    );

    await producers.associateRenapa(
      productor.id,
      {
        number: 'RENAPA-06-004512',
        status: 'ACTIVE',
        issuedAt: '2024-03-11T00:00:00.000Z',
        sourceNote: 'Carga manual de demostracion',
      },
      userProductor,
    );

    const estApiario = await establishments.create(
      {
        name: 'Predio Los Talas',
        type: 'APIARIO_BASE',
        producerId: productor.id,
        locality: 'Lujan',
        province: 'Buenos Aires',
        latitude: -34.5703,
        longitude: -59.1053,
      },
      userProductor,
    );

    await establishments.associateRenspa(
      estApiario.id,
      {
        number: '01.006.0.00123/45',
        producerId: productor.id,
        activity: 'Apicola',
        status: 'ACTIVE',
        validFrom: '2024-03-11T00:00:00.000Z',
      },
      userProductor,
    );

    const apiario = await apiaries.create(
      {
        establishmentId: estApiario.id,
        code: 'API-001',
        name: 'Apiario Monte Grande',
        latitude: -34.5721,
        longitude: -59.1099,
        hiveCount: 0,
        registeredAt: '2024-09-01T00:00:00.000Z',
      },
      userProductor,
    );

    for (let i = 1; i <= 5; i += 1) {
      await apiaries.addHive(
        apiario.id,
        {
          code: `COL-${String(i).padStart(4, '0')}`,
          type: 'Langstroth',
          installedAt: '2024-09-05T00:00:00.000Z',
        },
        userProductor,
      );
    }

    // ------------------------------------------------------- sala y acopio
    const estSala = await establishments.create(
      {
        name: 'Sala de Extraccion San Andres',
        type: 'SALA_EXTRACCION',
        locality: 'Mercedes',
        province: 'Buenos Aires',
        rne: 'RNE-02-045678',
      },
      userSala,
    );

    // El RENSPA identifica al titular del predio: el de la sala es la propia
    // extractora, no el apicultor que le envia material.
    const titularSala = await producers.create(
      {
        businessName: 'Extractora San Andres SA',
        personType: 'JURIDICA',
        taxId: '30-70987654-3',
        province: 'Buenos Aires',
        locality: 'Mercedes',
      },
      userSala,
    );

    await establishments.associateRenspa(
      estSala.id,
      {
        number: '01.007.0.00987/12',
        producerId: titularSala.id,
        activity: 'Sala de extraccion',
        status: 'ACTIVE',
      },
      userSala,
    );

    const estAcopio = await establishments.create(
      {
        name: 'Deposito Acopio Pampa',
        type: 'ACOPIO',
        locality: 'Chivilcoy',
        province: 'Buenos Aires',
        rne: 'RNE-02-099887',
      },
      userAcopio,
    );

    const titularAcopio = await producers.create(
      {
        businessName: 'Acopio Pampa SA',
        personType: 'JURIDICA',
        taxId: '30-70555444-1',
        province: 'Buenos Aires',
        locality: 'Chivilcoy',
      },
      userAcopio,
    );

    await establishments.associateRenspa(
      estAcopio.id,
      {
        number: '01.008.0.00456/78',
        producerId: titularAcopio.id,
        activity: 'Acopio',
        status: 'ACTIVE',
      },
      userAcopio,
    );

    // ------------------------------------------------------------ transporte
    const [transportista] = await db
      .insert(carrier)
      .values({
        businessName: 'Transportes El Panal',
        taxId: '30-70777888-2',
        licenseNumber: 'HAB-2026-4471',
        contactName: 'Ruben Paz',
      })
      .returning();

    const [camion] = await db
      .insert(vehicle)
      .values({ carrierId: transportista.id, plate: 'AF123BC', type: 'Camion furgon' })
      .returning();

    // ------------------------------- CU-09/10/11/12: movimiento apiario -> sala
    const movimiento = await movements.create(
      {
        movementType: 'MATERIAL_MELARIO',
        materialType: 'MATERIAL_MELARIO',
        originEstablishmentId: estApiario.id,
        originApiaryId: apiario.id,
        destinationEstablishmentId: estSala.id,
        carrierId: transportista.id,
        vehicleId: camion.id,
        driverName: 'Ruben Paz',
        driverDocument: '24.556.778',
        scheduledAt: '2026-11-12T09:00:00.000Z',
        quantity: 940,
        unit: 'KG',
        notes: 'Alzas melarias de la primera cosecha.',
      },
      userProductor,
    );
    logger.log(
      `Movimiento ${movimiento.code} creado. Requiere documento: ${movimiento.requiresDocument} (${movimiento.appliedRule.ruleName ?? 'sin regla'})`,
    );

    await dteService.create(
      movimiento.id,
      {
        number: 'DTE-2026-00087654',
        issuedAt: '2026-11-12T08:30:00.000Z',
        fromExternalSystem: false,
      },
      userProductor,
    );

    await movements.dispatch(
      movimiento.id,
      { dispatchedAt: '2026-11-12T09:15:00.000Z' },
      userProductor,
    );

    await movements.receive(
      movimiento.id,
      {
        receivedQuantity: 938.5,
        receivedAt: '2026-11-12T12:40:00.000Z',
        discrepancyNotes: 'Merma de 1,5 kg por resto de material en el transporte.',
      },
      userSala,
    );

    await dteService.close(
      movimiento.id,
      { closedAt: '2026-11-12T13:00:00.000Z', notes: 'Cierre por la sala receptora.' },
      userSala,
    );

    // ----------------------------------------- CU-13/14/15/16: extraccion y lote
    const extraccion = await extractions.create(
      {
        establishmentId: estSala.id,
        inputs: [{ movementId: movimiento.id, quantity: 938.5, unit: 'KG' }],
        startedAt: '2026-11-13T08:00:00.000Z',
        finishedAt: '2026-11-13T16:30:00.000Z',
        outputQuantity: 612.4,
        operatorName: 'Jorge Diaz',
      },
      userSala,
    );

    const loteSala = await lots.create(
      {
        establishmentId: estSala.id,
        extractionId: extraccion.id,
        lotType: 'EXTRACCION',
        productionDate: '2026-11-13T16:30:00.000Z',
        quantity: 612.4,
        unit: 'KG',
        honeyType: 'Multifloral',
        moisturePercent: 17.4,
        color: 'Ambar claro',
      },
      userSala,
    );

    const tambores = [];
    for (let i = 1; i <= 2; i += 1) {
      const tambor = await drums.create(
        loteSala.id,
        {
          netWeight: i === 1 ? 300 : 300,
          tareWeight: 24.5,
          grossWeight: 324.5,
          sealNumber: `PRE-${2026}${String(i).padStart(3, '0')}`,
          filledAt: '2026-11-13T17:00:00.000Z',
        },
        userSala,
      );
      tambores.push(tambor);
    }

    await drums.createSample(
      {
        lotId: loteSala.id,
        drumId: tambores[0].id,
        laboratoryOrganizationId: orgLab.id,
        takenAt: '2026-11-13T17:30:00.000Z',
        analysisType: 'HMF, humedad y conductividad',
      },
      userSala,
    );

    // -------------------------------- CU-24/25: envio a acopio y lote de mezcla
    const movimientoAcopio = await movements.create(
      {
        movementType: 'MIEL_A_GRANEL',
        materialType: 'MIEL',
        originEstablishmentId: estSala.id,
        destinationEstablishmentId: estAcopio.id,
        carrierId: transportista.id,
        vehicleId: camion.id,
        scheduledAt: '2026-11-20T10:00:00.000Z',
        quantity: 600,
        unit: 'KG',
        notes: 'Dos tambores del lote de extraccion.',
      },
      userSala,
    );

    await dteService.create(
      movimientoAcopio.id,
      { number: 'REM-2026-000341' },
      userSala,
    );
    await movements.dispatch(movimientoAcopio.id, {}, userSala);
    await movements.receive(
      movimientoAcopio.id,
      { receivedQuantity: 600, receivedAt: '2026-11-20T15:20:00.000Z' },
      userAcopio,
    );

    for (const tambor of tambores) {
      await drums.transfer(
        tambor.id,
        { toEstablishmentId: estAcopio.id, occurredAt: '2026-11-20T15:30:00.000Z' },
        userAcopio,
      );
    }

    const loteAcopio = await lots.create(
      {
        establishmentId: estAcopio.id,
        lotType: 'ACOPIO',
        productionDate: '2026-11-21T09:00:00.000Z',
        quantity: 600,
        unit: 'KG',
        honeyType: 'Multifloral',
        inputs: [
          { sourceType: 'LOT', sourceLotId: loteSala.id, quantity: 600, unit: 'KG' },
          { sourceType: 'MOVEMENT', sourceMovementId: movimientoAcopio.id, quantity: 600, unit: 'KG' },
        ],
      },
      userAcopio,
    );

    logger.log('----------------------------------------------------------------');
    logger.log('Seed completado. Cadena de demostracion:');
    logger.log(`  Productor        ${productor.businessName}`);
    logger.log(`  Apiario          ${apiario.code}`);
    logger.log(`  Movimiento       ${movimiento.code} (DT-e cerrado)`);
    logger.log(`  Extraccion       ${extraccion.code}`);
    logger.log(`  Lote de sala     ${loteSala.code}  -> ${loteSala.id}`);
    logger.log(`  Tambores         ${tambores.map((t) => t.code).join(', ')}`);
    logger.log(`  Movimiento sala  ${movimientoAcopio.code}`);
    logger.log(`  Lote de acopio   ${loteAcopio.code}  -> ${loteAcopio.id}`);
    logger.log('');
    logger.log(`  Usuarios de prueba (password: ${DEMO_PASSWORD}):`);
    logger.log('    admin@apitrace        ADMIN');
    logger.log('    productor@apitrace    PRODUCTOR');
    logger.log('    sala@apitrace         SALA');
    logger.log('    acopio@apitrace       ACOPIADOR');
    logger.log('    auditor@apitrace      AUDITOR');
    logger.log('    laboratorio@apitrace  LABORATORIO');
    logger.log('----------------------------------------------------------------');
  } finally {
    await app.close();
  }
}

async function ensureAdmin(auth: AuthService, db: Database): Promise<AuthenticatedUser> {
  const email = 'admin@apitrace';
  const existing = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (existing.length > 0) {
    const record = existing[0];
    return {
      id: record.id,
      email: record.email,
      fullName: record.fullName,
      role: record.role,
      organizationId: record.organizationId,
    };
  }
  return auth.register({ email, password: DEMO_PASSWORD, fullName: 'Administrador ApiTrace' });
}

async function createUser(
  auth: AuthService,
  identity: IdentityService,
  admin: AuthenticatedUser,
  email: string,
  fullName: string,
  role: 'PRODUCTOR' | 'SALA' | 'ACOPIADOR' | 'AUDITOR' | 'LABORATORIO',
  organizationId: string | null,
): Promise<AuthenticatedUser> {
  const created = await auth.register(
    { email, password: DEMO_PASSWORD, fullName, role, organizationId: organizationId ?? undefined },
    admin,
  );
  await identity.updateUser(
    created.id,
    { role, organizationId: organizationId ?? undefined, status: 'ACTIVE' },
    admin,
  );
  return { ...created, role, organizationId };
}

main().catch((error: unknown) => {
  logger.error('Fallo el seed', error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
