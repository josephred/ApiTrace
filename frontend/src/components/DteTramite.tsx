import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiSend, NetworkError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/useResource';
import { fieldErrors, toUserMessage } from '../lib/errors';
import { formatRelative } from '../lib/format';
import {
  DEFAULT_VALIDITY_DAYS,
  MAX_VALIDITY_DAYS,
  addDaysIso,
  daysBetweenIso,
  formatDay,
  loadDateShortcuts,
  todayAr,
  validityOptions,
} from '../lib/dte';
import {
  clearDteDraft,
  isMeaningfulDraft,
  loadDteDraft,
  loadRecentPicks,
  saveDteDraft,
  saveRecentPicks,
  type DteDraftContext,
  type RecentPicks,
} from '../lib/dteDraft';
import {
  CARGO,
  CARGO_TYPES,
  PLACES,
  PLACE_TYPES,
  describeQuantity,
  isApiSem,
  prettyPlate,
  vehicleTitle,
  type CargoType,
  type Place,
  type PlaceType,
  type Vehicle,
} from '../lib/cargo';
import { Icon } from './Icon';
import { CargoArt, PlaceGlyph } from './Illustrations';
import { AppBar } from './Screen';
import { VehicleCard } from './VehicleCard';
import { TransportForm } from './TransportForm';
import { SlideToConfirm } from './SlideToConfirm';
import { DteChecks } from './DteChecks';
import { DelegationGuide } from './DelegationGuide';
import { Button, HelpTip, Notice, useToast, useWriteFeedback } from './ui';
import type { Dte, DteIntegration, DtePreflight } from '../lib/types';

/**
 * «Nuevo Trámite DT-e» (doc 13): cinco pasos a pantalla completa, como en las
 * capturas de referencia, y una revisión final.
 *
 *   1. ¿Qué transportás?   alzas, colmenas, núcleos, tambor, frascos, reinas
 *   2. Transporte           un vehículo guardado (o uno nuevo, sin salir)
 *   3. Cantidad             contador grande con atajos
 *   4. ¿Desde dónde?        tipo de lugar y lugar de origen
 *   5. ¿Hasta dónde?        tipo de lugar y lugar de destino
 *   ·  Revisión             fecha, vigencia, lo que SIGSA revisa y el pedido
 *
 * Se conserva todo lo que ya funcionaba: borrador que se guarda solo y se
 * retoma desde el panel, deslizar para pedir el DT-e, verificación previa,
 * registro manual del número y reemisión sobre el mismo traslado. Alzas de un
 * apiario a una sala de extracción es el DT-e API-SEM y se pide a SIGSA; el
 * resto se guarda para emitirlo en SIGSA y registrar el número.
 */

const STEP_TITLES = ['¿Qué transportás?', 'Transporte', 'Cantidad', '¿Desde dónde?', '¿Hasta dónde?'];
const REVIEW = 5;
/** En la reemisión el traslado ya está definido: solo cambian el vehículo y la cantidad. */
const REISSUE_STEPS = [1, 2, REVIEW];

type Values = Record<string, string>;

export interface DteTramiteProps {
  integration: DteIntegration | null;
  /** Titulares que no pueden emitir por tener DT-e caducados. */
  blockedHolders?: { id: string; businessName: string }[];
  /** DT-e de reemplazo para un traslado existente. */
  reissue?: (DteDraftContext & { defaults?: Record<string, string> }) | null;
  onClose: () => void;
}

const initialValues = (today: string): Values => ({
  cargo: 'ALZAS',
  vehicleId: '',
  quantity: String(CARGO.ALZAS.initial),
  touchedQuantity: '',
  originType: CARGO.ALZAS.usualOrigin,
  originId: '',
  originKind: '',
  originName: '',
  destinationType: CARGO.ALZAS.usualDestination,
  destinationId: '',
  destinationKind: '',
  destinationName: '',
  loadDate: today,
  expiryDate: addDaysIso(today, DEFAULT_VALIDITY_DAYS),
  number: '',
  verificationCode: '',
});

