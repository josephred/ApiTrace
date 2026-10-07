import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiSend, NetworkError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { usePreferences } from '../lib/settingsContext';
import { useResource } from '../lib/useResource';
import { fieldErrors, toUserMessage } from '../lib/errors';
import { formatRelative } from '../lib/format';
import {
  DEFAULT_VALIDITY_DAYS,
  MAX_VALIDITY_DAYS,
  OVERESTIMATION_FACTOR,
  addDaysIso,
  daysBetweenIso,
  formatDay,
  loadDateShortcuts,
  normalizePlate,
  suggestDeclared,
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
import { TRANSPORT_TYPES } from '../lib/vocabulary';
import { Icon } from './Icon';
import { Button, ButtonLink, Notice, Sheet, StatusPill, useToast, useWriteFeedback } from './ui';
import { Disclosure, Field, FormError, Steps, WizardActions, useForm, type FieldSpec } from './Form';
import { Chips, PickCards, QuantityStepper, type PickOption } from './Pickers';
import { SlideToConfirm } from './SlideToConfirm';
import { DteChecks } from './DteChecks';
import { DelegationGuide } from './DelegationGuide';
import type { Apiary, Dte, DteIntegration, DtePreflight, Paginated, Receiver } from '../lib/types';

/**
 * Asistente del DT-e API-SEM.
 *
 * Reúne lo mejor de los dos prototipos:
 *
 *  - de ApiTrace, las reglas: verificación previa contra lo que revisa SIGSA,
 *    declarar de más y nunca de menos, vigencia de 2 a 4 días, canal de
 *    emisión honesto (manual, simulado o SIGSA) y la cola sin conexión;
 *  - de ApiAsistente, la forma: una pregunta por paso, tarjetas grandes para
 *    elegir apiario y sala (la última usada primero), contador de alzas con
 *    atajos, borrador que se guarda solo y se retoma desde el panel, y
 *    deslizar para pedir el DT-e.
 *
 * También emite el DT-e de reemplazo de un traslado cuyo DT-e se anuló (el
 * «resolver conflicto» de ApiAsistente): en ese caso origen y destino quedan
 * fijos, porque son los del movimiento.
 */

const STEP_NAMES = ['Origen y destino', 'Alzas y fechas', 'Transporte', 'Verificar y emitir'];
const QUANTITY_PRESETS = [10, 20, 30, 40, 60];
const PLATE = /^[A-Za-z0-9 .-]{2,15}$/;

export interface DteWizardProps {
  integration: DteIntegration | null;
  /** Titulares que no pueden emitir por tener DT-e caducados. */
  blockedHolders?: { id: string; businessName: string }[];
  /** DT-e de reemplazo para un traslado existente. */
  reissue?: (DteDraftContext & { defaults?: Record<string, string> }) | null;
  onClose: () => void;
  onDone: () => void;
}

export const DteWizard = ({
  integration,
  blockedHolders = [],
  reissue = null,
  onClose,
  onDone,
}: DteWizardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const feedback = useWriteFeedback();
  const { preferences, updatePreferences } = usePreferences();

  const [step, setStep] = useState(0);
  // Sin animación al abrir: la hoja ya entra con la suya.
  const [direction, setDirection] = useState<'forward' | 'back' | 'none'>('none');
  const [context, setContext] = useState<DteDraftContext | null>(reissue);
  const [ready, setReady] = useState(false);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [replacesOtherDraft, setReplacesOtherDraft] = useState(false);
  const [recent, setRecent] = useState<RecentPicks>({});
  const [busy, setBusy] = useState<'draft' | 'request' | 'manual' | null>(null);
  const [failure, setFailure] = useState<{ title: string; detail?: string } | null>(null);
  const [preflight, setPreflight] = useState<DtePreflight | null>(null);
  const [checking, setChecking] = useState(false);
  const [offline, setOffline] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const touched = useRef(false);
  /** Una vez enviado, nada vuelve a guardar el borrador (evita revivirlo tarde). */
  const finished = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const apiaries = useResource<Paginated<Apiary>>(context ? null : '/apiaries?pageSize=100');
  const receivers = useResource<Paginated<Receiver>>(
    context ? null : '/establishments/receivers?pageSize=100',
  );
  const today = todayAr();
  const canRequest = Boolean(integration?.capabilities.emit);
  const simulated = integration?.mode === 'simulado';

  const plateRule = (value: string) =>
    value && !PLATE.test(value) ? 'Escribí la patente con letras y números, sin símbolos.' : null;

  const fields: FieldSpec[] = useMemo(
    () => [
      { name: 'apiaryId', label: 'Apiario de origen', required: !context },
      { name: 'destinationEstablishmentId', label: 'Sala de extracción', required: !context },
      { name: 'estimatedQuantity', label: 'Alzas que estimás cosechar', type: 'number', min: '1' },
      {
        name: 'declaredQuantity',
        label: 'Alzas a declarar',
        type: 'number',
        min: '1',
        required: true,
        validate: (value, all) =>
          all.estimatedQuantity && Number(value) < Number(all.estimatedQuantity)
            ? 'No puede ser menor que lo estimado: la sala no podrá confirmar más de lo declarado.'
            : null,
      },
      { name: 'loadDate', label: 'Fecha de carga', type: 'date', required: true, defaultValue: today },
      {
        name: 'expiryDate',
        label: 'Vence',
        type: 'date',
        required: true,
        defaultValue: addDaysIso(today, DEFAULT_VALIDITY_DAYS),
        validate: (value, all) => {
          if (!all.loadDate) return null;
          const days = daysBetweenIso(all.loadDate, value);
          return days < DEFAULT_VALIDITY_DAYS || days > MAX_VALIDITY_DAYS
            ? `Tiene que ser entre ${DEFAULT_VALIDITY_DAYS} y ${MAX_VALIDITY_DAYS} días después de la carga.`
            : null;
        },
      },
      {
        name: 'transportType',
        label: 'Vehículo',
        type: 'select',
        required: true,
        defaultValue: 'CAMIONETA',
        options: TRANSPORT_TYPES.options,
      },
      {
        name: 'transportPlate',
        label: 'Patente',
        required: true,
        placeholder: 'AA123BC',
        autoComplete: 'off',
        defaultValue: preferences.vehiclePlate,
        validate: plateRule,
      },
      {
        name: 'transportTrailerPlate',
        label: 'Patente del acoplado',
        placeholder: 'Si lleva acoplado',
        autoComplete: 'off',
        defaultValue: preferences.trailerPlate,
        validate: plateRule,
      },
      { name: 'number', label: 'Número de DT-e', placeholder: '022440451-4', full: true },
      {
        name: 'verificationCode',
        label: 'Código de cierre',
        placeholder: '790112',
        help: 'dteVerificationCode',
        autoComplete: 'off',
      },
      { name: 'saveVehicle', label: 'Guardar como vehículo habitual' },
      { name: 'emitted', label: '¿Ya lo emitiste en SIGSA?' },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context, preferences.vehiclePlate, preferences.trailerPlate],
  );

  const { values, set, setValues, blur, errors, setErrors, validateAll } = useForm(fields);
  const byName = (name: string) => fields.find((field) => field.name === name)!;

  const stepFields = [
    ['apiaryId', 'destinationEstablishmentId'],
    ['estimatedQuantity', 'declaredQuantity', 'loadDate', 'expiryDate'],
    ['transportType', 'transportPlate', 'transportTrailerPlate'],
    [],
  ];

  /** Todo cambio hecho por la persona pasa por acá: marca que hay algo que guardar. */
  const change = (name: string, value: string) => {
    touched.current = true;
    set(name, value);
  };

  /* --------------------------------------------- recuperar lo que quedó */

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const [draft, picks] = await Promise.all([loadDteDraft(user.id), loadRecentPicks(user.id)]);
      if (cancelled) return;
      setRecent(picks);
      const meaningful = draft ? isMeaningfulDraft(draft.values, draft.context) : false;
      const matches = reissue
        ? draft?.context?.movementId === reissue.movementId
        : true; // sin contexto se retoma cualquier borrador, incluso uno de reemplazo
      if (draft && meaningful && matches) {
        setValues((current) => ({ ...current, ...draft.values }));
        setContext(draft.context ?? reissue);
        setStep(Math.min(Math.max(draft.step, 0), STEP_NAMES.length - 1));
        setRestoredAt(draft.savedAt);
      } else {
        if (draft && meaningful && reissue) setReplacesOtherDraft(true);
        if (reissue?.defaults) setValues((current) => ({ ...current, ...reissue.defaults }));
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

  const persist = () => {
    if (!user || finished.current || !touched.current || !isMeaningfulDraft(values, context)) return;
    void saveDteDraft({ userId: user.id, step, values, context });
  };

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(persist, 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, step, context, ready]);

  /* ------------------------------------- una sola opción: ya está elegida */

  const apiaryList = apiaries.data?.data ?? [];
  const receiverList = receivers.data?.data ?? [];

  useEffect(() => {
    if (!ready || context) return;
    setValues((current) => {
      const next = { ...current };
      if (!current.apiaryId && apiaryList.length === 1) next.apiaryId = apiaryList[0].id;
      if (!current.destinationEstablishmentId && receiverList.length === 1)
        next.destinationEstablishmentId = receiverList[0].id;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, apiaryList.length, receiverList.length]);

  /* ------------------------------------------------------- reglas vivas */

  /** Al estimar, se propone declarar con margen: la sala no puede confirmar de más. */
  const onEstimated = (value: string) => {
    touched.current = true;
    setValues((current) => {
      const previous = current.estimatedQuantity
        ? suggestDeclared(Number(current.estimatedQuantity))
        : null;
      const untouched = !current.declaredQuantity || Number(current.declaredQuantity) === previous;
      return {
        ...current,
        estimatedQuantity: value,
        declaredQuantity:
          untouched && Number(value) > 0
            ? String(suggestDeclared(Number(value)))
            : current.declaredQuantity,
      };
    });
  };

  /** El vencimiento acompaña a la carga: se conserva la vigencia elegida. */
  const onLoadDate = (value: string) => {
    touched.current = true;
    setValues((current) => {
      const validity =
        current.loadDate && current.expiryDate
          ? daysBetweenIso(current.loadDate, current.expiryDate)
          : DEFAULT_VALIDITY_DAYS;
      const keep =
        validity >= DEFAULT_VALIDITY_DAYS && validity <= MAX_VALIDITY_DAYS
          ? validity
          : DEFAULT_VALIDITY_DAYS;
      return { ...current, loadDate: value, expiryDate: value ? addDaysIso(value, keep) : '' };
    });
  };

  const validity = values.loadDate && values.expiryDate ? daysBetweenIso(values.loadDate, values.expiryDate) : 0;

  /* ---------------------------------------------------------- cuerpo */

  const body = (extra: Record<string, unknown> = {}) => ({
    ...(context
      ? { movementId: context.movementId }
      : {
          apiaryId: values.apiaryId,
          destinationEstablishmentId: values.destinationEstablishmentId,
        }),
    ...(values.estimatedQuantity ? { estimatedQuantity: Number(values.estimatedQuantity) } : {}),
    declaredQuantity: Number(values.declaredQuantity),
    loadDate: values.loadDate,
    expiryDate: values.expiryDate,
    transport: {
      type: values.transportType,
      plate: normalizePlate(values.transportPlate ?? ''),
      ...(values.transportTrailerPlate
        ? { trailerPlate: normalizePlate(values.transportTrailerPlate) }
        : {}),
    },
    ...extra,
  });

  // La verificación corre al llegar al último paso y cada vez que se vuelve a él.
  useEffect(() => {
    if (step !== 3 || !ready) return;
    let cancelled = false;
    setChecking(true);
    setOffline(false);
    setPreflight(null);
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
        if (cause instanceof NetworkError) setOffline(true);
        else {
          const message = toUserMessage(cause, 'read');
          setFailure({ title: message.title, detail: message.detail });
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, ready]);

  // Cada paso empieza arriba: en el teléfono el anterior quedaba desplazado.
  useEffect(() => {
    bodyRef.current?.closest('.sheet-body')?.scrollTo({ top: 0 });
  }, [step]);

  /* ------------------------------------------------------- navegación */

  const next = () => {
    if (!validateAll(stepFields[step])) return;
    setFailure(null);
    setDirection('forward');
    touched.current = true;
    setStep((current) => current + 1);
  };

  const back = () => {
    if (step === 0) {
      close();
      return;
    }
    setDirection('back');
    setStep((current) => current - 1);
  };

  const close = () => {
    if (user && !finished.current && touched.current && isMeaningfulDraft(values, context)) {
      void saveDteDraft({ userId: user.id, step, values, context });
      toast({
        tone: 'info',
        title: 'Guardamos el DT-e a medio armar',
        detail: 'Lo retomás desde el Panel o desde DT-e, aunque cierres la app.',
      });
    }
    onClose();
  };

  // La hoja vuelve a enfocar su primer control si cambia `onClose`: se le pasa
  // una referencia estable para que escribir no le robe el foco al campo.
  const closeRef = useRef(close);
  closeRef.current = close;
  const stableClose = useCallback(() => closeRef.current(), []);
  const closeGuide = useCallback(() => setGuideOpen(false), []);

  const startOver = async () => {
    if (user) await clearDteDraft(user.id);
    touched.current = false;
    setRestoredAt(null);
    setContext(reissue);
    setValues(
      Object.fromEntries(fields.map((field) => [field.name, field.defaultValue ?? ''])) as Record<
        string,
        string
      >,
    );
    setErrors({});
    setDirection('back');
    setStep(0);
  };

  /* -------------------------------------------------------------- envío */

  const send = async (kind: 'draft' | 'request' | 'manual') => {
    if (!validateAll(stepFields.flat())) {
      const firstBad = stepFields.findIndex((group) =>
        group.some((name) => {
          const spec = byName(name);
          const value = values[name] ?? '';
          return (spec.required && !value.trim()) || Boolean(spec.validate?.(value, values));
        }),
      );
      if (firstBad >= 0 && firstBad !== step) {
        setDirection('back');
        setStep(firstBad);
      }
      return;
    }
    if (kind === 'manual' && !values.number?.trim()) {
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
                ...(values.verificationCode ? { verificationCode: values.verificationCode.trim() } : {}),
              }
            : {};
      const result = await apiSend<Dte>('POST', '/dte', body(extra), {
        label: `DT-e de ${values.declaredQuantity} alzas (${formatDay(values.loadDate)})`,
        entity: '/dte',
      });

      finished.current = true;
      if (user) {
        await clearDteDraft(user.id);
        if (!context) {
          await saveRecentPicks(user.id, {
            apiaryId: values.apiaryId,
            destinationEstablishmentId: values.destinationEstablishmentId,
          });
        }
      }
      if (values.saveVehicle === 'true') {
        updatePreferences({
          vehiclePlate: normalizePlate(values.transportPlate ?? ''),
          trailerPlate: normalizePlate(values.transportTrailerPlate ?? ''),
        });
      }

      if (result.queued) {
        feedback.queued('El DT-e');
        onDone();
        return;
      }
      feedback.saved(
        kind === 'request'
          ? simulated
            ? 'Emisión simulada solicitada'
            : 'Pedido enviado a SIGSA'
          : kind === 'manual'
            ? `DT-e ${result.data.number} registrado`
            : 'Borrador guardado',
        kind === 'request' ? 'El número y el código de cierre llegan en unos segundos.' : undefined,
      );
      onDone();
      navigate(`/dte/${result.data.id}`);
    } catch (cause) {
      const perField = fieldErrors(
        cause,
        fields.map((field) => field.name),
      );
      if (Object.keys(perField).length > 0) {
        setErrors((current) => ({ ...current, ...perField }));
        const firstBad = Object.keys(perField)[0];
        const target = stepFields.findIndex((group) => group.includes(firstBad));
        if (target >= 0) {
          setDirection('back');
          setStep(target);
        }
      } else {
        const message = toUserMessage(cause, 'write');
        setFailure({ title: message.title, detail: message.detail });
      }
    } finally {
      setBusy(null);
    }
  };

  /* ----------------------------------------------------------- opciones */

  const apiaryOptions: PickOption[] = apiaryList.map((item) => ({
    value: item.id,
    title: item.name ?? item.code,
    subtitle: [item.name ? item.code : null, item.establishmentName].filter(Boolean).join(' — '),
    code: item.renapaCode ? `RENAPA ${item.renapaCode}` : null,
    status: item.renapaCode ? <StatusPill status={item.renapaStatus} withIcon={false} /> : undefined,
    warning: !item.renapaCode
      ? 'Sin RENAPA: cargalo en Apiarios antes de emitir.'
      : item.renapaStatus && item.renapaStatus !== 'ACTIVE'
        ? 'El RENAPA no está habilitado.'
        : null,
    recent: recent.apiaryId === item.id,
    searchText: `${item.code} ${item.establishmentName ?? ''} ${item.locality ?? ''}`,
  }));

  const receiverOptions: PickOption[] = receiverList.map((item) => ({
    value: item.id,
    title: item.name,
    subtitle: [item.organizationName, [item.locality, item.province].filter(Boolean).join(', ')]
      .filter(Boolean)
      .join(' — '),
    code: item.senasaCode,
    status: <StatusPill status={item.senasaStatus} withIcon={false} />,
    warning: !item.senasaCode
      ? 'Sin código SENASA: no puede figurar como destino.'
      : item.senasaStatus !== 'ACTIVE'
        ? 'La sala no figura habilitada por SENASA.'
        : null,
    recent: recent.destinationEstablishmentId === item.id,
    searchText: `${item.organizationName} ${item.locality ?? ''} ${item.province ?? ''}`,
  }));

  const selectedApiary = apiaryList.find((item) => item.id === values.apiaryId);
  const selectedSala = receiverList.find((item) => item.id === values.destinationEstablishmentId);
  const originLabel = context
    ? context.origin
    : selectedApiary
      ? `${selectedApiary.name ?? selectedApiary.code}${selectedApiary.renapaCode ? ` (RENAPA ${selectedApiary.renapaCode})` : ''}`
      : '—';
  const destinationLabel = context
    ? context.destination
    : selectedSala
      ? `${selectedSala.name}${selectedSala.senasaCode ? ` (${selectedSala.senasaCode})` : ''}`
      : '—';

  const estimated = Number(values.estimatedQuantity) || 0;
  const declared = Number(values.declaredQuantity) || 0;
  const delegationMissing = preflight?.checks.some(
    (check) => check.code === 'DELEGACION' && check.status !== 'ok',
  );
  const vehicleChanged =
    normalizePlate(values.transportPlate ?? '') !== preferences.vehiclePlate ||
    normalizePlate(values.transportTrailerPlate ?? '') !== preferences.trailerPlate;

  /* -------------------------------------------------------------- pasos */

  return (
    <Sheet
      title={context ? 'Otro DT-e para el mismo traslado' : 'Nuevo DT-e'}
      subtitle="Alzas melarias del apiario a la sala de extracción (API-SEM)"
      onClose={stableClose}
    >
      <div ref={bodyRef}>
        <Steps names={STEP_NAMES} current={step} />

        {restoredAt && (
          <div className="restored">
            <Icon name="clock" size={16} />
            <span className="grow small">
              Seguís donde lo dejaste, guardado {formatRelative(restoredAt)}.
            </span>
            <Button size="sm" variant="ghost" onClick={() => void startOver()}>
              Empezar de cero
            </Button>
          </div>
        )}

        {replacesOtherDraft && (
          <Notice tone="warning" title="Tenías otro DT-e a medio armar">
            Si seguís con este, el otro borrador se reemplaza.
          </Notice>
        )}

        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            if (step < 3) next();
          }}
          noValidate
        >
          {failure && <FormError title={failure.title} detail={failure.detail} />}

          <div
            key={step}
            className={
              direction === 'forward'
                ? 'wizard-step from-right'
                : direction === 'back'
                  ? 'wizard-step from-left'
                  : 'wizard-step'
            }
          >
            {/* ------------------------------------------------ 1: origen y destino */}
            {step === 0 &&
              (context ? (
                <>
                  <div className="route-card">
                    <div className="route-head small muted">Mismo traslado {context.movementCode}</div>
                    <RouteLine origin={context.origin} destination={context.destination} />
                    {context.replaces && (
                      <div className="small muted">
                        Reemplaza al DT-e <span className="mono">{context.replaces}</span>
                        {context.reason ? `, dado de baja por: ${context.reason}` : '.'}
                      </div>
                    )}
                  </div>
                  <p className="small muted">
                    El origen y el destino son los del traslado. Si se dio de baja porque llegaron
                    más alzas de las declaradas, en el paso siguiente declará más. Si cambió el
                    origen o el destino, armá un DT-e nuevo desde cero.
                  </p>
                  <WizardActions onBack={back} onNext={next} nextLabel="Continuar" />
                </>
              ) : (
                <>
                  {blockedHolders.length > 0 && (
                    <Notice tone="danger" title="SIGSA no deja emitir nuevos DT-e">
                      {blockedHolders.map((holder) => holder.businessName).join(', ')}: hay DT-e
                      caducados. Podés armar el borrador, pero para pedirlo hay que regularizar
                      ante SENASA.
                    </Notice>
                  )}
                  <PickCards
                    label="¿De qué apiario sale la carga?"
                    help="renapaApiary"
                    required
                    icon="hive"
                    columns={2}
                    options={apiaryOptions}
                    value={values.apiaryId ?? ''}
                    onChange={(value) => change('apiaryId', value)}
                    error={errors.apiaryId}
                    empty={
                      apiaries.loading ? (
                        <p className="small muted">Cargando tus apiarios…</p>
                      ) : (
                        <div className="pick-empty">
                          <p className="small">
                            Todavía no hay apiarios. El apiario, con su RENAPA, es el origen
                            oficial del DT-e.
                          </p>
                          <ButtonLink to="/apiaries" size="sm" icon="plus">
                            Registrar apiario
                          </ButtonLink>
                        </div>
                      )
                    }
                  />
                  <PickCards
                    label="¿A qué sala va?"
                    help="senasaSala"
                    required
                    icon="establishments"
                    options={receiverOptions}
                    value={values.destinationEstablishmentId ?? ''}
                    onChange={(value) => change('destinationEstablishmentId', value)}
                    error={errors.destinationEstablishmentId}
                    empty={
                      receivers.loading ? (
                        <p className="small muted">Cargando salas…</p>
                      ) : (
                        <p className="pick-empty small">
                          No hay salas de extracción cargadas en ApiTrace. La sala tiene que estar
                          registrada, con su código SENASA, para figurar como destino.
                        </p>
                      )
                    }
                  />
                  <WizardActions onBack={back} onNext={next} nextLabel="Continuar" />
                </>
              ))}

            {/* --------------------------------------------- 2: alzas y fechas */}
            {step === 1 && (
              <>
                <QuantityStepper
                  id="dte-estimated"
                  label="¿Cuántas alzas estimás cosechar?"
                  value={values.estimatedQuantity ?? ''}
                  onChange={onEstimated}
                  onBlur={() => blur('estimatedQuantity')}
                  presets={QUANTITY_PRESETS}
                  error={errors.estimatedQuantity}
                  hint="Con la estimación te sugerimos cuántas declarar."
                />
                <QuantityStepper
                  id="dte-declared"
                  label="Alzas a declarar en el DT-e"
                  value={values.declaredQuantity ?? ''}
                  onChange={(value) => change('declaredQuantity', value)}
                  onBlur={() => blur('declaredQuantity')}
                  required
                  tone="strong"
                  help="dteDeclared"
                  error={errors.declaredQuantity}
                  hint={
                    estimated > 0
                      ? declared === suggestDeclared(estimated)
                        ? `Sugerido: un ${Math.round((OVERESTIMATION_FACTOR - 1) * 100)} % más que las ${estimated} estimadas.`
                        : declared >= estimated
                          ? `Margen de ${declared - estimated} sobre las ${estimated} estimadas (sugerido: ${suggestDeclared(estimated)}).`
                          : `Tiene que ser al menos ${estimated}.`
                      : 'Declará un poco más de lo que pensás cargar.'
                  }
                />
                <Notice tone="warning" title="Declará de más, nunca de menos">
                  Si a la sala llegan más alzas que las declaradas, el DT-e se anula y hay que
                  emitir otro antes de descargar. Declarar de más no tiene penalidad.
                </Notice>

                <div className="field">
                  <div className="field-label" id="dte-load-label">
                    ¿Cuándo cargás?
                    <span aria-hidden="true" style={{ color: 'var(--danger-fg)' }}>
                      *
                    </span>
                  </div>
                  <Chips
                    label="Fecha de carga"
                    options={loadDateShortcuts(today)}
                    value={values.loadDate ?? ''}
                    onChange={onLoadDate}
                  />
                  <div className="date-row">
                    <label className="small muted" htmlFor="f-loadDate">
                      Otra fecha
                    </label>
                    <input
                      id="f-loadDate"
                      type="date"
                      value={values.loadDate ?? ''}
                      onChange={(event) => onLoadDate(event.target.value)}
                      onBlur={() => blur('loadDate')}
                      aria-invalid={errors.loadDate ? true : undefined}
                    />
                  </div>
                  {errors.loadDate && (
                    <span className="field-error">
                      <Icon name="danger" size={14} />
                      {errors.loadDate}
                    </span>
                  )}
                </div>

                <div className="field">
                  <div className="field-label">
                    Días de vigencia
                    <span aria-hidden="true" style={{ color: 'var(--danger-fg)' }}>
                      *
                    </span>
                  </div>
                  <Chips
                    label="Días de vigencia"
                    options={validityOptions().map((days) => ({
                      value: String(days),
                      label: `${days} días`,
                    }))}
                    value={String(validity)}
                    onChange={(days) => {
                      touched.current = true;
                      set('expiryDate', addDaysIso(values.loadDate || today, Number(days)));
                    }}
                  />
                  {errors.expiryDate ? (
                    <span className="field-error">
                      <Icon name="danger" size={14} />
                      {errors.expiryDate}
                    </span>
                  ) : (
                    <span className="field-hint">
                      Transita desde el {formatDay(values.loadDate)} a las 00:00 hasta el{' '}
                      {formatDay(values.expiryDate)} a las 23:59.
                    </span>
                  )}
                </div>
                <WizardActions onBack={back} onNext={next} nextLabel="Continuar" />
              </>
            )}

            {/* ----------------------------------------------------- 3: transporte */}
            {step === 2 && (
              <>
                <div className="field">
                  <div className="field-label">
                    ¿En qué vehículo va?
                    <span aria-hidden="true" style={{ color: 'var(--danger-fg)' }}>
                      *
                    </span>
                  </div>
                  <Chips
                    label="Tipo de vehículo"
                    options={TRANSPORT_TYPES.options}
                    value={values.transportType ?? ''}
                    onChange={(value) => change('transportType', value)}
                  />
                  {errors.transportType && (
                    <span className="field-error">
                      <Icon name="danger" size={14} />
                      {errors.transportType}
                    </span>
                  )}
                </div>
                <div className="form-grid">
                  <Field
                    spec={byName('transportPlate')}
                    value={values.transportPlate ?? ''}
                    error={errors.transportPlate}
                    onChange={(value) => change('transportPlate', value.toUpperCase())}
                    onBlur={() => blur('transportPlate')}
                  />
                  <Field
                    spec={byName('transportTrailerPlate')}
                    value={values.transportTrailerPlate ?? ''}
                    error={errors.transportTrailerPlate}
                    onChange={(value) => change('transportTrailerPlate', value.toUpperCase())}
                    onBlur={() => blur('transportTrailerPlate')}
                  />
                </div>
                {vehicleChanged && values.transportPlate && (
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={values.saveVehicle === 'true'}
                      onChange={(event) =>
                        change('saveVehicle', event.target.checked ? 'true' : '')
                      }
                    />
                    <span>
                      Guardar esta patente como mi vehículo habitual
                      <span className="small muted"> (solo en este dispositivo)</span>
                    </span>
                  </label>
                )}
                <p className="small muted">
                  El movimiento API-SEM no lleva precintos ni requiere transporte habilitado por
                  SENASA.
                </p>
                <WizardActions onBack={back} onNext={next} nextLabel="Revisar" />
              </>
            )}

            {/* ------------------------------------------------ 4: verificar y emitir */}
            {step === 3 && (
              <>
                <div className="route-card">
                  <RouteLine origin={originLabel} destination={destinationLabel} />
                  <dl className="route-facts">
                    <div>
                      <dt>Alzas declaradas</dt>
                      <dd>
                        <span className="route-big">{values.declaredQuantity || '—'}</span>
                        {estimated > 0 && <span className="small muted"> ({estimated} estimadas)</span>}
                      </dd>
                    </div>
                    <div>
                      <dt>Vigencia</dt>
                      <dd>
                        {formatDay(values.loadDate)} al {formatDay(values.expiryDate)}
                      </dd>
                    </div>
                    <div>
                      <dt>Transporte</dt>
                      <dd>
                        {TRANSPORT_TYPES.label(values.transportType)}{' '}
                        <span className="mono">{normalizePlate(values.transportPlate ?? '')}</span>
                        {values.transportTrailerPlate && (
                          <>
                            {' '}
                            + acoplado{' '}
                            <span className="mono">{normalizePlate(values.transportTrailerPlate)}</span>
                          </>
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="form-section-title" style={{ marginTop: 'var(--sp-5)' }}>
                  Lo que SIGSA va a revisar
                </div>
                {checking && (
                  <p className="row row-tight small muted">
                    <span className="spinner" aria-hidden="true" />
                    Verificando…
                  </p>
                )}
                {offline && (
                  <Notice tone="warning" title="Sin conexión">
                    No se pudo verificar. Guardá el borrador: se envía al volver la señal y lo
                    verificás antes de emitir.
                  </Notice>
                )}
                {preflight && <DteChecks checks={preflight.checks} collapseOk />}
                {delegationMissing && (
                  <Button size="sm" icon="shield" onClick={() => setGuideOpen(true)}>
                    Cómo delegar SIGSA en ARCA
                  </Button>
                )}

                {canRequest ? (
                  <div className="emit-zone">
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
                    <div className="emit-secondary">
                      <Button
                        variant="ghost"
                        icon="back"
                        onClick={back}
                        disabled={Boolean(busy)}
                      >
                        Volver
                      </Button>
                      <Button
                        variant="secondary"
                        busy={busy === 'draft'}
                        busyLabel="Guardando…"
                        disabled={Boolean(busy)}
                        onClick={() => void send('draft')}
                      >
                        Guardar borrador sin pedir
                      </Button>
                    </div>
                    <Disclosure label="Ya lo emití en SIGSA: registrar número y código">
                      <ManualFields
                        values={values}
                        errors={errors}
                        byName={byName}
                        change={change}
                        busy={busy}
                        onRegister={() => void send('manual')}
                      />
                    </Disclosure>
                  </div>
                ) : (
                  <div className="emit-zone">
                    <div className="choice-group" role="radiogroup" aria-label="¿Ya lo emitiste en SIGSA?">
                      {[
                        {
                          value: 'no',
                          title: 'Todavía no lo emití',
                          description:
                            'Guardá el borrador, emitilo en SIGSA (web u oficina local) y después registrá el número desde el DT-e.',
                        },
                        {
                          value: 'yes',
                          title: 'Ya lo emití en SIGSA',
                          description: 'Registrá ahora el número y el código de cierre impresos.',
                        },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className="choice"
                          role="radio"
                          aria-checked={(values.emitted || 'no') === option.value}
                          aria-pressed={(values.emitted || 'no') === option.value}
                          onClick={() => change('emitted', option.value)}
                        >
                          <span className="choice-mark">
                            {(values.emitted || 'no') === option.value && (
                              <Icon name="check" size={13} strokeWidth={3} />
                            )}
                          </span>
                          <span className="choice-text">
                            <span className="choice-title">{option.title}</span>
                            <span className="choice-desc">{option.description}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                    {values.emitted === 'yes' ? (
                      <ManualFields
                        values={values}
                        errors={errors}
                        byName={byName}
                        change={change}
                        busy={busy}
                        onRegister={() => void send('manual')}
                        onBack={back}
                      />
                    ) : (
                      <div className="form-actions">
                        <Button variant="ghost" icon="back" onClick={back} disabled={Boolean(busy)}>
                          Volver
                        </Button>
                        <Button
                          variant="primary"
                          busy={busy === 'draft'}
                          busyLabel="Guardando…"
                          disabled={Boolean(busy)}
                          onClick={() => void send('draft')}
                        >
                          Guardar borrador
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </form>
      </div>

      {guideOpen && <DelegationGuide onClose={closeGuide} />}
    </Sheet>
  );
};

/* =========================================================================
   Piezas
   ========================================================================= */

/** Origen y destino unidos por una línea: el traslado en una imagen. */
export const RouteLine = ({ origin, destination }: { origin: string; destination: string }) => (
  <ol className="route-line">
    <li>
      <span className="route-dot" aria-hidden="true">
        <Icon name="hive" size={14} />
      </span>
      <span>
        <span className="route-key">Sale de</span>
        <span className="route-value">{origin}</span>
      </span>
    </li>
    <li>
      <span className="route-dot" aria-hidden="true">
        <Icon name="establishments" size={14} />
      </span>
      <span>
        <span className="route-key">Llega a</span>
        <span className="route-value">{destination}</span>
      </span>
    </li>
  </ol>
);

const ManualFields = ({
  values,
  errors,
  byName,
  change,
  busy,
  onRegister,
  onBack,
}: {
  values: Record<string, string>;
  errors: Record<string, string>;
  byName: (name: string) => FieldSpec;
  change: (name: string, value: string) => void;
  busy: 'draft' | 'request' | 'manual' | null;
  onRegister: () => void;
  onBack?: () => void;
}) => (
  <>
    <div className="form-grid">
      <Field
        spec={byName('number')}
        value={values.number ?? ''}
        error={errors.number}
        onChange={(value) => change('number', value)}
      />
      <Field
        spec={byName('verificationCode')}
        value={values.verificationCode ?? ''}
        error={errors.verificationCode}
        onChange={(value) => change('verificationCode', value)}
      />
    </div>
    <div className="form-actions">
      {onBack && (
        <Button variant="ghost" icon="back" onClick={onBack} disabled={Boolean(busy)}>
          Volver
        </Button>
      )}
      <Button
        variant={onBack ? 'primary' : 'secondary'}
        icon="check"
        busy={busy === 'manual'}
        busyLabel="Registrando…"
        disabled={Boolean(busy)}
        onClick={onRegister}
      >
        Registrar DT-e emitido
      </Button>
    </div>
  </>
);
