import { Icon } from './Icon';
import { VehicleArt } from './Illustrations';
import { prettyPlate, vehicleKind, vehicleTitle, type Vehicle } from '../lib/cargo';

/**
 * Vehículo guardado, como en el paso 2 del asistente: dibujo, nombre,
 * patente y carro. Con `selected` funciona como opción de un grupo de radio.
 */
export const VehicleCard = ({
  vehicle,
  selected,
  onClick,
  mode = 'radio',
}: {
  vehicle: Vehicle;
  selected?: boolean;
  onClick: () => void;
  /** radio: se elige (asistente). link: abre la ficha (Traslados). */
  mode?: 'radio' | 'link';
}) => (
  <button
    type="button"
    className={selected ? 'vehicle-card selected' : 'vehicle-card'}
    onClick={onClick}
    {...(mode === 'radio' ? { role: 'radio', 'aria-checked': Boolean(selected) } : {})}
  >
    <span className="vehicle-card-art">
      <VehicleArt kind={vehicleKind(vehicle.type)} />
    </span>
    <span className="vehicle-card-text">
      <span className="vehicle-card-title">{vehicleTitle(vehicle)}</span>
      <span className="vehicle-card-line">Patente: {prettyPlate(vehicle.plate)}</span>
      <span className="vehicle-card-line">Carro: {vehicle.trailerPlate ? prettyPlate(vehicle.trailerPlate) : '-'}</span>
      {vehicle.driverName && <span className="vehicle-card-line faint">{vehicle.driverName}</span>}
    </span>
    {mode === 'radio' ? (
      <span className={selected ? 'radio-mark checked' : 'radio-mark'} aria-hidden="true">
        {selected && <Icon name="check" size={18} strokeWidth={3} />}
      </span>
    ) : (
      <Icon name="forward" size={22} className="master-row-chevron" />
    )}
  </button>
);