export const DteTramite = ({ integration, blockedHolders = [], reissue = null, onClose }: DteTramiteProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const feedback = useWriteFeedback();
  const today = todayAr();

  const [values, setValues] = useState<Values>(() => initialValues(today));
  const [step, setStep] = useState(reissue ? 1 : 0);
  const [direction, setDirection] = useState<'forward' | 'back' | 'none'>('none');
  const [context, setContext] = useState<DteDraftContext | null>(reissue);
  const [ready, setReady] = useState(false);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [replacesOtherDraft, setReplacesOtherDraft] = useState(false);
  const [recent, setRecent] = useState<RecentPicks>({});
  const [stepError, setStepError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'draft' | 'request' | 'manual' | null>(null);
  const [failure, setFailure] = useState<{ title: string; detail?: string } | null>(null);
  const [preflight, setPreflight] = useState<DtePreflight | null>(null);
  const [checking, setChecking] = useState(false);
  const [offline, setOffline] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [addingVehicle, setAddingVehicle] = useState(false);
  const touched = useRef(false);
  const finished = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const cargo = (CARGO_TYPES as readonly string[]).includes(values.cargo) ? (values.cargo as CargoType) : 'ALZAS';
  const originType = values.originType as PlaceType;
  const destinationType = values.destinationType as PlaceType;
  const apiSem = context
    ? (context.cargoType ?? 'ALZAS') === 'ALZAS'
    : isApiSem(cargo, originType, destinationType) && values.destinationKind !== 'apiary';
  const canRequest = Boolean(integration?.capabilities.emit) && apiSem;
  const simulated = integration?.mode === 'simulado';

  const vehicles = useResource<Vehicle[]>('/vehicles');
  const vehicleList = vehicles.data ?? [];
  const selectedVehicle = vehicleList.find((vehicle) => vehicle.id === values.vehicleId) ?? null;

  /* ----------------------------------------------------------- cambios */

  const change = useCallback((patch: Values) => {
    touched.current = true;
    setValues((current) => ({ ...current, ...patch }));
    setStepError(null);
  }, []);

  /* --------------------------------------------- recuperar lo que quedó */

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const [draft, picks] = await Promise.all([loadDteDraft(user.id), loadRecentPicks(user.id)]);
      if (cancelled) return;
      setRecent(picks);
      const meaningful = draft ? isMeaningfulDraft(draft.values, draft.context) : false;
      const matches = reissue ? draft?.context?.movementId === reissue.movementId : true;
      if (draft && meaningful && matches) {
        setValues((current) => ({ ...current, ...draft.values, loadDate: draft.values.loadDate || today }));
        setContext(draft.context ?? reissue);
        const allowed = draft.context ? REISSUE_STEPS : [0, 1, 2, 3, 4, REVIEW];
        setStep(allowed.includes(draft.step) ? draft.step : allowed[0]);
        setRestoredAt(draft.savedAt);
      } else {
        if (draft && meaningful && reissue) setReplacesOtherDraft(true);
        if (reissue?.defaults) {
          setValues((current) => ({ ...current, ...reissue.defaults }));
        } else if (picks.cargo && (CARGO_TYPES as readonly string[]).includes(picks.cargo)) {
          const info = CARGO[picks.cargo as CargoType];
          setValues((current) => ({
            ...current,
            cargo: picks.cargo!,
            quantity: String(info.initial),
            originType: info.usualOrigin,
            destinationType: info.usualDestination,
          }));
        }
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------- guardar mientras avanza */

  useEffect(() => {
    if (!ready || !user || finished.current || !touched.current) return;
    if (!isMeaningfulDraft(values, context)) return;
    const timer = window.setTimeout(() => {
      void saveDteDraft({ userId: user.id, step, values, context });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [values, step, context, ready, user]);

  // Un solo vehículo guardado: ya queda elegido. En la reemisión, el de la patente anterior.
  useEffect(() => {
    if (!ready || values.vehicleId || vehicleList.length === 0) return;
    const byPlate = values.transportPlate
      ? vehicleList.find((vehicle) => vehicle.plate === values.transportPlate)
      : undefined;
    const pick = byPlate ?? (vehicleList.length === 1 ? vehicleList[0] : undefined) ??
      vehicleList.find((vehicle) => vehicle.id === recent.vehicleId);
    if (pick) setValues((current) => ({ ...current, vehicleId: pick.id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, vehicleList.length]);

  // Cada paso empieza arriba.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [step]);

  /* -------------------------------------------------------- navegación */

  const order = context ? REISSUE_STEPS : [0, 1, 2, 3, 4, REVIEW];

  const validateStep = (current: number): string | null => {
    switch (current) {
      case 0:
        return values.cargo ? null : 'Elegí qué transportás.';
      case 1:
        return values.vehicleId ? null : 'Elegí el vehículo o agregá uno nuevo.';
      case 2: {
        const quantity = Number(values.quantity);
        return Number.isInteger(quantity) && quantity >= 1
          ? null
          : `Indicá cuántas ${CARGO[cargo].plural} van.`;
      }
      case 3:
        return values.originId ? null : `Elegí ${PLACES[originType].article} ${PLACES[originType].noun} de origen.`;
      case 4:
        if (!values.destinationId) {
          return `Elegí ${PLACES[destinationType].article} ${PLACES[destinationType].noun} de destino.`;
        }
        return values.destinationId === values.originId ? 'El destino no puede ser el mismo lugar de origen.' : null;
      default:
        return null;
    }
  };

  const next = () => {
    const problem = validateStep(step);
    if (problem) {
      setStepError(problem);
      return;
    }
    const position = order.indexOf(step);
    if (position < order.length - 1) {
      touched.current = true;
      setDirection('forward');
      setStep(order[position + 1]);
    }
  };

  const back = () => {
    const position = order.indexOf(step);
    if (position <= 0) {
      close();
      return;
    }
    setDirection('back');
    setStepError(null);
    setStep(order[position - 1]);
  };

  const goTo = (target: number) => {
    if (!order.includes(target)) return;
    setDirection('back');
    setStepError(null);
    setStep(target);
  };

  const close = () => {
    if (user && !finished.current && touched.current && isMeaningfulDraft(values, context)) {
      void saveDteDraft({ userId: user.id, step, values, context });
      toast({
        tone: 'info',
        title: 'Guardamos el trámite a medio armar',
        detail: 'Lo retomás desde Inicio o desde DT-e, aunque cierres la app.',
      });
    }
    onClose();
  };

  const startOver = async () => {
    if (user) await clearDteDraft(user.id);
    touched.current = false;
    setRestoredAt(null);
    setContext(reissue);
    setValues({ ...initialValues(today), ...(reissue?.defaults ?? {}) });
    setErrors({});
    setDirection('back');
    setStep(reissue ? 1 : 0);
  };

  /* ------------------------------------------------------------- cuerpo */

  const body = (extra: Record<string, unknown> = {}) => ({
    ...(context
      ? { movementId: context.movementId }
      : {
          cargoType: cargo,
          ...(values.originKind === 'apiary' ? { apiaryId: values.originId } : { originEstablishmentId: values.originId }),
          ...(values.destinationKind === 'apiary'
            ? { destinationApiaryId: values.destinationId }
            : { destinationEstablishmentId: values.destinationId }),
        }),
    declaredQuantity: Number(values.quantity),
    loadDate: values.loadDate,
    ...(apiSem ? { expiryDate: values.expiryDate } : {}),
    ...(values.vehicleId ? { vehicleId: values.vehicleId } : {}),
    ...extra,
  });

  // La verificación corre al llegar a la revisión y cuando cambia la fecha.
  useEffect(() => {
    if (step !== REVIEW || !ready) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setChecking(true);
      setOffline(false);
      apiSend<DtePreflight>('POST', '/dte/preflight', body(), {
        label: 'Verificación de DT-e',
        entity: '/dte',
        queueOffline: false,
      })
        .then((result) => {
          if (!cancelled && !result.queued) setPreflight(result.data);
        })
        .catch((cause: unknown) => {
          if (cancelled) return;
          setPreflight(null);
          if (cause instanceof NetworkError) setOffline(true);
          else {
            const message = toUserMessage(cause, 'read');
            setFailure({ title: message.title, detail: message.detail });
          }
        })
        .finally(() => {
          if (!cancelled) setChecking(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, ready, values.loadDate, values.expiryDate]);

  /* -------------------------------------------------------------- envío */

  const send = async (kind: 'draft' | 'request' | 'manual') => {
    for (const target of order.filter((item) => item !== REVIEW)) {
      const problem = validateStep(target);
      if (problem) {
        setDirection('back');
        setStep(target);
        setStepError(problem);
        return;
      }
    }
    if (kind === 'manual' && !values.number.trim()) {
      setErrors((current) => ({ ...current, number: 'Completá el número que figura en el DT-e.' }));
      return;
    }
    setBusy(kind);
    setFailure(null);
    try {
      const extra =
        kind === 'request'
          ? { submit: true }
          : kind === 'manual'
            ? {
                number: values.number.trim(),
                ...(values.verificationCode.trim() ? { verificationCode: values.verificationCode.trim() } : {}),
              }
            : {};
      const result = await apiSend<Dte>('POST', '/dte', body(extra), {
        label: `DT-e: ${describeQuantity(cargo, Number(values.quantity))} (${formatDay(values.loadDate)})`,
        entity: '/dte',
      });

      finished.current = true;
      if (user) {
        await clearDteDraft(user.id);
        await saveRecentPicks(user.id, {
          ...recent,
          cargo,
          vehicleId: values.vehicleId,
          ...(context ? {} : { originId: values.originId, destinationId: values.destinationId }),
        });
      }

      if (result.queued) {
        feedback.queued('El trámite');
        onClose();
        return;
      }
      feedback.saved(
        kind === 'request'
          ? simulated
            ? 'Emisión simulada solicitada'
            : 'Pedido enviado a SIGSA'
          : kind === 'manual'
            ? `DT-e ${result.data.number} registrado`
            : apiSem
              ? 'Borrador guardado'
              : 'Trámite guardado',
        kind === 'request'
          ? 'El número y el código de cierre llegan en unos segundos.'
          : !apiSem && kind === 'draft'
            ? 'Emitilo en SIGSA y registrá el número desde el DT-e.'
            : undefined,
      );
      navigate(`/dte/${result.data.id}`, { replace: true });
    } catch (cause) {
      const perField = fieldErrors(cause, ['number', 'verificationCode', 'declaredQuantity', 'loadDate', 'expiryDate']);
      if (Object.keys(perField).length > 0) {
        setErrors((current) => ({ ...current, ...perField }));
        if (perField.declaredQuantity) {
          setDirection('back');
          setStep(2);
          setStepError(perField.declaredQuantity);
        }
      } else {
        const message = toUserMessage(cause, 'write');
        setFailure({ title: message.title, detail: message.detail });
      }
    } finally {
      setBusy(null);
    }
  };

  /* ------------------------------------------------------------ pantalla */

  const title = context ? 'Otro DT-e para el mismo traslado' : 'Nuevo Trámite DT-e';
  const stepClass =
    direction === 'forward' ? 'tramite-step from-right' : direction === 'back' ? 'tramite-step from-left' : 'tramite-step';

  return (
    <div className="tramite">
      <AppBar title={title} close onBack={close} />
      <Stepper step={step} locked={context ? [0, 3, 4] : []} />

      <div className="tramite-body" ref={bodyRef}>
        {restoredAt && (
          <div className="restored">
            <Icon name="clock" size={16} />
            <span className="grow small">Seguís donde lo dejaste, guardado {formatRelative(restoredAt)}.</span>
            <Button size="sm" variant="ghost" onClick={() => void startOver()}>
              Empezar de cero
            </Button>
          </div>
        )}
        {replacesOtherDraft && (
          <Notice tone="warning" title="Tenías otro trámite a medio armar">
            Si seguís con este, el otro borrador se reemplaza.
          </Notice>
        )}
        {context && step === 1 && (
          <div className="reissue-card">
            <div className="small muted">Mismo traslado {context.movementCode}</div>
            <RouteSummary origin={context.origin} destination={context.destination} />
            {context.replaces && (
              <div className="small muted">
                Reemplaza al DT-e <span className="mono">{context.replaces}</span>
                {context.reason ? `, dado de baja por: ${context.reason}` : '.'}
              </div>
            )}
          </div>
        )}

        <div key={step} className={stepClass}>
          {step === 0 && (
            <CargoStep
              value={cargo}
              recent={recent.cargo}
              onChange={(next) => {
                const info = CARGO[next];
                change({
                  cargo: next,
                  quantity: values.touchedQuantity ? values.quantity : String(info.initial),
                  // Si todavía no eligió lugares, se proponen los habituales para esta carga.
                  ...(values.originId ? {} : { originType: info.usualOrigin }),
                  ...(values.destinationId ? {} : { destinationType: info.usualDestination }),
                });
              }}
            />
          )}
          {step === 1 && (
            <VehicleStep
              vehicles={vehicleList}
              loading={vehicles.loading}
              value={values.vehicleId}
              onChange={(vehicleId) => change({ vehicleId })}
              onAdd={() => setAddingVehicle(true)}
            />
          )}
          {step === 2 && (
            <QuantityStep
              cargo={cargo}
              value={values.quantity}
              onChange={(quantity) => change({ quantity, touchedQuantity: '1' })}
            />
          )}
          {step === 3 && (
            <PlaceStep
              side="origin"
              type={originType}
              value={values.originId}
              recentId={recent.originId}
              onType={(type) =>
                change({ originType: type, originId: '', originKind: '', originName: '' })
              }
              onPick={(place) =>
                change({ originId: place.id, originKind: place.kind, originName: place.name })
              }
              onCreate={(path) => navigate(`${path}?volver=/dte/nuevo`)}
            />
          )}
          {step === 4 && (
            <PlaceStep
              side="destination"
              type={destinationType}
              value={values.destinationId}
              excludeId={values.originId}
              recentId={recent.destinationId}
              onType={(type) =>
                change({ destinationType: type, destinationId: '', destinationKind: '', destinationName: '' })
              }
              onPick={(place) =>
                change({ destinationId: place.id, destinationKind: place.kind, destinationName: place.name })
              }
              onCreate={(path) => navigate(`${path}?volver=/dte/nuevo`)}
            />
          )}
          {step === REVIEW && (
            <ReviewStep
              cargo={context ? ((context.cargoType as CargoType | null) ?? 'ALZAS') : cargo}
              quantity={Number(values.quantity)}
              origin={context ? context.origin : values.originName}
              destination={context ? context.destination : values.destinationName}
              vehicle={selectedVehicle}
              values={values}
              errors={errors}
              apiSem={apiSem}
              today={today}
              onChange={change}
              onEdit={goTo}
              reissue={Boolean(context)}
            >
              {blockedHolders.length > 0 && apiSem && (
                <Notice tone="danger" title="SIGSA no deja emitir nuevos DT-e">
                  {blockedHolders.map((holder) => holder.businessName).join(', ')}: hay DT-e caducados. Podés
                  guardar el borrador, pero para pedirlo hay que regularizar ante SENASA.
                </Notice>
              )}
              {failure && (
                <Notice tone="danger" title={failure.title}>
                  {failure.detail}
                </Notice>
              )}

              <div className="review-section-title">
                <span>{apiSem ? 'Lo que SIGSA va a revisar' : 'Antes de guardar'}</span>
                <HelpTip topic="dte" />
              </div>
              {checking && (
                <p className="row row-tight small muted">
                  <span className="spinner" aria-hidden="true" />
                  Verificando…
                </p>
              )}
              {offline && (
                <Notice tone="warning" title="Sin conexión">
                  No se pudo verificar. Guardá el trámite: se envía al volver la señal y lo verificás antes de
                  emitir.
                </Notice>
              )}
              {preflight && <DteChecks checks={preflight.checks} collapseOk />}
              {preflight?.checks.some((check) => check.code === 'DELEGACION' && check.status !== 'ok') && (
                <Button size="sm" icon="shield" onClick={() => setGuideOpen(true)}>
                  Cómo delegar SIGSA en ARCA
                </Button>
              )}

              <div className="emit-zone">
                {canRequest ? (
                  <>
                    <SlideToConfirm
                      label={simulated ? 'Deslizá para simular la emisión' : 'Deslizá para pedir el DT-e'}
                      busyLabel="Enviando a SIGSA…"
                      busy={busy === 'request'}
                      disabled={!preflight?.ok || Boolean(busy && busy !== 'request')}
                      disabledReason={
                        checking
                          ? 'Esperando la verificación…'
                          : offline
                            ? 'Sin conexión no se puede pedir: guardá el borrador.'
                            : 'Resolvé lo marcado en rojo para poder pedirlo.'
                      }
                      onConfirm={() => send('request')}
                    />
                    <Button
                      variant="secondary"
                      block
                      busy={busy === 'draft'}
                      busyLabel="Guardando…"
                      disabled={Boolean(busy)}
                      onClick={() => void send('draft')}
                    >
                      Guardar borrador sin pedir
                    </Button>
                  </>
                ) : (
                  <>
                    {!apiSem && (
                      <Notice tone="info" title="Este trámite se emite en SIGSA">
                        Guardalo acá, emitilo en SIGSA (web u oficina local) y registrá el número desde el
                        DT-e. ApiTrace pide por API solo el DT-e de alzas de un apiario a una sala de
                        extracción.
                      </Notice>
                    )}
                    <button
                      type="button"
                      className="submit-big submit-big-amber"
                      disabled={Boolean(busy)}
                      aria-busy={busy === 'draft' || undefined}
                      onClick={() => void send('draft')}
                    >
                      {busy === 'draft' ? (
                        <>
                          <span className="spinner" aria-hidden="true" />
                          Guardando…
                        </>
                      ) : apiSem ? (
                        'Guardar borrador'
                      ) : (
                        'Guardar trámite'
                      )}
                    </button>
                  </>
                )}

                <details className="more-data">
                  <summary>Ya lo emití en SIGSA: registrar número y código</summary>
                  <div className="manual-fields">
                    <label className="field">
                      <span className="field-label">Número de DT-e</span>
                      <input
                        value={values.number}
                        placeholder="022440451-4"
                        onChange={(event) => change({ number: event.target.value })}
                        aria-invalid={errors.number ? true : undefined}
                        autoComplete="off"
                      />
                      {errors.number && <span className="field-error">{errors.number}</span>}
                    </label>
                    <label className="field">
                      <span className="field-label">Código de cierre</span>
                      <input
                        value={values.verificationCode}
                        placeholder="790112"
                        onChange={(event) => change({ verificationCode: event.target.value })}
                        autoComplete="off"
                        inputMode="numeric"
                      />
                    </label>
                    <Button
                      variant="secondary"
                      icon="check"
                      busy={busy === 'manual'}
                      busyLabel="Registrando…"
                      disabled={Boolean(busy)}
                      onClick={() => void send('manual')}
                    >
                      Registrar DT-e emitido
                    </Button>
                  </div>
                </details>
              </div>
            </ReviewStep>
          )}
        </div>

        {stepError && (
          <p className="step-error" role="alert">
            <Icon name="danger" size={16} />
            {stepError}
          </p>
        )}
      </div>

      <footer className={step === REVIEW ? 'tramite-actions review' : 'tramite-actions'}>
        {order.indexOf(step) > 0 && (
          <button type="button" className="btn-back" onClick={back} disabled={Boolean(busy)}>
            <Icon name="arrowLeft" size={20} strokeWidth={2.2} />
            Atrás
          </button>
        )}
        {step !== REVIEW && (
          <button type="button" className="btn-next" onClick={next}>
            {order.indexOf(step) === order.length - 2 ? 'Revisar' : 'Siguiente'}
            <Icon name="arrowRight" size={20} strokeWidth={2.2} />
          </button>
        )}
      </footer>

      {addingVehicle && (
        <div className="overlay-screen theme-sky" role="dialog" aria-modal="true" aria-label="Nuevo Transporte">
          <AppBar title="Nuevo Transporte" onBack={() => setAddingVehicle(false)} />
          <TransportForm
            onSaved={(vehicle) => {
              setAddingVehicle(false);
              vehicles.reload();
              if (vehicle) change({ vehicleId: vehicle.id });
            }}
          />
        </div>
      )}
      {guideOpen && <DelegationGuide onClose={() => setGuideOpen(false)} />}
    </div>
  );
};

/* =========================================================================
   Franja de pasos
   ========================================================================= */

const Stepper = ({ step, locked }: { step: number; locked: number[] }) => (
  <div className="tramite-band">
    <div className="sr-only" aria-live="polite">
      {step === REVIEW ? 'Revisión final' : `Paso ${step + 1} de 5: ${STEP_TITLES[step]}`}
    </div>
    <ol className="tramite-steps" aria-hidden="true">
      {STEP_TITLES.map((name, index) => {
        const done = index < step || step === REVIEW || locked.includes(index);
        const current = index === step;
        return (
          <li key={name} className={done && !current ? 'done' : current ? 'current' : 'todo'}>
            <span className="tramite-dot">
              {done && !current ? <Icon name="check" size={16} strokeWidth={3.2} /> : index + 1}
            </span>
          </li>
        );
      })}
    </ol>
  </div>
);

const StepHead = ({ number, title, sub }: { number: number; title: string; sub: string }) => (
  <div className="step-head">
    <h2>
      Paso {number}: {title}
    </h2>
    <p>{sub}</p>
  </div>
);

/* =========================================================================
   Paso 1: ¿Qué transportás?
   ========================================================================= */

const CargoStep = ({
  value,
  recent,
  onChange,
}: {
  value: CargoType;
  recent?: string;
  onChange: (cargo: CargoType) => void;
}) => (
  <>
    <StepHead number={1} title="¿Qué transportás?" sub="Seleccioná el tipo de elemento a transportar." />
    <div className="cargo-grid" role="radiogroup" aria-label="Qué transportás">
      {CARGO_TYPES.map((item) => (
        <button
          key={item}
          type="button"
          role="radio"
          aria-checked={value === item}
          className={value === item ? 'cargo-card selected' : 'cargo-card'}
          onClick={() => onChange(item)}
        >
          <span className={value === item ? 'radio-mark checked' : 'radio-mark'} aria-hidden="true">
            {value === item && <Icon name="check" size={18} strokeWidth={3} />}
          </span>
          <span className="cargo-card-art">
            <CargoArt cargo={item} />
          </span>
          <span className="cargo-card-label">{CARGO[item].label}</span>
          {recent === item && value !== item && <span className="recent-tag">La última vez</span>}
        </button>
      ))}
    </div>
  </>
);

/* =========================================================================
   Paso 2: Transporte
   ========================================================================= */

const VehicleStep = ({
  vehicles,
  loading,
  value,
  onChange,
  onAdd,
}: {
  vehicles: Vehicle[];
  loading: boolean;
  value: string;
  onChange: (vehicleId: string) => void;
  onAdd: () => void;
}) => (
  <>
    <StepHead number={2} title="Transporte" sub="Seleccioná el vehículo que realizará el traslado." />
    <div className="list-label">Vehículos guardados</div>
    {loading && vehicles.length === 0 && <p className="small muted">Cargando tus vehículos…</p>}
    {!loading && vehicles.length === 0 && (
      <p className="small muted">Todavía no guardaste vehículos. Agregá el primero: queda para la próxima.</p>
    )}
    <div className="vehicle-list" role="radiogroup" aria-label="Vehículos guardados">
      {vehicles.map((vehicle) => (
        <VehicleCard key={vehicle.id} vehicle={vehicle} selected={value === vehicle.id} onClick={() => onChange(vehicle.id)} />
      ))}
    </div>
    <button type="button" className="add-card" onClick={onAdd}>
      <span className="add-card-icon" aria-hidden="true">
        <Icon name="plus" size={22} strokeWidth={2.6} />
      </span>
      Agregar nuevo transporte
    </button>
  </>
);

/* =========================================================================
   Paso 3: Cantidad
   ========================================================================= */

const QuantityStep = ({
  cargo,
  value,
  onChange,
}: {
  cargo: CargoType;
  value: string;
  onChange: (value: string) => void;
}) => {
  const info = CARGO[cargo];
  const number = Number(value) || 0;
  const set = (next: number) => onChange(String(Math.max(0, Math.min(100000, Math.round(next)))));
  return (
    <>
      <StepHead number={3} title="Cantidad" sub={`Indicá la cantidad de ${info.label} a transportar.`} />
      <div className="big-counter">
        <button type="button" className="big-step" onClick={() => set(number - 1)} disabled={number <= 0} aria-label="Una menos">
          <Icon name="minus" size={30} strokeWidth={2.2} />
        </button>
        <label className="big-value">
          <span className="sr-only">Cantidad de {info.plural}</span>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={value}
            onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
            onFocus={(event) => event.target.select()}
          />
        </label>
        <button type="button" className="big-step plus" onClick={() => set(number + 1)} aria-label="Una más">
          <Icon name="plus" size={30} strokeWidth={2.2} />
        </button>
      </div>
      <div className="big-unit">{info.label}</div>
      <div className="preset-row" role="group" aria-label="Cantidades habituales">
        {info.presets.map((preset) => (
          <button
            key={preset}
            type="button"
            className={number === preset ? 'preset selected' : 'preset'}
            aria-pressed={number === preset}
            onClick={() => set(preset)}
          >
            {preset}
          </button>
        ))}
      </div>
      <div className="soft-divider" aria-hidden="true" />
      <div className="info-note">
        <span className="info-note-icon" aria-hidden="true">
          <Icon name="info" size={20} strokeWidth={2.4} />
        </span>
        <p>
          {cargo === 'ALZAS' ? (
            <>
              Podés declarar una cantidad aproximada. La sala de extracción rectificará la cantidad real al
              ingresar. Si dudás, declará de más: la sala no puede confirmar más de lo declarado.
            </>
          ) : (
            <>Indicá cuántas {info.plural} salen en este traslado. Quien recibe confirma la cantidad al llegar.</>
          )}
        </p>
      </div>
    </>
  );
};

/* =========================================================================
   Pasos 4 y 5: ¿Desde dónde? ¿Hasta dónde?
   ========================================================================= */

/** Dónde se registra cada tipo de lugar que falta. */
const CREATE_PATH: Partial<Record<PlaceType, string>> = {
  APIARIO: '/apiaries/nuevo',
  FINCA_POLINIZACION: '/establishments?type=FINCA_POLINIZACION',
  SALA_EXTRACCION: '/salas/extraccion/nueva',
  SALA_FRACCIONAMIENTO: '/salas/fraccionamiento/nueva',
};

const PlaceStep = ({
  side,
  type,
  value,
  excludeId,
  recentId,
  onType,
  onPick,
  onCreate,
}: {
  side: 'origin' | 'destination';
  type: PlaceType;
  value: string;
  excludeId?: string;
  recentId?: string;
  onType: (type: PlaceType) => void;
  onPick: (place: Place) => void;
  onCreate: (path: string) => void;
}) => {
  const [query, setQuery] = useState('');
  const places = useResource<Place[]>(`/places?side=${side}&type=${type}`);
  const info = PLACES[type];

  const options = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = (places.data ?? []).filter((place) => place.id !== excludeId);
    const filtered = term
      ? list.filter((place) =>
          [place.name, place.code, place.zoneName, place.locality, place.organizationName]
            .filter(Boolean)
            .some((text) => String(text).toLowerCase().includes(term)),
        )
      : list;
    // Lo último elegido, primero.
    return [...filtered].sort((a, b) => (a.id === recentId ? -1 : b.id === recentId ? 1 : 0));
  }, [places.data, query, excludeId, recentId]);

  // Una sola opción: ya queda elegida.
  useEffect(() => {
    if (!value && !query && options.length === 1) onPick(options[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length, type]);

  const heading = side === 'origin' ? '¿Desde dónde?' : '¿Hasta dónde?';
  const createPath = side === 'origin' || type === 'APIARIO' ? CREATE_PATH[type] : undefined;

  return (
    <>
      <StepHead
        number={side === 'origin' ? 4 : 5}
        title={heading}
        sub={`Seleccioná el tipo de ${side === 'origin' ? 'origen' : 'destino'}.`}
      />
      <div className="place-types" role="radiogroup" aria-label={`Tipo de ${side === 'origin' ? 'origen' : 'destino'}`}>
        {PLACE_TYPES.map((item) => (
          <button
            key={item}
            type="button"
            role="radio"
            aria-checked={type === item}
            className={type === item ? 'place-type selected' : 'place-type'}
            onClick={() => {
              setQuery('');
              onType(item);
            }}
          >
            <PlaceGlyph type={item} size={30} />
            <span>{PLACES[item].tile}</span>
          </button>
        ))}
      </div>

      <div className="list-label">
        Seleccioná {info.article} {info.noun} de {side === 'origin' ? 'origen' : 'destino'}
      </div>
      <div className="search-field">
        <Icon name="search" size={20} />
        <input
          type="search"
          placeholder={info.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={info.search.replace('…', '')}
        />
      </div>

      {places.loading && !places.data && <p className="small muted">Cargando…</p>}
      {!places.loading && options.length === 0 && (
        <div className="place-empty">
          <p className="small muted">
            {query
              ? 'No hay coincidencias con esa búsqueda.'
              : side === 'origin'
                ? `No tenés ${info.noun === 'apiario' ? 'apiarios' : `${info.noun}s`} registrados.`
                : `No hay ${info.noun === 'apiario' ? 'apiarios' : `${info.noun}s`} registrados como destino.`}
          </p>
          {!query && createPath && (
            <Button size="sm" icon="plus" onClick={() => onCreate(createPath)}>
              Registrar {info.noun}
            </Button>
          )}
        </div>
      )}

      <ul className="place-list" role="radiogroup" aria-label={`${info.noun} de ${side === 'origin' ? 'origen' : 'destino'}`}>
        {options.map((place) => {
          const selected = value === place.id;
          return (
            <li key={place.id}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                className={selected ? 'place-row selected' : 'place-row'}
                onClick={() => onPick(place)}
              >
                <span className="place-row-glyph">
                  <PlaceGlyph type={place.placeType === 'APIARIO' ? 'APIARIO' : place.placeType === 'SALA_EXTRACCION' || place.placeType === 'SALA_FRACCIONAMIENTO' ? 'STORE' : place.placeType} size={30} />
                </span>
                <span className="place-row-text">
                  <span className="place-row-title">{place.name}</span>
                  <span className="place-row-sub">
                    {place.code
                      ? place.codeLabel === 'Habilitacion'
                        ? `Habilitación: ${place.code}`
                        : place.codeLabel === 'RNE'
                          ? `RNE: ${place.code}`
                          : place.code
                      : place.internalCode ?? place.locality ?? ''}
                    {!place.own && place.organizationName ? ` · ${place.organizationName}` : ''}
                  </span>
                  {place.warning && <span className="place-row-warning">{place.warning}</span>}
                  {place.id === recentId && <span className="recent-tag">La última vez</span>}
                </span>
                <span className={selected ? 'radio-mark checked' : 'radio-mark'} aria-hidden="true">
                  {selected && <Icon name="check" size={18} strokeWidth={3} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
};

/* =========================================================================
   Revisión
   ========================================================================= */

// RouteLine se usa también en el detalle del DT-e.
export { RouteSummary as RouteLine };

/** Origen y destino unidos por una línea: el traslado en una imagen. */
export const RouteSummary = ({ origin, destination }: { origin: string; destination: string }) => (
  <ol className="route-line">
    <li>
      <span className="route-dot" aria-hidden="true">
        <Icon name="hive" size={14} />
      </span>
      <span>
        <span className="route-key">Sale de</span>
        <span className="route-value">{origin || '—'}</span>
      </span>
    </li>
    <li>
      <span className="route-dot" aria-hidden="true">
        <Icon name="establishments" size={14} />
      </span>
      <span>
        <span className="route-key">Llega a</span>
        <span className="route-value">{destination || '—'}</span>
      </span>
    </li>
  </ol>
);

const ReviewStep = ({
  cargo,
  quantity,
  origin,
  destination,
  vehicle,
  values,
  errors,
  apiSem,
  today,
  onChange,
  onEdit,
  reissue,
  children,
}: {
  cargo: CargoType;
  quantity: number;
  origin: string;
  destination: string;
  vehicle: Vehicle | null;
  values: Values;
  errors: Record<string, string>;
  apiSem: boolean;
  today: string;
  onChange: (patch: Values) => void;
  onEdit: (step: number) => void;
  reissue: boolean;
  children: ReactNode;
}) => {
  const validity =
    values.loadDate && values.expiryDate ? daysBetweenIso(values.loadDate, values.expiryDate) : DEFAULT_VALIDITY_DAYS;

  const setLoadDate = (loadDate: string) => {
    const keep = validity >= DEFAULT_VALIDITY_DAYS && validity <= MAX_VALIDITY_DAYS ? validity : DEFAULT_VALIDITY_DAYS;
    onChange({ loadDate, expiryDate: loadDate ? addDaysIso(loadDate, keep) : '' });
  };

  return (
    <>
      <div className="step-head">
        <h2>{apiSem ? 'Revisá y pedí el DT-e' : 'Revisá y guardá el trámite'}</h2>
        <p>{apiSem ? 'DT-e API-SEM: alzas melarias del apiario a la sala de extracción.' : 'Traslado que se emite en SIGSA y se registra en ApiTrace.'}</p>
      </div>

      <div className="review-card">
        <div className="review-cargo">
          <span className="review-cargo-art">
            <CargoArt cargo={cargo} />
          </span>
          <span className="review-cargo-text">
            <span className="review-big">{quantity}</span>
            <span>{CARGO[cargo].label}</span>
          </span>
          <button type="button" className="link-button" onClick={() => onEdit(2)}>
            Cambiar
          </button>
        </div>
        <div className="review-route">
          <RouteSummary origin={origin} destination={destination} />
          {!reissue && (
            <button type="button" className="link-button" onClick={() => onEdit(3)}>
              Cambiar
            </button>
          )}
        </div>
        <div className="review-vehicle">
          <span className="review-label">Transporte</span>
          {vehicle ? (
            <span>
              <strong>{vehicleTitle(vehicle)}</strong> · <span className="mono">{prettyPlate(vehicle.plate)}</span>
              {vehicle.trailerPlate && (
                <>
                  {' '}
                  + carro <span className="mono">{prettyPlate(vehicle.trailerPlate)}</span>
                </>
              )}
              {vehicle.driverName && <span className="muted"> · {vehicle.driverName}</span>}
            </span>
          ) : (
            <span className="faint">Sin vehículo</span>
          )}
          <button type="button" className="link-button" onClick={() => onEdit(1)}>
            Cambiar
          </button>
        </div>
      </div>

      <div className="review-field">
        <div className="review-section-title">
          <span>{apiSem ? '¿Cuándo cargás?' : '¿Cuándo sale?'}</span>
          <HelpTip topic="scheduledAt" />
        </div>
        <div className="preset-row wrap" role="group" aria-label="Fecha de carga">
          {loadDateShortcuts(today).map((option) => (
            <button
              key={option.value}
              type="button"
              className={values.loadDate === option.value ? 'preset selected' : 'preset'}
              aria-pressed={values.loadDate === option.value}
              onClick={() => setLoadDate(option.value)}
            >
              {option.label}
            </button>
          ))}
          <label className="date-chip">
            <span className="sr-only">Otra fecha</span>
            <input type="date" value={values.loadDate} min={today} onChange={(event) => setLoadDate(event.target.value)} />
          </label>
        </div>
        {errors.loadDate && <span className="field-error">{errors.loadDate}</span>}
      </div>

      {apiSem && (
        <div className="review-field">
          <div className="review-section-title">
            <span>Días de vigencia</span>
            <HelpTip topic="dteValidity" />
          </div>
          <div className="preset-row" role="group" aria-label="Días de vigencia">
            {validityOptions().map((days) => (
              <button
                key={days}
                type="button"
                className={validity === days ? 'preset selected' : 'preset'}
                aria-pressed={validity === days}
                onClick={() => onChange({ expiryDate: addDaysIso(values.loadDate || today, days) })}
              >
                {days} días
              </button>
            ))}
          </div>
          <span className="field-hint">
            Transita desde el {formatDay(values.loadDate)} a las 00:00 hasta el {formatDay(values.expiryDate)} a las
            23:59.
          </span>
          {errors.expiryDate && <span className="field-error">{errors.expiryDate}</span>}
        </div>
      )}

      {children}
    </>
  );
};
