import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiSend } from '../lib/api';
import { invalidateCache } from '../lib/db';
import { fieldErrors, toUserMessage } from '../lib/errors';
import { useResource } from '../lib/useResource';
import type { GeoPoint } from '../lib/geo';
import { photoPayload, type PreparedPhoto } from '../lib/photo';
import type { Zone } from '../lib/cargo';
import { cleanRenspa, FINCA_TYPE, renspaError } from '../lib/fincas';
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
import type { Establishment } from '../lib/types';

/**
 * «Finca / Polinización» (doc 14), como en la captura de Rodrigo: nombre,
 * zona, RENSPA del campo, ubicación, colmenas que se llevan a polinizar y
 * foto. El RENSPA es opcional: se puede cargar después desde la lista de
 * fincas. La finca queda como destino del DT-e de colmenas.
 */
export const FincaFormPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const backTo = params.get('volver') || '/fincas';
  const toast = useToast();
  const feedback = useWriteFeedback();
  const zones = useResource<Zone[]>('/zones');

  const [name, setName] = useState('');
  const [zone, setZone] = useState<ZoneChoice>({
    zoneId: params.get('zona'),
    zoneName: '',
  });
  const [renspa, setRenspa] = useState('');
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [hives, setHives] = useState(0);
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<{
    title: string;
    detail?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (name.trim().length < 2) found.name = 'Escribí el nombre de la finca.';
    if (zone.zoneId === null && zone.zoneName && zone.zoneName.trim().length < 2) {
      found.zone = 'El nombre de la zona tiene al menos 2 letras.';
    }
    const renspaProblem = renspaError(renspa);
    if (renspaProblem) found.renspaNumber = renspaProblem;
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setFailure(null);
    const body = {
      name: name.trim(),
      type: FINCA_TYPE,
      ...(zone.zoneId
        ? { zoneId: zone.zoneId }
        : zone.zoneName.trim()
          ? { zoneName: zone.zoneName.trim() }
          : {}),
      ...(cleanRenspa(renspa) ? { renspaNumber: cleanRenspa(renspa) } : {}),
      ...(point ? { latitude: point.latitude, longitude: point.longitude } : {}),
      hiveCount: hives,
      ...photoPayload(photo),
    };
    try {
      const result = await apiSend<Establishment>('POST', '/establishments', body, {
        label: `Finca ${body.name}`,
        entity: '/establishments',
      });
      await Promise.all([invalidateCache('/zones'), invalidateCache('/places')]);
      if (result.queued) {
        feedback.queued(`La finca ${body.name}`);
      } else {
        toast({
          tone: 'success',
          title: 'Finca guardada',
          detail: `${result.data.name} quedó registrada${point ? ' con su ubicación' : ''}.`,
        });
      }
      navigate(backTo, { replace: true });
    } catch (cause) {
      const perField = fieldErrors(cause, [
        'name',
        'zoneName',
        'renspaNumber',
        'hiveCount',
        'photo',
      ]);
      if (Object.keys(perField).length > 0) {
        setErrors({
          ...perField,
          ...(perField.zoneName ? { zone: perField.zoneName } : {}),
        });
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
      <AppBar title="Finca / Polinización" back={backTo} />
      <form className="master-form" onSubmit={(event) => void onSubmit(event)} noValidate>
        <FormHero
          icon="farmPlus"
          title="Registrá un nuevo lugar de Finca / Polinización"
          subtitle="Completá la información para registrar el lugar."
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
          placeholder="Nombre de la finca"
          value={name}
          onChange={setName}
          error={errors.name}
          maxLength={200}
          autoComplete="off"
        />
        <ZoneField
          number={2}
          zones={zones.data ?? []}
          loading={zones.loading}
          value={zone}
          onChange={setZone}
          error={errors.zone}
          count={(item) => item.fincaCount ?? 0}
        />
        <TextFieldCard
          number={3}
          label="RENSPA"
          icon="document"
          placeholder="Ingresá el RENSPA"
          value={renspa}
          onChange={setRenspa}
          error={errors.renspaNumber}
          hint="Opcional: si no lo tenés a mano, cargalo después."
          maxLength={60}
          spellCheck={false}
          autoComplete="off"
        />
        <GeoField
          number={4}
          label="Geolocalización"
          hint="Registrá la ubicación de la finca"
          value={point}
          onChange={setPoint}
        />
        <CounterField
          number={5}
          label="Número de colmenas"
          hint="Cantidad de colmenas"
          icon="beehive"
          value={hives}
          onChange={setHives}
        />
        <PhotoField
          number={6}
          label="Tomar foto"
          action="Tocar para tomar foto"
          hint="Tomá una foto del lugar"
          value={photo}
          onChange={setPhoto}
        />

        <SubmitButton busy={busy} busyLabel="Guardando…">
          Guardar Finca / Polinización
        </SubmitButton>
      </form>
    </div>
  );
};
