import { useState, type FormEvent } from 'react';
import { apiSend } from '../lib/api';
import { fieldErrors, toUserMessage } from '../lib/errors';
import { normalizePlate } from '../lib/dte';
import { VEHICLE_KINDS, VEHICLE_LABELS, type Vehicle, type VehicleKind } from '../lib/cargo';
import { Notice, useToast, useWriteFeedback } from './ui';
import { FieldCard, FormHero, SubmitButton, TextFieldCard } from './MasterForm';
import { VehicleArt } from './Illustrations';

/** Formatos vigentes: AAA999 (anterior) y AA999AA (Mercosur). */
const ARGENTINE_PLATE = /^([A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/;

/**
 * «Registrá un nuevo transporte» (doc 13): conductor, patente y carro. Lo
 * usan la pantalla Nuevo Transporte y el paso 2 del asistente del DT-e, que lo
 * abre encima sin perder lo cargado.
 */
export const TransportForm = ({
  onSaved,
}: {
  /** Recibe el vehículo creado (o null si quedó en la cola sin conexión). */
  onSaved: (vehicle: Vehicle | null) => void;
}) => {
  const toast = useToast();
  const feedback = useWriteFeedback();
  const [driverName, setDriverName] = useState('');
  const [plate, setPlate] = useState('');
  const [trailerPlate, setTrailerPlate] = useState('');
  const [kind, setKind] = useState<VehicleKind>('CAMIONETA');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<{ title: string; detail?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const plateWarning = (value: string) => {
    const clean = normalizePlate(value);
    return clean && clean.length >= 5 && !ARGENTINE_PLATE.test(clean)
      ? 'No parece una patente argentina (AA 123 BB o AAA 123). Revisala.'
      : undefined;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (driverName.trim().length < 3) found.driverName = 'Escribí el nombre completo del conductor.';
    if (normalizePlate(plate).length < 5) found.plate = 'Escribí la patente del vehículo (ej. AB 123 CD).';
    if (trailerPlate.trim() && normalizePlate(trailerPlate).length < 5) {
      found.trailerPlate = 'Revisá la patente del carro (ej. AC 456 EF).';
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setFailure(null);
    const body = {
      driverName: driverName.trim(),
      plate: normalizePlate(plate),
      ...(trailerPlate.trim() ? { trailerPlate: normalizePlate(trailerPlate) } : {}),
      type: kind,
      ...(name.trim() ? { name: name.trim() } : {}),
    };
    try {
      const result = await apiSend<Vehicle>('POST', '/vehicles', body, {
        label: `Transporte ${body.plate}`,
        entity: '/vehicles',
      });
      if (result.queued) {
        feedback.queued(`El transporte ${body.plate}`);
        onSaved(null);
      } else {
        toast({ tone: 'success', title: 'Transporte guardado', detail: `${body.plate} ya figura en tus vehículos.` });
        onSaved(result.data);
      }
    } catch (cause) {
      const perField = fieldErrors(cause, ['driverName', 'plate', 'trailerPlate', 'type', 'name']);
      if (Object.keys(perField).length > 0) setErrors(perField);
      else {
        const message = toUserMessage(cause, 'write');
        setFailure({ title: message.title, detail: message.detail });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="master-form master-form-sky" onSubmit={(event) => void onSubmit(event)} noValidate>
      <FormHero
        icon="truckArrow"
        tone="sky"
        title="Registrá un nuevo transporte"
        subtitle="Completá la información del conductor y los vehículos para registrar el transporte en la plataforma."
      />
      {failure && (
        <Notice tone="danger" title={failure.title}>
          {failure.detail}
        </Notice>
      )}

      <TextFieldCard
        number={1}
        label="Conductor"
        icon="user"
        placeholder="Nombre completo del conductor"
        value={driverName}
        onChange={setDriverName}
        error={errors.driverName}
        autoComplete="name"
        autoCapitalize="words"
        maxLength={160}
      />
      <TextFieldCard
        number={2}
        label="Patente del vehículo"
        icon="car"
        placeholder="Ej. AB 123 CD"
        value={plate}
        onChange={(value) => setPlate(value.toUpperCase())}
        error={errors.plate}
        hint={!errors.plate ? plateWarning(plate) : undefined}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        maxLength={12}
      />
      <TextFieldCard
        number={3}
        label="Carro - Patente"
        icon="trailer"
        placeholder="Ej. AC 456 EF"
        value={trailerPlate}
        onChange={(value) => setTrailerPlate(value.toUpperCase())}
        error={errors.trailerPlate}
        hint={!errors.trailerPlate ? (plateWarning(trailerPlate) ?? 'Dejalo vacío si no lleva carro.') : undefined}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        maxLength={12}
      />
      <FieldCard
        number={4}
        label="Tipo de vehículo"
        icon="movements"
        stacked={
          <div className="kind-picker" role="radiogroup" aria-label="Tipo de vehículo">
            {VEHICLE_KINDS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={kind === option}
                className={kind === option ? 'kind-option selected' : 'kind-option'}
                onClick={() => setKind(option)}
              >
                <span className="kind-art">
                  <VehicleArt kind={option} />
                </span>
                <span>{VEHICLE_LABELS[option]}</span>
              </button>
            ))}
          </div>
        }
      >
        <span className="field-card-placeholder">Va en el DT-e junto a la patente</span>
      </FieldCard>

      <details className="more-data">
        <summary>Más datos (opcional)</summary>
        <TextFieldCard
          label="Nombre para reconocerlo"
          icon="document"
          placeholder="Ej. Camioneta Hilux"
          value={name}
          onChange={setName}
          maxLength={80}
          autoComplete="off"
        />
      </details>

      <SubmitButton busy={busy} tone="sky">
        Guardar Transporte
      </SubmitButton>
    </form>
  );
};
