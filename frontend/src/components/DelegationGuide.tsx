import { useResource } from '../lib/useResource';
import { formatCuit } from '../lib/format';
import { Icon } from './Icon';
import { Button, Notice, Sheet, useToast } from './ui';
import type { DteIntegration } from '../lib/types';

/**
 * Guía para delegar el servicio de SENASA en ApiTrace desde ARCA.
 *
 * Es la pantalla «Cómo delegar el servicio» del prototipo ApiAsistente: el
 * trámite se hace una sola vez, pero en ARCA, con la Clave Fiscal y en un
 * sitio que el apicultor no usa todos los días. Explicarlo paso a paso, con la
 * CUIT lista para copiar, es lo que evita la llamada a la cooperativa.
 *
 * ApiTrace no puede verificar la delegación por su cuenta: al terminar, el
 * número de constancia se registra en Productores → Delegación.
 */

const STEPS: { title: string; detail: string }[] = [
  {
    title: 'Entrá a ARCA con tu Clave Fiscal',
    detail:
      'Usá tu CUIT y tu Clave Fiscal (nivel 3). La clave se escribe solo en el sitio de ARCA: nunca en ApiTrace.',
  },
  {
    title: 'Abrí el «Administrador de Relaciones de Clave Fiscal»',
    detail: 'Buscalo por su nombre en el listado de servicios de ARCA.',
  },
  {
    title: 'Elegí «Nueva relación»',
    detail: 'El representado sos vos: tu propia CUIT.',
  },
  {
    title: 'Buscá el servicio de SENASA para el DT-e',
    detail:
      'Dentro de SENASA, el servicio de SIGSA con el que se emiten los DT-e. El nombre exacto puede variar según cómo lo publique SENASA.',
  },
  {
    title: 'Ingresá la CUIT de ApiTrace como representante',
    detail: 'Es la CUIT que figura arriba, en «A quién delegás». Copiala tal cual.',
  },
  {
    title: 'Confirmá y guardá la constancia F3283/E',
    detail: 'ARCA emite el formulario F3283/E. Anotá su número: es la prueba de la delegación.',
  },
  {
    title: 'Registrá la constancia en ApiTrace',
    detail:
      'En Productores → Delegación, cargá el número del F3283/E. Desde ahí ApiTrace sabe que puede pedir DT-e en tu nombre.',
  },
];

export const DelegationGuide = ({ onClose }: { onClose: () => void }) => {
  const toast = useToast();
  const integration = useResource<DteIntegration>('/dte/integration');
  const cuit = integration.data?.platformTaxId ?? null;

  const copy = async () => {
    if (!cuit) return;
    try {
      await navigator.clipboard.writeText(cuit);
      toast({ tone: 'info', title: 'CUIT copiada', detail: formatCuit(cuit) });
    } catch {
      toast({ tone: 'warning', title: 'No se pudo copiar', detail: 'Seleccioná la CUIT y copiala a mano.' });
    }
  };

  return (
    <Sheet
      title="Cómo delegar SIGSA en ApiTrace"
      subtitle="Se hace una sola vez, desde ARCA."
      onClose={onClose}
    >
      <div className="guide">
        <div className="guide-trust">
          <Icon name="shield" size={22} />
          <p>
            <strong>No compartís tu Clave Fiscal.</strong> Solo autorizás a ApiTrace a hacer un
            trámite puntual, el DT-e, en tu nombre ante SENASA. Podés revocarlo en ARCA cuando
            quieras.
          </p>
        </div>

        <div className="guide-cuit">
          <div className="small muted">A quién delegás: CUIT de ApiTrace</div>
          {cuit ? (
            <div className="guide-cuit-row">
              <span className="guide-cuit-value mono" aria-label={`CUIT ${formatCuit(cuit)}`}>
                {formatCuit(cuit)}
              </span>
              <Button size="sm" icon="copy" onClick={() => void copy()}>
                Copiar
              </Button>
            </div>
          ) : (
            <p className="small" style={{ margin: 0 }}>
              {integration.loading
                ? 'Consultando…'
                : 'Este servidor todavía no tiene cargada la CUIT de ApiTrace. Pedísela a quien administra ApiTrace en tu organización.'}
            </p>
          )}
        </div>

        <ol className="guide-steps">
          {STEPS.map((step, index) => (
            <li key={step.title} className="guide-step">
              <span className="guide-num" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <div className="guide-step-title">{step.title}</div>
                <div className="small muted">{step.detail}</div>
              </div>
            </li>
          ))}
        </ol>

        <Notice tone="info" title="¿Y la sala?">
          Si la sala de extracción va a cerrar los DT-e desde ApiTrace, su titular delega el
          servicio SITA de la misma manera.
        </Notice>

        <div className="form-actions">
          <Button variant="primary" onClick={onClose}>
            Entendido
          </Button>
        </div>
      </div>
    </Sheet>
  );
};
