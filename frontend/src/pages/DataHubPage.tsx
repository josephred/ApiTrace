import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/useResource';
import { Icon } from '../components/Icon';
import { HeroIcon, type HeroIconName } from '../components/Illustrations';
import { AppBar } from '../components/Screen';
import { FormHero } from '../components/MasterForm';
import type { Apiary, Paginated, UserRole } from '../lib/types';

interface HubItem {
  to: string;
  icon: HeroIconName;
  title: string;
  detail: string;
  roles: UserRole[];
}

/**
 * «Carga de datos» (doc 13): la puerta de entrada a los maestros. Cada opción
 * lleva al listado de ese maestro, con su alta a un toque.
 */
export const DataHubPage = () => {
  const { user } = useAuth();
  const role = user?.role;
  const seesApiaries = role === 'ADMIN' || role === 'PRODUCTOR' || role === 'AUDITOR';
  const apiaries = useResource<Paginated<Apiary>>(seesApiaries ? '/apiaries?pageSize=1' : null);
  const total = apiaries.data?.meta.total ?? 0;

  const items: HubItem[] = [
    {
      to: '/apiaries',
      icon: 'hivePlus',
      title: 'Apiarios',
      detail: total > 0 ? `Cargá tus ${total} apiarios por zona` : 'Cargá tus apiarios por zona',
      roles: ['ADMIN', 'PRODUCTOR', 'AUDITOR'],
    },
    {
      to: '/salas/extraccion',
      icon: 'databasePlus',
      title: 'Sala de extracción',
      detail: 'Registro de tambores y ingreso a SITA',
      roles: ['ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'AUDITOR'],
    },
    {
      to: '/salas/fraccionamiento',
      icon: 'jarPlus',
      title: 'Sala de fraccionamiento',
      detail: 'Registro de frascos, lotes y productos',
      roles: ['ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'AUDITOR'],
    },
    {
      to: '/traslados',
      icon: 'truckPlus',
      title: 'Traslados',
      detail: 'DT-e y movimientos',
      roles: ['ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'TRANSPORTISTA', 'AUDITOR'],
    },
  ];
  const visible = items.filter((item) => role && (role === 'ADMIN' || item.roles.includes(role)));

  return (
    <div className="hub">
      <AppBar title="Carga de datos" back="/" />
      <FormHero
        icon="databasePlus"
        title="Seleccioná qué cargar"
        subtitle="Elegí la opción para registrar información en la plataforma."
      />
      <ol className="hub-list">
        {visible.map((item, index) => (
          <li key={item.to}>
            <Link to={item.to} className="hub-item">
              <span className="hub-item-icon">
                <HeroIcon name={item.icon} size={48} />
              </span>
              <span className="hub-item-text">
                <span className="hub-item-title">
                  {index + 1}. {item.title}
                </span>
                <span className="hub-item-detail">{item.detail}</span>
              </span>
              <Icon name="forward" size={26} strokeWidth={2.2} className="hub-item-chevron" />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
};
