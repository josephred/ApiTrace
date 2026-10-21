import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiSend } from '../lib/api';
import { invalidateCache } from '../lib/db';
import { fieldErrors, toUserMessage } from '../lib/errors';
import { useResource } from '../lib/useResource';
import type { GeoPoint } from '../lib/geo';
import { photoPayload, type PreparedPhoto } from '../lib/photo';
import type { Zone } from '../lib/cargo';
import { Notice, useToast, useWriteFeedback } from '../components/ui';
import { AppBar } from '../components/Screen';
import {
  CounterField,
  FormHero,
  GeoField,
  PhotoField,
  SubmitButton,
  TextFieldCard,
  ZoneField,
  type ZoneChoice,
} from '../components/MasterForm';
import type { Apiary } from '../lib/types';

/**
 * «Nuevo Apiario» (doc 13): nombre, zona, ubicación, colmenas y foto. El
 * predio y el código interno los resuelve el sistema; el código RENAPA del
 * apiario, que SIGSA exige como origen del DT-e, va en «Datos oficiales» y se
 * puede cargar después.
 */
export const ApiaryFormPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const backTo = params.get('volver') || '/apiaries';
  const toast = useToast();
  const feedback = useWriteFeedback();
  const zones = useResource<Zone[]>('/zones');

  const [name, setName] = useState('');
  const [zone, setZone] = useState<ZoneChoice>({ zoneId: params.get('zona'), zoneName: '' });
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [hives, setHives] = useState(0);
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [renapaCode, setRenapaCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<{ title: string; detail?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (name.trim().length < 2) found.name = 'Escribí el nombre del apiario.';
    if (zone.zoneId === null && zone.zoneName && zone.zoneName.trim().length < 2) {
      found.zone = 'El nombre de la zona tiene al menos 2 letras.';
    }
    if (renapaCode.trim() && !/^[A-Za-z]\d{1,7}-\d{1,4}$/.test(renapaCode.trim())) {
      found.renapaCode = 'El RENAPA del apiario es Letra + N° de RENAPA - N° de apiario (ej. B53999-2).';
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setFailure(null);
    const body = {
      name: name.trim(),
      ...(zone.zoneId ? { zoneId: zone.zoneId } : zone.zoneName.trim() ? { zoneName: zone.zoneName.trim() } : {}),
      ...(point ? { latitude: point.latitude, longitude: point.longitude } : {}),
      hiveCount: hives,
      ...(renapaCode.trim() ? { renapaCode: renapaCode.trim().toUpperCase() } : {}),
      ...photoPayload(photo),
    };
    try {
      const result = await apiSend<Apiary>('POST', '/apiaries', body, {
        label: `Apiario ${body.name}`,
        entity: '/apiaries',
      });
      await Promise.all([invalidateCache('/zones'), invalidateCache('/places')]);
      if (result.queued) {
        feedback.queued(`El apiario ${body.name}`);
      } else {
        toast({
          tone: 'success',
          title: 'Apiario guardado',
          detail: `${result.data.name ?? result.data.code} quedó registrado${point ? ' con su ubicación' : ''}.`,
        });
      }
      navigate(backTo, { replace: true });
    } catch (cause) {
      const perField = fieldErrors(cause, ['name', 'zoneName', 'renapaCode', 'hiveCount', 'photo']);
      if (Object.keys(perField).length > 0) {
        setErrors({ ...perField, ...(perField.zoneName ? { zone: perField.zoneName } : {}) });
      } else {
        const message = toUserMessage(cause, 'write');
        setFailure({ title: message.title, detail: message.detail });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="master-page">
      <AppBar title="Nuevo Apiario" back={backTo} />
      <form className="master-form" onSubmit={(event) => void onSubmit(event)} noValidate>
        <FormHero
          icon="hivePlus"
          title="Registrá un nuevo apiario"
          subtitle="Completá la información para registrar tu apiario en la plataforma."
        />
        {failure && (
          <Notice tone="danger" title={failure.title}>
            {failure.detail}
          </Notice>
        )}

        <TextFieldCard
          number={1}
          label="Nombre"
          icon="user"
          placeholder="Nombre del apiario"
          value={name}
          onChange={setName}
          error={errors.name}
          maxLength={160}
          autoComplete="off"
        />
        <ZoneField
          number={2}
          zones={zones.data ?? []}
          loading={zones.loading}
          value={zone}
          onChange={setZone}
          error={errors.zone}
        />
        <GeoField number={3} hint="Registrá la ubicación de tu apiario" value={point} onChange={setPoint} />
        <CounterField
          number={4}
          label="Número de colmenas"
          hint="Cantidad de colmenas"
          icon="beehive"
          value={hives}
          onChange={setHives}
        />
        <PhotoField number={5} hint="Tomá una foto de tu apiario" value={photo} onChange={setPhoto} />

        <details className="more-data">
          <summary>Datos oficiales (opcional)</summary>
          <TextFieldCard
            label="RENAPA del apiario"
            icon="honeycomb"
            placeholder="Ej. B53999-2"
            value={renapaCode}
            onChange={(value) => setRenapaCode(value.toUpperCase())}
            error={errors.renapaCode}
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={40}
            hint="Es el origen oficial del DT-e. Si no lo tenés a mano, cargalo después desde Apiarios."
          />
        </details>

        <SubmitButton busy={busy} busyLabel="Guardando…">
          Guardar Apiario
        </SubmitButton>
      </form>
    </div>
  );
};
