import { useState, type FormEvent } from 'react';
import { Button, ErrorNotice, Notice, Sheet, useWriteFeedback } from './ui';
import { apiSend } from '../lib/api';
import { toUserMessage } from '../lib/errors';
import type { Apiary, Establishment } from '../lib/types';

interface OfficialRegistrySheetProps {
  target: { type: 'apiary'; data: Apiary } | { type: 'establishment'; data: Establishment };
  onClose: () => void;
  onDone: () => void;
}

export const OfficialRegistrySheet = ({ target, onClose, onDone }: OfficialRegistrySheetProps) => {
  const isApiary = target.type === 'apiary';
  const feedback = useWriteFeedback();

  const [code, setCode] = useState(
    (isApiary ? (target.data as Apiary).renapaCode : (target.data as Establishment).senasaCode) ?? '',
  );
  const [status, setStatus] = useState(
    (isApiary ? (target.data as Apiary).renapaStatus : (target.data as Establishment).senasaStatus) ?? 'ACTIVE',
  );
  const [validTo, setValidTo] = useState(
    (isApiary ? (target.data as Apiary).renapaValidTo : (target.data as Establishment).senasaValidTo) ?? '',
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const path = isApiary ? `/apiaries/${target.data.id}` : `/establishments/${target.data.id}`;
    const entity = isApiary ? '/apiaries' : '/establishments';
    const payload = isApiary
      ? {
          renapaCode: code.trim() || undefined,
          renapaStatus: status,
          renapaValidTo: validTo || undefined,
        }
      : {
          senasaCode: code.trim() || undefined,
          senasaStatus: status,
          senasaValidTo: validTo || undefined,
        };

    try {
      const result = await apiSend('PATCH', path, payload, {
        label: isApiary
          ? `Actualizar RENAPA de apiario ${target.data.code}`
          : `Actualizar habilitación SENASA de ${target.data.name}`,
        entity,
      });

      if (result.queued) {
        feedback.queued(isApiary ? 'La actualización del RENAPA' : 'La actualización de la habilitación SENASA');
      } else {
        feedback.saved(
          isApiary ? 'RENAPA actualizado' : 'Habilitación SENASA actualizada',
          isApiary ? 'El apiario cuenta con su registro oficial.' : 'El establecimiento tiene su habilitación al día.',
        );
      }
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={isApiary ? `Registro RENAPA: ${target.data.code}` : `Habilitación SENASA: ${target.data.name}`}
      subtitle={
        isApiary
          ? 'Identificador del Registro Nacional de Productores Apícolas para este apiario.'
          : 'Código de habilitación o registro oficial emitido por SENASA para el establecimiento.'
      }
      onClose={onClose}
      narrow
    >
      <form onSubmit={handleSubmit} className="stack">
        {error ? <ErrorNotice message={toUserMessage(error, 'write')} /> : null}

        <Notice tone="info">
          {isApiary
            ? 'El RENAPA habilita la emisión y validación de DT-e con origen en este apiario.'
            : 'Las salas de extracción y acopios deben contar con habilitación SENASA activa para recibir traslados apícolas.'}
        </Notice>

        <div className="field">
          <label className="field-label" htmlFor="reg-code">
            {isApiary ? 'Código RENAPA' : 'Código de Habilitación SENASA'}
          </label>
          <input
            id="reg-code"
            type="text"
            className="field-input mono"
            placeholder={isApiary ? 'Ej. 12.345.678' : 'Ej. SEF-B-012'}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={busy}
          />
          <div className="field-hint">
            {isApiary ? 'Formato numérico o según certificado SENASA.' : 'Código de habilitación de planta o sala.'}
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="reg-status">
            Estado ante el organismo
          </label>
          <select
            id="reg-status"
            className="field-input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            disabled={busy}
          >
            <option value="ACTIVE">Activo / Habilitado</option>
            <option value="INACTIVE">Inactivo</option>
            <option value="SUSPENDED">Suspendido / En trámite</option>
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="reg-valid-to">
            Vigencia hasta (opcional)
          </label>
          <input
            id="reg-valid-to"
            type="date"
            className="field-input"
            value={validTo}
            onChange={(e) => setValidTo(e.target.value)}
            disabled={busy}
          />
          <div className="field-hint">Fecha límite de vigencia de la inscripción oficial.</div>
        </div>

        <div className="form-actions">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" busy={busy} busyLabel="Guardando…">
            Guardar registro
          </Button>
        </div>
      </form>
    </Sheet>
  );
};
