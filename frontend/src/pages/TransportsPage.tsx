import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiSend } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/useResource';
import { toUserMessage } from '../lib/errors';
import { DTE_ROLES } from '../lib/nav';
import { prettyPlate, vehicleKind, vehicleTitle, VEHICLE_LABELS, type Vehicle } from '../lib/cargo';
import { Icon } from '../components/Icon';
import { AppBar } from '../components/Screen';
import { VehicleCard } from '../components/VehicleCard';
import { Button, EmptyState, Notice, Sheet, SkeletonList, SummaryList, useToast } from '../components/ui';
import { ResourceNotices } from '../components/ResourceNotices';

/**
 * Maestro «Traslados» (doc 13): los vehículos guardados que aparecen en el
 * paso 2 del asistente, y los accesos a DT-e y movimientos.
 */
export const TransportsPage = () => {
  const { user, canWrite } = useAuth();
  const toast = useToast();
  const [showInactive, setShowInactive] = useState(false);
  const vehicles = useResource<Vehicle[]>(`/vehicles${showInactive ? '?all=true' : ''}`);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const issues = Boolean(user && canWrite && DTE_ROLES.includes(user.role) && user.role !== 'AUDITOR');
  const list = vehicles.data ?? [];

  const toggleStatus = async (vehicle: Vehicle) => {
    setBusy(true);
    setFailure(null);
    const next = vehicle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await apiSend('PATCH', `/vehicles/${vehicle.id}`, { status: next }, {
        label: `${next === 'ACTIVE' ? 'Reactivar' : 'Dar de baja'} ${vehicle.plate}`,
        entity: '/vehicles',
      });
      toast({
        tone: 'success',
        title: next === 'ACTIVE' ? 'Vehículo reactivado' : 'Vehículo dado de baja',
        detail: next === 'ACTIVE' ? undefined : 'Ya no aparece al armar un DT-e. Lo podés reactivar.',
      });
      setSelected(null);
      vehicles.reload();
    } catch (cause) {
      setFailure(toUserMessage(cause, 'write').title);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="master-list">
      <AppBar title="Traslados" back="/carga" />

      <nav className="shortcut-row" aria-label="Accesos">
        {issues && (
          <Link to="/dte/nuevo" className="shortcut shortcut-primary">
            <Icon name="plus" size={22} />
            <span>Nuevo trámite DT-e</span>
          </Link>
        )}
        <Link to="/dte" className="shortcut">
          <Icon name="document" size={22} />
          <span>DT-e</span>
        </Link>
        <Link to="/movements" className="shortcut">
          <Icon name="route" size={22} />
          <span>Movimientos</span>
        </Link>
      </nav>

      <div className="master-group-title">
        <span>Vehículos guardados</span>
        <label className="toggle-inline">
          <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
          <span>Ver dados de baja</span>
        </label>
      </div>

      <ResourceNotices resource={vehicles} />
      {vehicles.loading && !vehicles.data && <SkeletonList rows={3} />}

      {!vehicles.loading && list.length === 0 && (
        <EmptyState
          icon="movements"
          title="Todavía no hay vehículos guardados"
          description="Guardá la camioneta o el camión con su conductor: al armar un DT-e se elige con un toque."
        />
      )}

      <div className="vehicle-list">
        {list.map((vehicle) => (
          <div key={vehicle.id} className={vehicle.status === 'ACTIVE' ? undefined : 'is-inactive'}>
            <VehicleCard vehicle={vehicle} mode="link" onClick={() => setSelected(vehicle)} />
          </div>
        ))}
      </div>

      {canWrite && (
        <Link to="/traslados/transporte/nuevo" className="add-card">
          <span className="add-card-icon" aria-hidden="true">
            <Icon name="plus" size={22} strokeWidth={2.6} />
          </span>
          Agregar nuevo transporte
        </Link>
      )}

      {selected && (
        <Sheet title={vehicleTitle(selected)} subtitle={prettyPlate(selected.plate)} onClose={() => setSelected(null)}>
          {failure && (
            <Notice tone="danger" title="No se pudo guardar">
              {failure}
            </Notice>
          )}
          <SummaryList
            rows={[
              { key: 'Tipo', value: VEHICLE_LABELS[vehicleKind(selected.type)] },
              { key: 'Patente', value: <span className="mono">{prettyPlate(selected.plate)}</span> },
              {
                key: 'Carro',
                value: selected.trailerPlate ? <span className="mono">{prettyPlate(selected.trailerPlate)}</span> : '—',
              },
              { key: 'Conductor', value: selected.driverName ?? '—' },
              { key: 'Estado', value: selected.status === 'ACTIVE' ? 'Activo' : 'Dado de baja' },
            ]}
          />
          {canWrite && (
            <div className="sheet-actions">
              <Button
                variant={selected.status === 'ACTIVE' ? 'danger' : 'primary'}
                busy={busy}
                onClick={() => void toggleStatus(selected)}
              >
                {selected.status === 'ACTIVE' ? 'Dar de baja' : 'Reactivar'}
              </Button>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
};
