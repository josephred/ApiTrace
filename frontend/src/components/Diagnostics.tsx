import { useCallback, useEffect, useState } from 'react';
import { clearCache, countCache } from '../lib/db';
import { healthUrl } from '../lib/config';
import { useSync } from '../lib/sync';
import { formatRelative } from '../lib/format';
import { Icon } from './Icon';
import { Button, Card, ConfirmDialog, Pill, useToast } from './ui';

/**
 * Diagnóstico del dispositivo.
 *
 * Viene de «Ajustes y diagnóstico» del prototipo ApiAsistente: cuando algo no
 * se envía, la primera pregunta es si el problema es la señal, el servidor o
 * lo que quedó guardado en el teléfono. Esta tarjeta responde las tres sin
 * tener que llamar a nadie, y deja limpiar la copia local sin tocar lo que
 * todavía espera para enviarse.
 */

type Probe =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'ok'; ms: number }
  | { state: 'down'; detail: string };

const formatBytes = (bytes: number): string => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB`;
};

export const Diagnostics = () => {
  const toast = useToast();
  const { online, pendingCount, failedCount, lastSyncAt } = useSync();
  const [probe, setProbe] = useState<Probe>({ state: 'idle' });
  const [cached, setCached] = useState<number | null>(null);
  const [usage, setUsage] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const cancel = useCallback(() => setConfirming(false), []);

  const measure = useCallback(async () => {
    try {
      setCached(await countCache());
    } catch {
      setCached(null);
    }
    try {
      const estimate = await navigator.storage?.estimate?.();
      setUsage(estimate?.usage ?? null);
    } catch {
      setUsage(null);
    }
  }, []);

  useEffect(() => {
    void measure();
  }, [measure]);

  const check = async () => {
    setProbe({ state: 'checking' });
    const started = performance.now();
    try {
      const response = await fetch(healthUrl, { cache: 'no-store' });
      const ms = Math.round(performance.now() - started);
      setProbe(response.ok ? { state: 'ok', ms } : { state: 'down', detail: `Respondió ${response.status}.` });
      void measure();
    } catch {
      setProbe({
        state: 'down',
        detail: online ? 'No responde. Puede estar despertando: probá de nuevo en un minuto.' : 'Sin conexión a internet.',
      });
    }
  };

  const clear = async () => {
    setClearing(true);
    try {
      await clearCache();
      await measure();
      toast({
        tone: 'success',
        title: 'Copia local borrada',
        detail: 'Lo pendiente de enviar sigue en la cola. Las pantallas se vuelven a cargar del servidor.',
      });
    } finally {
      setClearing(false);
      setConfirming(false);
    }
  };

  return (
    <Card title="Diagnóstico de este dispositivo">
      <dl className="diag">
        <div>
          <dt>Servidor</dt>
          <dd>
            {probe.state === 'ok' && (
              <Pill tone="success" icon="checkCircle">
                Responde en {probe.ms} ms
              </Pill>
            )}
            {probe.state === 'down' && (
              <Pill tone="danger" icon="danger">
                {probe.detail}
              </Pill>
            )}
            <Button size="sm" icon="sync" busy={probe.state === 'checking'} busyLabel="Probando…" onClick={() => void check()}>
              Probar conexión
            </Button>
          </dd>
        </div>
        <div>
          <dt>Conexión del teléfono</dt>
          <dd>
            {online ? (
              <Pill tone="success" icon="online">
                Con señal
              </Pill>
            ) : (
              <Pill tone="warning" icon="offline">
                Sin señal
              </Pill>
            )}
          </dd>
        </div>
        <div>
          <dt>Por enviar</dt>
          <dd>
            {pendingCount + failedCount === 0
              ? 'Nada pendiente'
              : `${pendingCount} en cola${failedCount ? `, ${failedCount} para revisar` : ''}`}
          </dd>
        </div>
        <div>
          <dt>Última sincronización</dt>
          <dd>{formatRelative(lastSyncAt)}</dd>
        </div>
        <div>
          <dt>Copia local</dt>
          <dd>
            {cached === null ? '—' : cached === 1 ? '1 consulta guardada' : `${cached} consultas guardadas`}
            {usage !== null && <span className="muted"> ({formatBytes(usage)})</span>}
          </dd>
        </div>
        <div>
          <dt>Versión</dt>
          <dd className="mono">{__APP_VERSION__}</dd>
        </div>
      </dl>
      <div className="diag-actions">
        <Button size="sm" variant="danger" icon="trash" onClick={() => setConfirming(true)}>
          Borrar copia local
        </Button>
        <span className="small muted">
          <Icon name="info" size={14} /> No borra lo que espera para enviarse.
        </span>
      </div>
      {confirming && (
        <ConfirmDialog
          title="¿Borrar la copia local?"
          description="Se borran las consultas guardadas para usar sin señal. Lo que espera para enviarse no se toca. Sin conexión, hasta volver a cargarlas, vas a ver menos datos."
          confirmLabel="Borrar copia local"
          busy={clearing}
          onCancel={cancel}
          onConfirm={() => void clear()}
        />
      )}
    </Card>
  );
};
