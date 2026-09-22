import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../database/database.module';
import {
  apiary,
  drum,
  establishment,
  extraction,
  extractionInput,
  lot,
  lotInput,
  movement,
  dte,
  reception,
  renapaRegistration,
  renspaRegistration,
  producer,
  traceabilityEvent,
} from '../../database/schema';
import { AccessControlService } from '../../common/services/access-control.service';
import type { AuthenticatedUser } from '../../common/types';
import { effectiveStatus, isVoid } from '../movement/dte.rules';
import { nodeKey, type TraceEdge, type TraceGap, type TraceNode, type TraceResult } from './traceability.types';

/** Corta ciclos y cadenas patologicas de lotes derivados. */
const MAX_LOT_DEPTH = 20;

@Injectable()
export class TraceabilityService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly access: AccessControlService,
  ) {}

  // -------------------------------------------------------------------------
  // CU-17: trazabilidad hacia atras
  // -------------------------------------------------------------------------

  async backwardFromLot(lotId: string, actor: AuthenticatedUser): Promise<TraceResult> {
    const root = await this.requireLot(lotId, actor);
    return this.buildBackward(root, null);
  }

  async backwardFromDrum(drumId: string, actor: AuthenticatedUser): Promise<TraceResult> {
    const rows = await this.db.select().from(drum).where(eq(drum.id, drumId)).limit(1);
    if (rows.length === 0) throw new NotFoundException('Tambor no encontrado.');
    const root = await this.requireLot(rows[0].lotId, actor);
    return this.buildBackward(root, rows[0]);
  }

  /**
   * Reconstruye el origen recorriendo el grafo hacia atras:
   *   tambor -> lote -> (lotes previos)* -> extraccion/movimiento -> apiario ->
   *   establecimiento -> RENSPA -> productor -> RENAPA
   *
   * La ascendencia de lotes se resuelve con una CTE recursiva sobre lot_input:
   * un lote de acopio puede componerse de lotes que a su vez vienen de otros,
   * y esa profundidad no se conoce de antemano. El array `path` corta ciclos
   * que, aunque no deberian existir, no deben colgar la consulta.
   */
  private async buildBackward(
    rootLot: typeof lot.$inferSelect,
    rootDrum: typeof drum.$inferSelect | null,
  ): Promise<TraceResult> {
    const nodes = new Map<string, TraceNode>();
    const edges: TraceEdge[] = [];
    const gaps: TraceGap[] = [];

    const addNode = (node: TraceNode) => {
      if (!nodes.has(node.key)) nodes.set(node.key, node);
    };
    const addEdge = (from: string, to: string, relation: string) => {
      if (!edges.some((e) => e.from === from && e.to === to && e.relation === relation)) {
        edges.push({ from, to, relation });
      }
    };

    const ancestry = await this.db.execute<{
      id: string;
      code: string;
      status: string;
      lot_type: string;
      quantity: string;
      unit: string;
      establishment_id: string;
      extraction_id: string | null;
      production_date: Date;
      depth: number;
      parent_id: string | null;
    }>(sql`
      WITH RECURSIVE lot_ancestry AS (
        SELECT l.id, l.code, l.status::text, l.lot_type::text, l.quantity, l.unit::text,
               l.establishment_id, l.extraction_id, l.production_date,
               0 AS depth, ARRAY[l.id] AS path, NULL::uuid AS parent_id
        FROM lot l
        WHERE l.id = ${rootLot.id}

        UNION ALL

        SELECT src.id, src.code, src.status::text, src.lot_type::text, src.quantity, src.unit::text,
               src.establishment_id, src.extraction_id, src.production_date,
               child.depth + 1, child.path || src.id, child.id AS parent_id
        FROM lot_ancestry child
        JOIN lot_input li ON li.lot_id = child.id AND li.source_lot_id IS NOT NULL
        JOIN lot src ON src.id = li.source_lot_id
        WHERE NOT src.id = ANY(child.path)
          AND child.depth < ${MAX_LOT_DEPTH}
      )
      SELECT * FROM lot_ancestry ORDER BY depth ASC
    `);

    const lotRows = ancestry.rows ?? [];
    const lotIds = [...new Set(lotRows.map((row) => row.id))];

    for (const row of lotRows) {
      const key = nodeKey('lot', row.id);
      addNode({
        key,
        type: 'lot',
        id: row.id,
        label: row.code,
        depth: row.depth,
        attributes: {
          status: row.status,
          lotType: row.lot_type,
          quantity: row.quantity,
          unit: row.unit,
          productionDate: new Date(row.production_date),
          establishmentId: row.establishment_id,
        },
      });
      if (row.parent_id) {
        addEdge(nodeKey('lot', row.parent_id), key, 'se compone de');
      }
    }

    if (rootDrum) {
      const key = nodeKey('drum', rootDrum.id);
      addNode({
        key,
        type: 'drum',
        id: rootDrum.id,
        label: rootDrum.code,
        attributes: {
          netWeight: rootDrum.netWeight,
          unit: rootDrum.unit,
          status: rootDrum.status,
          locationEstablishmentId: rootDrum.locationEstablishmentId,
        },
      });
      addEdge(key, nodeKey('lot', rootLot.id), 'pertenece al lote');
    }

    const inputs = await this.db
      .select()
      .from(lotInput)
      .where(inArray(lotInput.lotId, lotIds))
      .orderBy(asc(lotInput.createdAt));

    if (inputs.length === 0) {
      gaps.push({
        severity: 'WARNING',
        code: 'LOT_WITHOUT_INPUTS',
        message: `El lote ${rootLot.code} no declara entradas: su origen no puede reconstruirse.`,
        entity: { type: 'lot', id: rootLot.id, label: rootLot.code },
      });
    }

    const extractionIds = new Set<string>();
    const movementIds = new Set<string>();

    for (const row of lotRows) {
      if (row.extraction_id) extractionIds.add(row.extraction_id);
    }
    for (const input of inputs) {
      if (input.sourceExtractionId) extractionIds.add(input.sourceExtractionId);
      if (input.sourceMovementId) movementIds.add(input.sourceMovementId);
    }

    const extractions =
      extractionIds.size > 0
        ? await this.db
            .select()
            .from(extraction)
            .where(inArray(extraction.id, [...extractionIds]))
        : [];

    for (const row of extractions) {
      const key = nodeKey('extraction', row.id);
      addNode({
        key,
        type: 'extraction',
        id: row.id,
        label: row.code,
        attributes: {
          status: row.status,
          startedAt: row.startedAt,
          finishedAt: row.finishedAt,
          inputQuantity: row.inputQuantity,
          outputQuantity: row.outputQuantity,
          establishmentId: row.establishmentId,
        },
      });
    }

    for (const input of inputs) {
      if (input.sourceExtractionId) {
        addEdge(
          nodeKey('lot', input.lotId),
          nodeKey('extraction', input.sourceExtractionId),
          'proviene de la extraccion',
        );
      }
      if (input.sourceMovementId) {
        addEdge(
          nodeKey('lot', input.lotId),
          nodeKey('movement', input.sourceMovementId),
          'proviene del movimiento',
        );
      }
    }

    if (extractionIds.size > 0) {
      const extInputs = await this.db
        .select()
        .from(extractionInput)
        .where(inArray(extractionInput.extractionId, [...extractionIds]));
      for (const row of extInputs) {
        movementIds.add(row.movementId);
        addEdge(
          nodeKey('extraction', row.extractionId),
          nodeKey('movement', row.movementId),
          'procesa el movimiento',
        );
      }
    }

    await this.expandMovements([...movementIds], addNode, addEdge, gaps);

    const summary = this.buildSummary([...nodes.values()], edges);
    return {
      direction: 'backward',
      root: rootDrum
        ? nodes.get(nodeKey('drum', rootDrum.id))!
        : nodes.get(nodeKey('lot', rootLot.id))!,
      nodes: [...nodes.values()],
      edges,
      summary,
      gaps,
      complete: gaps.every((gap) => gap.severity !== 'ERROR') && summary.producers.length > 0,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Desde un conjunto de movimientos completa el resto de la cadena hacia atras:
   * DT-e, recepcion, apiario, establecimiento, RENSPA, productor y RENAPA.
   */
  private async expandMovements(
    movementIds: string[],
    addNode: (node: TraceNode) => void,
    addEdge: (from: string, to: string, relation: string) => void,
    gaps: TraceGap[],
  ): Promise<void> {
    if (movementIds.length === 0) return;

    const movements = await this.db
      .select()
      .from(movement)
      .where(inArray(movement.id, movementIds));

    const [dteRows, receptionRows] = await Promise.all([
      this.db.select().from(dte).where(inArray(dte.movementId, movementIds)),
      this.db.select().from(reception).where(inArray(reception.movementId, movementIds)),
    ]);

    const establishmentIds = new Set<string>();
    const apiaryIds = new Set<string>();

    for (const row of movements) {
      const key = nodeKey('movement', row.id);
      addNode({
        key,
        type: 'movement',
        id: row.id,
        label: row.code,
        attributes: {
          status: row.status,
          movementType: row.movementType,
          materialType: row.materialType,
          quantity: row.quantity,
          unit: row.unit,
          scheduledAt: row.scheduledAt,
          dispatchedAt: row.dispatchedAt,
          receivedAt: row.receivedAt,
          requiresDocument: row.requiresDocument,
        },
      });

      establishmentIds.add(row.originEstablishmentId);
      establishmentIds.add(row.destinationEstablishmentId);
      if (row.originApiaryId) apiaryIds.add(row.originApiaryId);

      if (row.originApiaryId) {
        addEdge(key, nodeKey('apiary', row.originApiaryId), 'se origina en el apiario');
      } else {
        addEdge(
          key,
          nodeKey('establishment', row.originEstablishmentId),
          'se origina en el establecimiento',
        );
      }

      // Un movimiento puede tener DT-e anulados y uno reemitido: la cadena la
      // ampara el que esta en juego (o, si todos fueron dados de baja, ninguno).
      const documents = dteRows
        .filter((d) => d.movementId === row.id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const document = documents.find((d) => !isVoid(d.status)) ?? null;
      if (document) {
        const dteKey = nodeKey('dte', document.id);
        const status = effectiveStatus(document.status, document, new Date());
        addNode({
          key: dteKey,
          type: 'dte',
          id: document.id,
          label: document.number ?? 'DT-e sin numero',
          attributes: {
            status,
            syncStatus: document.syncStatus,
            issueMode: document.issueMode,
            issuedAt: document.issuedAt,
            closedAt: document.closedAt,
            originCode: document.originCode,
            destinationCode: document.destinationCode,
            declaredQuantity: document.declaredQuantity,
            confirmedQuantity: document.confirmedQuantity,
            loadDate: document.loadDate,
            expiryDate: document.expiryDate,
            originRenspa: document.originRenspa,
            destinationRenspa: document.destinationRenspa,
            replacedDocuments: documents.filter((d) => d.id !== document.id).length,
          },
        });
        addEdge(key, dteKey, 'esta amparado por');

        const entity = { type: 'movement' as const, id: row.id, label: row.code };
        if (document.issueMode === 'SIMULADO') {
          gaps.push({
            severity: 'WARNING',
            code: 'DTE_SIMULADO',
            message: `El DT-e del movimiento ${row.code} es una simulacion: no tiene validez oficial.`,
            entity,
          });
        } else if (document.syncStatus === 'PENDING_SYNC') {
          gaps.push({
            severity: 'WARNING',
            code: 'DTE_PENDING_SYNC',
            message: `El DT-e del movimiento ${row.code} no esta sincronizado con SIGSA.`,
            entity,
          });
        }
        if (status === 'VENCIDO') {
          gaps.push({
            severity: 'WARNING',
            code: 'DTE_VENCIDO_SIN_CIERRE',
            message: `El DT-e del movimiento ${row.code} vencio sin cierre de la sala.`,
            entity,
          });
        } else if (status === 'CADUCADO') {
          gaps.push({
            severity: 'ERROR',
            code: 'DTE_CADUCADO',
            message: `El DT-e del movimiento ${row.code} caduco sin cierre: el traslado no quedo amparado.`,
            entity,
          });
        } else if (status === 'SIN_ARRIBO') {
          gaps.push({
            severity: 'ERROR',
            code: 'DTE_SIN_ARRIBO',
            message: `La sala declaro que la carga del movimiento ${row.code} nunca arribo.`,
            entity,
          });
        }
      } else if (row.requiresDocument) {
        gaps.push({
          severity: 'ERROR',
          code: 'MISSING_REQUIRED_DOCUMENT',
          message: `El movimiento ${row.code} requiere ${row.requiredDocumentType ?? 'un documento'} y no lo tiene registrado.`,
          entity: { type: 'movement', id: row.id, label: row.code },
        });
      }

      const received = receptionRows.find((r) => r.movementId === row.id);
      if (received) {
        const receptionKey = nodeKey('reception', received.id);
        addNode({
          key: receptionKey,
          type: 'reception',
          id: received.id,
          label: `Recepcion ${received.receivedAt.toISOString().slice(0, 10)}`,
          attributes: {
            receivedQuantity: received.receivedQuantity,
            unit: received.unit,
            result: received.result,
            hasDiscrepancy: received.hasDiscrepancy,
            establishmentId: received.establishmentId,
          },
        });
        addEdge(key, receptionKey, 'fue recibido en');
        if (received.hasDiscrepancy) {
          gaps.push({
            severity: 'WARNING',
            code: 'RECEPTION_DISCREPANCY',
            message: `La recepcion del movimiento ${row.code} registro una diferencia de cantidad.`,
            entity: { type: 'movement', id: row.id, label: row.code },
          });
        }
      }
    }

    const apiaries =
      apiaryIds.size > 0
        ? await this.db.select().from(apiary).where(inArray(apiary.id, [...apiaryIds]))
        : [];
    for (const row of apiaries) {
      establishmentIds.add(row.establishmentId);
      addNode({
        key: nodeKey('apiary', row.id),
        type: 'apiary',
        id: row.id,
        label: row.code,
        attributes: {
          name: row.name,
          establishmentId: row.establishmentId,
          hiveCount: row.hiveCount,
          latitude: row.latitude,
          longitude: row.longitude,
          locality: row.locality,
          province: row.province,
          status: row.status,
          renapaCode: row.renapaCode,
          renapaStatus: row.renapaStatus,
        },
      });
      addEdge(
        nodeKey('apiary', row.id),
        nodeKey('establishment', row.establishmentId),
        'pertenece al establecimiento',
      );
    }

    await this.expandEstablishments([...establishmentIds], addNode, addEdge, gaps);
  }

  private async expandEstablishments(
    establishmentIds: string[],
    addNode: (node: TraceNode) => void,
    addEdge: (from: string, to: string, relation: string) => void,
    gaps: TraceGap[],
  ): Promise<void> {
    if (establishmentIds.length === 0) return;

    const establishments = await this.db
      .select()
      .from(establishment)
      .where(inArray(establishment.id, establishmentIds));

    for (const row of establishments) {
      addNode({
        key: nodeKey('establishment', row.id),
        type: 'establishment',
        id: row.id,
        label: row.name,
        attributes: {
          type: row.type,
          locality: row.locality,
          province: row.province,
          latitude: row.latitude,
          longitude: row.longitude,
          status: row.status,
          rne: row.rne,
          senasaCode: row.senasaCode,
          senasaStatus: row.senasaStatus,
          organizationId: row.organizationId,
        },
      });
    }

    const renspaRows = await this.db
      .select()
      .from(renspaRegistration)
      .where(inArray(renspaRegistration.establishmentId, establishmentIds));

    const producerIds = new Set<string>();
    for (const row of renspaRows) {
      producerIds.add(row.producerId);
      const key = nodeKey('renspa', row.id);
      addNode({
        key,
        type: 'renspa',
        id: row.id,
        label: row.number,
        attributes: {
          status: row.status,
          activity: row.activity,
          syncStatus: row.syncStatus,
          validFrom: row.validFrom,
          validTo: row.validTo,
        },
      });
      addEdge(nodeKey('establishment', row.establishmentId), key, 'identificado por');
      addEdge(key, nodeKey('producer', row.producerId), 'a cargo de');
    }

    const withoutRenspa = establishments.filter(
      (row) => !renspaRows.some((r) => r.establishmentId === row.id),
    );
    for (const row of withoutRenspa) {
      gaps.push({
        severity: 'WARNING',
        code: 'ESTABLISHMENT_WITHOUT_RENSPA',
        message: `El establecimiento ${row.name} no tiene RENSPA asociado.`,
        entity: { type: 'establishment', id: row.id, label: row.name },
      });
    }

    if (producerIds.size === 0) return;

    const [producers, renapaRows] = await Promise.all([
      this.db.select().from(producer).where(inArray(producer.id, [...producerIds])),
      this.db
        .select()
        .from(renapaRegistration)
        .where(inArray(renapaRegistration.producerId, [...producerIds])),
    ]);

    for (const row of producers) {
      addNode({
        key: nodeKey('producer', row.id),
        type: 'producer',
        id: row.id,
        label: row.businessName,
        attributes: {
          taxId: row.taxId,
          personType: row.personType,
          status: row.status,
          province: row.province,
          locality: row.locality,
          organizationId: row.organizationId,
        },
      });
    }

    for (const row of renapaRows) {
      const key = nodeKey('renapa', row.id);
      addNode({
        key,
        type: 'renapa',
        id: row.id,
        label: row.number,
        attributes: { status: row.status, syncStatus: row.syncStatus, issuedAt: row.issuedAt },
      });
      addEdge(nodeKey('producer', row.producerId), key, 'registrado como productor apicola');
    }

    // El RENAPA identifica la actividad apicola primaria: exigirselo al titular
    // de una sala o de un acopio seria un falso positivo. Solo se advierte por
    // los productores que son titulares de un predio apicola.
    const apicultorIds = new Set(
      renspaRows
        .filter((renspa) =>
          establishments.some(
            (site) => site.id === renspa.establishmentId && site.type === 'APIARIO_BASE',
          ),
        )
        .map((renspa) => renspa.producerId),
    );

    for (const row of producers) {
      if (apicultorIds.has(row.id) && !renapaRows.some((r) => r.producerId === row.id)) {
        gaps.push({
          severity: 'WARNING',
          code: 'PRODUCER_WITHOUT_RENAPA',
          message: `El productor ${row.businessName} es titular de un predio apicola y no tiene RENAPA asociado.`,
          entity: { type: 'producer', id: row.id, label: row.businessName },
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // CU-18: trazabilidad hacia adelante
  // -------------------------------------------------------------------------

  async forwardFrom(
    entityType: 'producer' | 'establishment' | 'apiary' | 'movement' | 'lot',
    entityId: string,
    actor: AuthenticatedUser,
  ): Promise<TraceResult> {
    const nodes = new Map<string, TraceNode>();
    const edges: TraceEdge[] = [];
    const gaps: TraceGap[] = [];

    const addNode = (node: TraceNode) => {
      if (!nodes.has(node.key)) nodes.set(node.key, node);
    };
    const addEdge = (from: string, to: string, relation: string) => {
      if (!edges.some((e) => e.from === from && e.to === to && e.relation === relation)) {
        edges.push({ from, to, relation });
      }
    };

    let rootNode: TraceNode;
    let movementIds: string[] = [];
    let seedLotIds: string[] = [];

    switch (entityType) {
      case 'producer': {
        const rows = await this.db.select().from(producer).where(eq(producer.id, entityId)).limit(1);
        if (rows.length === 0) throw new NotFoundException('Productor no encontrado.');
        this.access.assertOrganizationAccess(actor, rows[0].organizationId);
        rootNode = {
          key: nodeKey('producer', entityId),
          type: 'producer',
          id: entityId,
          label: rows[0].businessName,
          attributes: { taxId: rows[0].taxId, status: rows[0].status },
        };
        const sites = await this.db
          .select({ id: establishment.id })
          .from(establishment)
          .where(eq(establishment.producerId, entityId));
        const siteIds = sites.map((s) => s.id);
        movementIds = await this.movementsFromEstablishments(siteIds);
        for (const site of siteIds) {
          addEdge(rootNode.key, nodeKey('establishment', site), 'opera el establecimiento');
        }
        break;
      }
      case 'establishment': {
        const rows = await this.db
          .select()
          .from(establishment)
          .where(eq(establishment.id, entityId))
          .limit(1);
        if (rows.length === 0) throw new NotFoundException('Establecimiento no encontrado.');
        this.access.assertOrganizationAccess(actor, rows[0].organizationId);
        rootNode = {
          key: nodeKey('establishment', entityId),
          type: 'establishment',
          id: entityId,
          label: rows[0].name,
          attributes: { type: rows[0].type, status: rows[0].status },
        };
        movementIds = await this.movementsFromEstablishments([entityId]);
        break;
      }
      case 'apiary': {
        const rows = await this.db.select().from(apiary).where(eq(apiary.id, entityId)).limit(1);
        if (rows.length === 0) throw new NotFoundException('Apiario no encontrado.');
        const site = await this.db
          .select()
          .from(establishment)
          .where(eq(establishment.id, rows[0].establishmentId))
          .limit(1);
        this.access.assertOrganizationAccess(actor, site[0]?.organizationId ?? null);
        rootNode = {
          key: nodeKey('apiary', entityId),
          type: 'apiary',
          id: entityId,
          label: rows[0].code,
          attributes: {
            name: rows[0].name,
            hiveCount: rows[0].hiveCount,
            renapaCode: rows[0].renapaCode,
            renapaStatus: rows[0].renapaStatus,
          },
        };
        const rowsMov = await this.db
          .select({ id: movement.id })
          .from(movement)
          .where(eq(movement.originApiaryId, entityId));
        movementIds = rowsMov.map((r) => r.id);
        break;
      }
      case 'movement': {
        const rows = await this.db.select().from(movement).where(eq(movement.id, entityId)).limit(1);
        if (rows.length === 0) throw new NotFoundException('Movimiento no encontrado.');
        rootNode = {
          key: nodeKey('movement', entityId),
          type: 'movement',
          id: entityId,
          label: rows[0].code,
          attributes: { status: rows[0].status, quantity: rows[0].quantity, unit: rows[0].unit },
        };
        movementIds = [entityId];
        break;
      }
      case 'lot': {
        const record = await this.requireLot(entityId, actor);
        rootNode = {
          key: nodeKey('lot', entityId),
          type: 'lot',
          id: entityId,
          label: record.code,
          attributes: { status: record.status, quantity: record.quantity, unit: record.unit },
        };
        seedLotIds = [entityId];
        break;
      }
    }

    addNode(rootNode);

    if (movementIds.length > 0) {
      await this.expandMovements(movementIds, addNode, addEdge, gaps);

      // De los movimientos a las extracciones y lotes que originaron.
      const [extInputs, directLotInputs] = await Promise.all([
        this.db
          .select()
          .from(extractionInput)
          .where(inArray(extractionInput.movementId, movementIds)),
        this.db.select().from(lotInput).where(inArray(lotInput.sourceMovementId, movementIds)),
      ]);

      const extractionIds = [...new Set(extInputs.map((row) => row.extractionId))];
      if (extractionIds.length > 0) {
        const extractions = await this.db
          .select()
          .from(extraction)
          .where(inArray(extraction.id, extractionIds));
        for (const row of extractions) {
          addNode({
            key: nodeKey('extraction', row.id),
            type: 'extraction',
            id: row.id,
            label: row.code,
            attributes: {
              status: row.status,
              startedAt: row.startedAt,
              outputQuantity: row.outputQuantity,
            },
          });
        }
        for (const row of extInputs) {
          addEdge(
            nodeKey('movement', row.movementId),
            nodeKey('extraction', row.extractionId),
            'se procesa en',
          );
        }
        const fromExtractions = await this.db
          .select({ id: lot.id })
          .from(lot)
          .where(inArray(lot.extractionId, extractionIds));
        seedLotIds.push(...fromExtractions.map((row) => row.id));

        const viaInputs = await this.db
          .select({ lotId: lotInput.lotId, sourceExtractionId: lotInput.sourceExtractionId })
          .from(lotInput)
          .where(inArray(lotInput.sourceExtractionId, extractionIds));
        for (const row of viaInputs) {
          seedLotIds.push(row.lotId);
          if (row.sourceExtractionId) {
            addEdge(
              nodeKey('extraction', row.sourceExtractionId),
              nodeKey('lot', row.lotId),
              'produce el lote',
            );
          }
        }
      }

      for (const row of directLotInputs) {
        seedLotIds.push(row.lotId);
        if (row.sourceMovementId) {
          addEdge(nodeKey('movement', row.sourceMovementId), nodeKey('lot', row.lotId), 'compone el lote');
        }
      }

      if (movementIds.length > 0 && seedLotIds.length === 0) {
        gaps.push({
          severity: 'WARNING',
          code: 'NO_DOWNSTREAM_LOT',
          message:
            'Los movimientos encontrados todavia no derivaron en ningun lote: la cadena esta abierta.',
        });
      }
    }

    seedLotIds = [...new Set(seedLotIds)];

    if (seedLotIds.length > 0) {
      const descendants = await this.db.execute<{
        id: string;
        code: string;
        status: string;
        lot_type: string;
        quantity: string;
        unit: string;
        establishment_id: string;
        depth: number;
        parent_id: string | null;
      }>(sql`
        WITH RECURSIVE lot_descendants AS (
          SELECT l.id, l.code, l.status::text, l.lot_type::text, l.quantity, l.unit::text,
                 l.establishment_id, 0 AS depth, ARRAY[l.id] AS path, NULL::uuid AS parent_id
          FROM lot l
          WHERE l.id IN ${seedLotIds}

          UNION ALL

          SELECT child.id, child.code, child.status::text, child.lot_type::text, child.quantity,
                 child.unit::text, child.establishment_id,
                 parent.depth + 1, parent.path || child.id, parent.id AS parent_id
          FROM lot_descendants parent
          JOIN lot_input li ON li.source_lot_id = parent.id
          JOIN lot child ON child.id = li.lot_id
          WHERE NOT child.id = ANY(parent.path)
            AND parent.depth < ${MAX_LOT_DEPTH}
        )
        SELECT * FROM lot_descendants ORDER BY depth ASC
      `);

      const lotRows = descendants.rows ?? [];
      for (const row of lotRows) {
        addNode({
          key: nodeKey('lot', row.id),
          type: 'lot',
          id: row.id,
          label: row.code,
          depth: row.depth,
          attributes: {
            status: row.status,
            lotType: row.lot_type,
            quantity: row.quantity,
            unit: row.unit,
            establishmentId: row.establishment_id,
          },
        });
        if (row.parent_id) {
          addEdge(nodeKey('lot', row.parent_id), nodeKey('lot', row.id), 'se transforma en');
        }
      }

      const allLotIds = [...new Set(lotRows.map((row) => row.id))];
      if (allLotIds.length > 0) {
        const drums = await this.db.select().from(drum).where(inArray(drum.lotId, allLotIds));
        for (const row of drums) {
          addNode({
            key: nodeKey('drum', row.id),
            type: 'drum',
            id: row.id,
            label: row.code,
            attributes: {
              netWeight: row.netWeight,
              unit: row.unit,
              status: row.status,
              locationEstablishmentId: row.locationEstablishmentId,
            },
          });
          addEdge(nodeKey('lot', row.lotId), nodeKey('drum', row.id), 'se materializa en');
        }
      }
    }

    const summary = this.buildSummary([...nodes.values()], edges);
    return {
      direction: 'forward',
      root: rootNode,
      nodes: [...nodes.values()],
      edges,
      summary,
      gaps,
      complete: gaps.every((gap) => gap.severity !== 'ERROR'),
      generatedAt: new Date().toISOString(),
    };
  }

  private async movementsFromEstablishments(establishmentIds: string[]): Promise<string[]> {
    if (establishmentIds.length === 0) return [];
    const rows = await this.db
      .select({ id: movement.id })
      .from(movement)
      .where(inArray(movement.originEstablishmentId, establishmentIds));
    return rows.map((row) => row.id);
  }

  private buildSummary(nodes: TraceNode[], edges: TraceEdge[]): TraceResult['summary'] {
    const byType = (type: string) => nodes.filter((node) => node.type === type);
    const byKey = new Map(nodes.map((node) => [node.key, node]));

    // Cada RENAPA se atribuye al productor que lo tiene efectivamente asociado,
    // recorriendo la arista correspondiente y no el conjunto completo.
    const renapaByProducer = new Map<string, string[]>();
    for (const edge of edges) {
      const target = byKey.get(edge.to);
      if (!target || target.type !== 'renapa') continue;
      const source = byKey.get(edge.from);
      if (!source || source.type !== 'producer') continue;
      const current = renapaByProducer.get(source.id) ?? [];
      current.push(target.label);
      renapaByProducer.set(source.id, current);
    }

    const dteByMovement = new Map<string, string | null>();
    for (const edge of edges) {
      const target = byKey.get(edge.to);
      if (!target || target.type !== 'dte') continue;
      const source = byKey.get(edge.from);
      if (!source || source.type !== 'movement') continue;
      dteByMovement.set(source.id, target.label);
    }

    return {
      producers: byType('producer').map((node) => ({
        id: node.id,
        businessName: node.label,
        renapa: renapaByProducer.get(node.id) ?? [],
      })),
      renspa: byType('renspa').map((node) => node.label),
      apiaries: byType('apiary').map((node) => ({
        id: node.id,
        code: node.label,
        establishmentId: String(node.attributes.establishmentId ?? ''),
      })),
      establishments: byType('establishment').map((node) => ({
        id: node.id,
        name: node.label,
        type: String(node.attributes.type ?? ''),
      })),
      movements: byType('movement').map((node) => ({
        id: node.id,
        code: node.label,
        status: String(node.attributes.status ?? ''),
        dteNumber: dteByMovement.get(node.id) ?? null,
      })),
      lots: byType('lot').map((node) => ({
        id: node.id,
        code: node.label,
        status: String(node.attributes.status ?? ''),
      })),
      drums: byType('drum').map((node) => ({
        id: node.id,
        code: node.label,
        netWeight: String(node.attributes.netWeight ?? ''),
      })),
    };
  }

  // -------------------------------------------------------------------------
  // CU-19: historial de una entidad
  // -------------------------------------------------------------------------

  async timeline(entityType: string, entityId: string, actor: AuthenticatedUser) {
    const allowed = [
      'producer',
      'establishment',
      'apiary',
      'movement',
      'extraction',
      'lot',
      'drum',
    ];
    if (!allowed.includes(entityType)) {
      throw new BadRequestException(`entityType debe ser uno de: ${allowed.join(', ')}.`);
    }
    if (entityType === 'lot') await this.requireLot(entityId, actor);

    const events = await this.db
      .select()
      .from(traceabilityEvent)
      .where(
        sql`${traceabilityEvent.entityType} = ${entityType} AND ${traceabilityEvent.entityId} = ${entityId}`,
      )
      // Se ordena por el instante de registro y no por occurredAt: un despacho
      // puede informarse con fecha retroactiva sin alterar el orden del historial.
      .orderBy(asc(traceabilityEvent.createdAt));

    return {
      entityType,
      entityId,
      count: events.length,
      events: events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        /** Momento de negocio en que ocurrio el hecho. */
        occurredAt: event.occurredAt,
        /** Instante en que la plataforma lo registro. Define el orden. */
        recordedAt: event.createdAt,
        actorUserId: event.actorUserId,
        correlationId: event.correlationId,
        payload: event.payload,
      })),
    };
  }

  private async requireLot(lotId: string, actor: AuthenticatedUser) {
    const rows = await this.db.select().from(lot).where(eq(lot.id, lotId)).limit(1);
    if (rows.length === 0) throw new NotFoundException('Lote no encontrado.');
    this.access.assertOrganizationAccess(actor, rows[0].organizationId);
    return rows[0];
  }
}
