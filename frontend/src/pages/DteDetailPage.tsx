import { useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/useResource';
import { apiSend } from '../lib/api';
import { toUserMessage } from '../lib/errors';
import { formatDay } from '../lib/dte';
import { formatDateTime } from '../lib/format';
import {
  Button,
  Card,
  ErrorNotice,
  Notice,
  PageHeader,
  Pill,
  Sheet,
  Skeleton,
  StatusPill,
  SummaryList,
  useToast,
  useWriteFeedback,
} from '../components/ui';
import { TransitSemaphoreBadge } from '../components/TransitSemaphoreBadge';
import type { Dte } from '../lib/types';

export const DteDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user, canWrite } = useAuth();
  const feedback = useWriteFeedback();
  const toast = useToast();

  const dteRes = useResource<Dte>(id ? `/dte/${id}` : null);
  const dte = dteRes.data;

  // Modals state
  const [activeModal, setActiveModal] = useState<
    'manual' | 'sigsa' | 'void' | 'close' | 'noArrival' | 'regularize' | null
  >(null);

  // Form states
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<unknown | null>(null);

  // Form fields
  const [manualNumber, setManualNumber] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [closeCode, setCloseCode] = useState('');
  const [closeQty, setCloseQty] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [noArrivalReason, setNoArrivalReason] = useState('');
  const [regNote, setRegNote] = useState('');

  if (dteRes.loading && !dte) {
    return (
      <div className="stack">
        <PageHeader title="Cargando DT-e…" back={{ to: '/dte', label: 'DT-e' }} />
        <Card>
          <div className="stack" style={{ gap: 'var(--sp-3)' }}>
            <Skeleton height={24} width="40%" />
            <Skeleton height={18} width="60%" />
            <Skeleton height={18} width="50%" />
          </div>
        </Card>
      </div>
    );
  }

  if (dteRes.error || !dte) {
    return (
      <div className="stack">
        <PageHeader title="DT-e no encontrado" back={{ to: '/dte', label: 'DT-e' }} />
        <ErrorNotice
          message={
            dteRes.error ?? {
              title: 'No se encontró el DT-e',
              detail: 'Puede haber sido eliminado o no tenés permiso para verlo.',
              tone: 'warning',
              retryable: true,
            }
          }
          onRetry={dteRes.reload}
        />
      </div>
    );
  }

  const isIssuer = user?.organizationId && dte.issuerOrganizationId === user.organizationId;
  const isDestination = user?.organizationId && dte.destinationOrganizationId === user.organizationId;
  const isAdmin = user?.role === 'ADMIN';

  // Handler for actions
  const handleIssueManual = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setActionError(null);
    try {
      await apiSend(
        'POST',
        `/dte/${dte.id}/issue-manual`,
        {
          officialNumber: manualNumber.trim(),
          verificationCode: manualCode.trim(),
        },
        { label: 'Emisión manual de DT-e', entity: '/dte' },
      );
      feedback.saved('DT-e emitido manualmente', 'Se registró el número y código oficial.');
      setActiveModal(null);
      dteRes.reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleRequestSigsa = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await apiSend(
        'POST',
        `/dte/${dte.id}/request-sigsa`,
        {},
        { label: 'Solicitud SIGSA SENASA', entity: '/dte' },
      );
      feedback.saved('Solicitud enviada a SENASA', 'Se procesó la emisión oficial del DT-e.');
      setActiveModal(null);
      dteRes.reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleVoidDte = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setActionError(null);
    try {
      await apiSend(
        'POST',
        `/dte/${dte.id}/void`,
        { voidReason: voidReason.trim() },
        { label: 'Anulación de DT-e', entity: '/dte' },
      );
      feedback.saved('DT-e anulado', 'El documento quedó sin efecto sanitario ante SENASA.');
      setActiveModal(null);
      dteRes.reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleCloseDte = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setActionError(null);
    try {
      await apiSend(
        'POST',
        `/dte/${dte.id}/close`,
        {
          verificationCode: closeCode.trim(),
          confirmedQuantity: Number(closeQty),
          receptionNotes: closeNotes.trim() || undefined,
        },
        { label: 'Cierre de DT-e en sala', entity: '/dte' },
      );
      feedback.saved('DT-e cerrado con éxito', 'La sala confirmó la recepción conforme de la carga.');
      setActiveModal(null);
      dteRes.reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleNoArrival = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setActionError(null);
    try {
      await apiSend(
        'POST',
        `/dte/${dte.id}/no-arrival`,
        { reason: noArrivalReason.trim() },
        { label: 'Declaración sin arribo de DT-e', entity: '/dte' },
      );
      feedback.saved('Sin arribo registrado', 'Se notificó la falta de llegada del transporte.');
      setActiveModal(null);
      dteRes.reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleRegularize = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setActionError(null);
    try {
      await apiSend(
        'POST',
        `/dte/${dte.id}/regularize`,
        {
          note: regNote.trim(),
          verificationCode: closeCode.trim(),
          confirmedQuantity: Number(closeQty) || undefined,
        },
        { label: 'Regularización de DT-e', entity: '/dte' },
      );
      feedback.saved('DT-e regularizado', 'Se asentó la recepción extemporánea en auditoría.');
      setActiveModal(null);
      dteRes.reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  };

  const copyCode = () => {
    if (dte.verificationCode) {
      navigator.clipboard.writeText(dte.verificationCode);
      toast({ tone: 'info', title: 'Código copiado', detail: dte.verificationCode });
    }
  };

  return (
    <div className="stack">
      <PageHeader
        title={dte.number ? `DT-e: ${dte.number}` : 'DT-e (Borrador)'}
        code={`ID: ${dte.id}`}
        status={<StatusPill status={dte.status} />}
        back={{ to: '/dte', label: 'DT-e' }}
        help="dteTransit"
        actions={
          <div className="row row-tight">
            {canWrite && dte.status === 'BORRADOR' && (
              <>
                <Button variant="primary" icon="send" onClick={() => setActiveModal('sigsa')}>
                  Solicitar a SENASA
                </Button>
                <Button variant="secondary" onClick={() => setActiveModal('manual')}>
                  Carga manual
                </Button>
              </>
            )}

            {canWrite && (dte.status === 'EMITIDO' || dte.status === 'VIGENTE') && (
              <>
                {(isIssuer || isAdmin) && (
                  <Button variant="danger" icon="close" onClick={() => setActiveModal('void')}>
                    Anular DT-e
                  </Button>
                )}
                {(isDestination || isAdmin) && (
                  <>
                    <Button variant="primary" icon="check" onClick={() => setActiveModal('close')}>
                      Cerrar en sala
                    </Button>
                    <Button variant="secondary" icon="warning" onClick={() => setActiveModal('noArrival')}>
                      Declarar sin arribo
                    </Button>
                  </>
                )}
              </>
            )}

            {canWrite && (dte.status === 'VENCIDO' || dte.status === 'CADUCADO') && (isDestination || isAdmin) && (
              <Button variant="primary" icon="sync" onClick={() => setActiveModal('regularize')}>
                Regularizar arribo
              </Button>
            )}
          </div>
        }
      />

      <div className="row" style={{ alignItems: 'center', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
        <TransitSemaphoreBadge
          semaphore={dte.transitSemaphore}
          reason={dte.transitReasonText}
          size="lg"
          showReason
        />
        {dte.canTransit ? (
          <Pill tone="success" icon="checkCircle">
            Vehículo habilitado en ruta
          </Pill>
        ) : (
          <Pill tone="danger" icon="danger">
            Prohibido transitar
          </Pill>
        )}
      </div>

      <div className="grid-details">
        <Card title="Validez y Plazos" help="scheduledAt">
          <SummaryList
            rows={[
              { key: 'Fecha de carga autorizada', value: formatDay(dte.loadDate) },
              { key: 'Fecha de vencimiento', value: formatDay(dte.expiryDate) },
              { key: 'Modo de emisión', value: dte.issueMode ? (dte.issueMode === 'SIGSA' ? 'SENASA / SIGSA' : dte.issueMode === 'MANUAL' ? 'Carga manual' : 'Simulado') : '—' },
              { key: 'Emitido el', value: dte.issuedAt ? formatDateTime(dte.issuedAt) : 'Pendiente' },
              { key: 'Cerrado el', value: dte.closedAt ? formatDateTime(dte.closedAt) : 'No cerrado' },
            ]}
          />
        </Card>

        <Card title="Transporte y Código de Verificación" help="dteVerificationCode">
          <div className="stack" style={{ gap: 'var(--sp-3)' }}>
            <SummaryList
              rows={[
                { key: 'Tipo de transporte', value: dte.transportType ?? 'PROPIO' },
                { key: 'Patente chasis / vehículo', value: <span className="mono font-medium">{dte.transportPlate ?? 'Sin registrar'}</span> },
                { key: 'Patente acoplado / trailer', value: <span className="mono font-medium">{dte.transportTrailerPlate ?? 'Sin registrar'}</span> },
              ]}
            />

            <div
              style={{
                padding: 'var(--sp-3)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-subtle, rgba(0,0,0,0.03))',
                border: '1px dashed var(--border)',
              }}
            >
              <div className="small font-medium" style={{ marginBottom: 'var(--sp-1)' }}>
                Código de Verificación SENASA (para cierre en sala)
              </div>
              {dte.canSeeVerificationCode && dte.verificationCode ? (
                <div className="row row-tight" style={{ alignItems: 'center' }}>
                  <span className="mono" style={{ fontSize: '1.25rem', letterSpacing: '0.15em', fontWeight: 700, color: 'var(--brand)' }}>
                    {dte.verificationCode}
                  </span>
                  <Button size="sm" variant="ghost" onClick={copyCode} title="Copiar código">
                    Copiar
                  </Button>
                </div>
              ) : (
                <div className="stack small" style={{ gap: 4 }}>
                  <span className="mono muted">••••••••</span>
                  <span className="muted">
                    Enmascarado por seguridad: visible únicamente por el emisor y el receptor tras la emisión.
                  </span>
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card title="Cantidades y Trazabilidad">
          <SummaryList
            rows={[
              { key: 'Producto', value: `${dte.productName ?? 'Miel / Alzas'} (${dte.unit ?? 'ALZA'})` },
              { key: 'Cantidad estimada origen', value: `${dte.estimatedQuantity ?? '—'} ${dte.unit ?? 'ALZA'}` },
              {
                key: 'Cantidad declarada en DT-e (+15%)',
                value: (
                  <strong className="font-medium">
                    {dte.declaredQuantity ?? 0} {dte.unit ?? 'ALZA'}
                  </strong>
                ),
              },
              {
                key: 'Cantidad confirmada en sala',
                value: dte.confirmedQuantity !== null && dte.confirmedQuantity !== undefined ? (
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>
                    {dte.confirmedQuantity} {dte.unit ?? 'ALZA'}
                  </span>
                ) : (
                  <span className="muted">Pendiente de cierre</span>
                ),
              },
              { key: 'RENSPA de origen', value: <span className="mono">{dte.originRenspa ?? '—'}</span> },
              { key: 'RENSPA de destino', value: <span className="mono">{dte.destinationRenspa ?? '—'}</span> },
              {
                key: 'Movimiento amparado',
                value: (
                  <Link to={`/movements/${dte.movementId}`} className="font-medium">
                    Ver traslado asociado →
                  </Link>
                ),
              },
            ]}
          />
        </Card>

        <Card title="Bitácora de Estados y Auditoría Oficial">
          {dte.history && dte.history.length > 0 ? (
            <div className="timeline">
              {dte.history.map((h, i) => (
                <div key={h.id || i} className="timeline-item">
                  <div className="timeline-marker" />
                  <div className="timeline-content stack" style={{ gap: 2 }}>
                    <div className="row row-tight" style={{ alignItems: 'center' }}>
                      <StatusPill status={h.toStatus} />
                      <span className="small muted">
                        vía {h.source} • {formatDateTime(h.occurredAt)}
                      </span>
                    </div>
                    {h.reason && (
                      <div className="small" style={{ color: 'var(--text-1)' }}>
                        {h.reason}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="small muted">No hay transiciones registradas aún.</div>
          )}
        </Card>
      </div>

      {/* MODAL: EMISIÓN MANUAL */}
      {activeModal === 'manual' && (
        <Sheet
          title="Emisión manual de DT-e (Contingencia)"
          subtitle="Registrá el número oficial emitido en ventanilla o formulario de SENASA."
          onClose={() => setActiveModal(null)}
          narrow
        >
          <form onSubmit={handleIssueManual} className="stack">
            {actionError ? <ErrorNotice message={toUserMessage(actionError, 'write')} /> : null}
            <div className="field">
              <label className="field-label" htmlFor="manual-num">
                Número oficial DT-e *
              </label>
              <input
                id="manual-num"
                type="text"
                className="field-input mono"
                placeholder="Ej. DTE-2026-000123"
                value={manualNumber}
                onChange={(e) => setManualNumber(e.target.value)}
                required
                disabled={busy}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="manual-code">
                Código de verificación oficial (alfanumérico)
              </label>
              <input
                id="manual-code"
                type="text"
                className="field-input mono"
                placeholder="Ej. AB12CD34"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="form-actions">
              <Button variant="ghost" onClick={() => setActiveModal(null)} disabled={busy}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" busy={busy}>
                Emitir documento
              </Button>
            </div>
          </form>
        </Sheet>
      )}

      {/* MODAL: SOLICITAR SIGSA */}
      {activeModal === 'sigsa' && (
        <Sheet
          title="Solicitar DT-e oficial a SENASA"
          subtitle="Se enviará la solicitud al Web Service oficial de SIGSA / ARCA."
          onClose={() => setActiveModal(null)}
          narrow
        >
          <div className="stack">
            {actionError ? <ErrorNotice message={toUserMessage(actionError, 'write')} /> : null}
            <Notice tone="info">
              Al confirmar, el sistema interactuará con el organismo y asignará el número oficial y código de verificación al documento.
            </Notice>
            <div className="form-actions">
              <Button variant="ghost" onClick={() => setActiveModal(null)} disabled={busy}>
                Cancelar
              </Button>
              <Button variant="primary" busy={busy} onClick={handleRequestSigsa}>
                Confirmar y enviar
              </Button>
            </div>
          </div>
        </Sheet>
      )}

      {/* MODAL: ANULAR DT-E */}
      {activeModal === 'void' && (
        <Sheet
          title="Anular DT-e ante SENASA"
          subtitle="Solo permitido si el transporte no inició viaje o dentro de la ventana de anulación."
          onClose={() => setActiveModal(null)}
          narrow
        >
          <form onSubmit={handleVoidDte} className="stack">
            {actionError ? <ErrorNotice message={toUserMessage(actionError, 'write')} /> : null}
            <div className="field">
              <label className="field-label" htmlFor="void-reason">
                Motivo de anulación *
              </label>
              <textarea
                id="void-reason"
                className="field-input"
                rows={3}
                placeholder="Ej. Se canceló la cosecha por condiciones climáticas adversas."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                required
                disabled={busy}
              />
            </div>
            <div className="form-actions">
              <Button variant="ghost" onClick={() => setActiveModal(null)} disabled={busy}>
                Volver
              </Button>
              <Button type="submit" variant="danger" busy={busy}>
                Anular definitivamente
              </Button>
            </div>
          </form>
        </Sheet>
      )}

      {/* MODAL: CERRAR EN SALA */}
      {activeModal === 'close' && (
        <Sheet
          title="Cierre de DT-e en Sala de Extracción"
          subtitle="La sala certifica la llegada y recepción física de la carga."
          onClose={() => setActiveModal(null)}
          narrow
        >
          <form onSubmit={handleCloseDte} className="stack">
            {actionError ? <ErrorNotice message={toUserMessage(actionError, 'write')} /> : null}
            <div className="field">
              <label className="field-label" htmlFor="close-code">
                Código de verificación del DT-e *
              </label>
              <input
                id="close-code"
                type="text"
                className="field-input mono"
                placeholder="Código alfanumérico provisto por el transportista"
                value={closeCode}
                onChange={(e) => setCloseCode(e.target.value)}
                required
                disabled={busy}
              />
              <div className="field-hint">
                Debe coincidir con el código oficial asignado por SENASA.
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="close-qty">
                Cantidad recibida físicamente ({dte.unit ?? 'ALZA'}) *
              </label>
              <input
                id="close-qty"
                type="number"
                className="field-input"
                value={closeQty}
                onChange={(e) => setCloseQty(e.target.value)}
                max={Number(dte.declaredQuantity) || undefined}
                required
                disabled={busy}
              />
              <div className="field-hint">
                Regla SENASA: No puede superar los {dte.declaredQuantity ?? 0} {dte.unit ?? 'ALZA'} declarados.
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="close-notes">
                Observaciones de recepción (opcional)
              </label>
              <textarea
                id="close-notes"
                className="field-input"
                rows={2}
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                disabled={busy}
              />
            </div>

            <div className="form-actions">
              <Button variant="ghost" onClick={() => setActiveModal(null)} disabled={busy}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" busy={busy}>
                Cerrar DT-e y confirmar recepción
              </Button>
            </div>
          </form>
        </Sheet>
      )}

      {/* MODAL: DECLARAR SIN ARRIBO */}
      {activeModal === 'noArrival' && (
        <Sheet
          title="Declarar DT-e Sin Arribo"
          subtitle="Confirmación formal de que el transporte nunca se presentó en destino."
          onClose={() => setActiveModal(null)}
          narrow
        >
          <form onSubmit={handleNoArrival} className="stack">
            {actionError ? <ErrorNotice message={toUserMessage(actionError, 'write')} /> : null}
            <div className="field">
              <label className="field-label" htmlFor="no-arrival-reason">
                Motivo / Justificación *
              </label>
              <textarea
                id="no-arrival-reason"
                className="field-input"
                rows={3}
                placeholder="Ej. Expiró el plazo de tránsito y el transportista informó avería total o desvío."
                value={noArrivalReason}
                onChange={(e) => setNoArrivalReason(e.target.value)}
                required
                disabled={busy}
              />
            </div>
            <div className="form-actions">
              <Button variant="ghost" onClick={() => setActiveModal(null)} disabled={busy}>
                Cancelar
              </Button>
              <Button type="submit" variant="danger" busy={busy}>
                Confirmar Sin Arribo
              </Button>
            </div>
          </form>
        </Sheet>
      )}

      {/* MODAL: REGULARIZAR ARRIBO */}
      {activeModal === 'regularize' && (
        <Sheet
          title="Regularización de DT-e Vencido o Caducado"
          subtitle="Permite el ingreso extemporáneo justificado con asiento en auditoría."
          onClose={() => setActiveModal(null)}
          narrow
        >
          <form onSubmit={handleRegularize} className="stack">
            {actionError ? <ErrorNotice message={toUserMessage(actionError, 'write')} /> : null}
            <Notice tone="warning">
              Esta operación queda registrada de forma indeleble en la bitácora de auditoría oficial de SENASA.
            </Notice>
            <div className="field">
              <label className="field-label" htmlFor="reg-notes">
                Nota de justificación técnica *
              </label>
              <textarea
                id="reg-notes"
                className="field-input"
                rows={3}
                placeholder="Explicación del retraso (ej. corte de ruta, desperfecto mecánico certificado)."
                value={regNote}
                onChange={(e) => setRegNote(e.target.value)}
                required
                disabled={busy}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="reg-code">
                Código de verificación del DT-e
              </label>
              <input
                id="reg-code"
                type="text"
                className="field-input mono"
                value={closeCode}
                onChange={(e) => setCloseCode(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="reg-qty">
                Cantidad recibida físicamente ({dte.unit ?? 'ALZA'})
              </label>
              <input
                id="reg-qty"
                type="number"
                className="field-input"
                value={closeQty}
                onChange={(e) => setCloseQty(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="form-actions">
              <Button variant="ghost" onClick={() => setActiveModal(null)} disabled={busy}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" busy={busy}>
                Guardar regularización
              </Button>
            </div>
          </form>
        </Sheet>
      )}
    </div>
  );
};
