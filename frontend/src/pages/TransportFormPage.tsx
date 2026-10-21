import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppBar } from '../components/Screen';
import { TransportForm } from '../components/TransportForm';

/** «Nuevo Transporte» (doc 13), en pantalla propia desde Traslados. */
export const TransportFormPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const backTo = params.get('volver') || '/traslados';
  return (
    <div className="master-page theme-sky">
      <AppBar title="Nuevo Transporte" back={backTo} />
      <TransportForm onSaved={() => navigate(backTo, { replace: true })} />
    </div>
  );
};
