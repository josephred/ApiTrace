import { useState } from 'react';
import { useSync } from '../lib/sync';
import { formatDateTime, formatRelative } from '../lib/format';
import type { OutboxItem } from '../lib/db';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Notice,
  PageHeader,
  Pill,
  Stat,
} from '../components/ui';
import { DataList, type Column } from '../components/DataList';

const METHOD_LABEL: Record<string, string> = {
  POST: 'Alta',
  PATCH: 'Cambio',
  PUT: 'Cambio',
  DELETE: 'Baja',
};

const statePill = (item: OutboxItem) => {
  if (item.status === 'FAILED')
    return (
      <Pill tone="danger" icon="danger">
        Rechazada
      </Pill>
    );
  if (item.status === 'SENDING')
    return (
      <Pill tone="info" icon="sync">
        Enviando
      </Pill>
    );
  return (
    <Pill tone="warning" icon="warning">
      En espera
    </Pill>
  );
};

export const PendingPage = () => {
  const { online, syncing, pending, pendingCount, failedCount, lastSyncAt, flush, discard, retry } =
    useSync();
  const [discarding, setDiscarding] = useState<OutboxItem | null>(null);
  const [busy, setBusy] = useState(false);

  const columns: Column<OutboxItem>[] = [
    {
      key: 'label',
      header: 'Operación',
      role: 'title',
      cell: (item) => (
        <>
          <span className="row row-tight">
            <Pill>{METHOD_LABEL[item.method] ?? item.method}</Pill>
            <strong>{item.label}</strong>
          </span>
          {item.lastError && (
            <div className="small" style={{ color: 'var(--danger-fg)', marginTop: 4 }}>
              {item.lastError}
            </div>
          )}
        </>
      ),
    },
    {
      key: 'state',
      header: 'Estado',
      role: 'status',
      cell: statePill,
    },
    {
      key: 'created',
      header: 'Registrada',
      cell: (item) => <span className="nowrap">{formatDateTime(item.createdAt)}</span>,
    },
    {
      key: 'attempts',
      header: 'Intentos',
      align: 'right',
      cell: (item) => item.attempts,
    },
  ];

  return (
    <div className="stack">
      <PageHeader
        title="Pendientes de enviar"
        help="pending"
        actions={
          // Sin nada en cola, un boton apagado solo ocupa lugar: se oculta.
          pending.length > 0 && (
            <Button
              variant="primary"
              icon="send"
              onClick={() => void flush()}
              busy={syncing}
              busyLabel="Enviando…"
              disabled={!online}
            >
              Enviar ahora
            </Button>
          )
        }
      />

      {!online && (
        <Notice tone="warning" title="Sin conexión">
          La cola se envía sola en cuanto vuelva la señal. No hace falta que hagas nada.
        </Notice>
      )}

      {failedCount > 0 && (
        <Notice tone="danger" title="Hay operaciones que el servidor rechazó">
          Reintentarlas sin corregir el dato daría el mismo resultado. Revisá el motivo de cada una
          y, si ya no corresponde, descartala.
        </Notice>
      )}

      <div className="grid c3">
        <Stat label="En espera" value={pendingCount} hint={online ? 'se envían solas' : 'esperando señal'} help="pending" />
        <Stat label="Rechazadas" value={failedCount} hint="necesitan tu revisión" />
        <Stat label="Último envío" value={formatRelative(lastSyncAt)} help="offline" />
      </div>

      <Card flush>
        <DataList
          items={pending}
          columns={columns}
          rowKey={(item) => item.id}
          rowActions={(item) => (
            <>
              {item.status === 'FAILED' && (
                <Button size="sm" icon="sync" onClick={() => void retry(item.id)} disabled={!online}>
                  Reintentar
                </Button>
              )}
              <Button size="sm" variant="danger" icon="trash" onClick={() => setDiscarding(item)}>
                Descartar
              </Button>
            </>
          )}
          empty={
            <EmptyState
              icon="checkCircle"
              title="No hay nada pendiente"
              description="Todo lo que registraste en este dispositivo ya llegó al servidor."
            />
          }
        />
      </Card>

      <Card title="Cómo funciona la cola" help="idempotency">
        <div className="small stack">
          <p>
            Las operaciones se envían <strong>en el orden en que las registraste</strong>, porque un
            lote puede depender de un movimiento cargado antes.
          </p>
          <p>
            Si se corta la señal a mitad del envío, se detiene ahí y retoma desde el mismo punto: no
            se gastan los intentos del resto de la cola por un problema de conexión.
          </p>
          <p>
            Una operación que el servidor rechaza por un dato inválido deja de reintentarse sola y
            queda acá para que la revises.
          </p>
        </div>
      </Card>

      {/*
        Descartar es la única acción irreversible de la aplicación: la operación
        no se envía y se pierde. Antes usaba el diálogo del navegador, que no se
        puede redactar ni traducir.
      */}
      {discarding && (
        <ConfirmDialog
          title="Descartar esta operación"
          description={
            <>
              <strong>{discarding.label}</strong> no se va a enviar y se pierde. Esta acción no se
              puede deshacer.
            </>
          }
          confirmLabel="Sí, descartar"
          busy={busy}
          onCancel={() => setDiscarding(null)}
          onConfirm={async () => {
            setBusy(true);
            await discard(discarding.id);
            setBusy(false);
            setDiscarding(null);
          }}
        />
      )}
    </div>
  );
};
