import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { roleLabel } from '../lib/vocabulary';
import type { UserRole } from '../lib/types';
import { ButtonLink, Card, EmptyState } from './ui';

/**
 * Antes, entrar a una sección sin permiso redirigia al panel sin decir nada:
 * el usuario tocaba un enlace y «no pasaba nada». Ahora se explica que hace
 * falta y con qué rol, y se ofrece una salida.
 */
const AccessDenied = ({ allowedRoles, role }: { allowedRoles: UserRole[]; role: UserRole }) => (
  <Card>
    <EmptyState
      icon="lock"
      title="Esta sección no está disponible para tu rol"
      description={`Entraste como ${roleLabel(role)}. Pueden verla: ${allowedRoles
        .map(roleLabel)
        .join(', ')}.`}
      action={
        <ButtonLink to="/" variant="primary" icon="dashboard">
          Ir al panel
        </ButtonLink>
      }
    />
  </Card>
);

export const RoleRoute = ({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children?: ReactNode;
}) => {
  const { user, ready } = useAuth();

  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;

  const isAllowed = user.role === 'ADMIN' || allowedRoles.includes(user.role);
  if (!isAllowed) return <AccessDenied allowedRoles={allowedRoles} role={user.role} />;

  return children ? <>{children}</> : <Outlet />;
};
