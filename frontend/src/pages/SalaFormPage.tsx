import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiSend } from '../lib/api';
import { invalidateCache } from '../lib/db';
import { fieldErrors, toUserMessage } from '../lib/errors';
import type { GeoPoint } from '../lib/geo';
import { photoPayload, type PreparedPhoto } from '../lib/photo';
import { Notice, useToast, useWriteFeedback } from '../components/ui';
import { AppBar } from '../components/Screen';
import { FormHero, GeoField, PhotoField, SubmitButton, TextFieldCard } from '../components/MasterForm';
import { SALA_KINDS, type SalaKind } from '../lib/salas';
import type { Establishment } from '../lib/types';

const SENASA_CODE = /^SEF-[A-Z]-\d{1,7}$/;

/**
 * «Nueva Sala de extracción» y «Nueva Sala de fraccionamiento» (doc 13):
 * nombre, RNE, ubicación y foto. El código de habilitación SENASA, que el DT-e
 * de alzas usa como destino, va en «Datos oficiales».
 */
export const SalaFormPage = () => {
  const { kind } = useParams<{ kind: SalaKind }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();
  const feedback = useWriteFeedback();

  const [name, setName] = useState('');
  const [rne, setRne] = useState('');
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [senasaCode, setSenasaCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<{ title: string; detail?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (kind !== 'extraccion' && kind !== 'fraccionamiento') return <Navigate to="/carga" replace />;
  const spec = SALA_KINDS[kind];
  const backTo = params.get('volver') || spec.list;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (name.trim().length < 2) found.name = `Escribí el nombre de la ${spec.noun}.`;
    if (rne.trim() && rne.trim().length < 3) found.rne = 'Revisá el número de RNE.';
    const code = senasaCode.trim().toUpperCase().replace(/\s+/g, '');
    if (code && !SENASA_CODE.test(code)) found.senasaCode = 'El código de habilitación es SEF-Letra-N° (ej. SEF-B-20010).';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setFailure(null);
    const body = {
      name: name.trim(),
      type: spec.type,
      ...(rne.trim() ? { rne: rne.trim().toUpperCase() } : {}),
      ...(point ? { latitude: point.latitude, longitude: point.longitude } : {}),
      ...(code ? { senasaCode: code } : {}),
      ...photoPayload(photo),
    };
    try {
      const result = await apiSend<Establishment>('POST', '/establishments', body, {
        label: `${spec.title} ${body.name}`,
        entity: '/establishments',
      });
      await invalidateCache('/places');
      if (result.queued) feedback.queued(`La ${spec.noun} ${body.name}`);
      else toast({ tone: 'success', title: `${spec.title} guardada`, detail: `${result.data.name} quedó registrada.` });
      navigate(backTo, { replace: true });
    } catch (cause) {
      const perField = fieldErrors(cause, ['name', 'rne', 'senasaCode', 'photo']);
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
    <div className="master-page">
      <AppBar title={`Nueva ${spec.title}`} back={backTo} />
      <form className="master-form" onSubmit={(event) => void onSubmit(event)} noValidate>
        <FormHero
          icon={spec.icon}
          title={`Registrá una ${spec.noun}`}
          subtitle={`Completá la información para registrar la ${spec.noun} en la plataforma.`}
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
          placeholder="Nombre de la sala"
          value={name}
          onChange={setName}
          error={errors.name}
          maxLength={200}
          autoComplete="off"
        />
        <TextFieldCard
          number={2}
          label="RNE"
          icon="document"
          placeholder="Número de RNE"
          value={rne}
          onChange={(value) => setRne(value.toUpperCase())}
          error={errors.rne}
          maxLength={60}
          autoCapitalize="characters"
          spellCheck={false}
          autoComplete="off"
        />
        <GeoField number={3} icon="pin" hint="Registrá la ubicación de la sala" value={point} onChange={setPoint} />
        <PhotoField number={4} hint={`Tomá una foto de la ${spec.noun}`} value={photo} onChange={setPhoto} />

        <details className="more-data">
          <summary>Datos oficiales (opcional)</summary>
          <TextFieldCard
            label="Código de habilitación SENASA"
            icon="rules"
            placeholder="Ej. SEF-B-20010"
            value={senasaCode}
            onChange={(value) => setSenasaCode(value.toUpperCase())}
            error={errors.senasaCode}
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={40}
            hint={
              kind === 'extraccion'
                ? 'Es el destino oficial del DT-e de alzas. Queda «sin verificar» hasta que se confirme con SENASA.'
                : 'Si la sala tiene habilitación de SENASA, cargala acá.'
            }
          />
        </details>

        <SubmitButton busy={busy}>Guardar {spec.title}</SubmitButton>
      </form>
    </div>
  );
};
