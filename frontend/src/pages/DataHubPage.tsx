import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useResource } from '../lib/useResource';
import { hubItemsFor } from '../lib/hub';
import { Icon } from '../components/Icon';
import { HeroIcon } from '../components/Illustrations';
import { AppBar } from '../components/Screen';
import { FormHero } from '../components/MasterForm';
import type { Apiary, Paginated } from '../lib/types';

/**
 * «Carga de datos» (doc 13 y 14): la puerta de entrada a los maestros. Cada
 * opción lleva al listado de ese maestro, con su alta a un toque.
 */
export const DataHubPage = () => {
  const { user } = useAuth();
  const role = user?.role;
  const seesApiaries = role === 'ADMIN' || role === 'PRODUCTOR' || role === 'AUDITOR';
  const apiaries = useResource<Paginated<Apiary>>(seesApiaries ? '/apiaries?pageSize=1' : null);
  const total = apiaries.data?.meta.total ?? 0;
  const visible = hubItemsFor(role, total);

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
