import { Suspense, lazy, type ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { RoleRoute } from './components/RoleRoute';
import { Logo } from './components/Icon';
import { SkeletonList } from './components/ui';
import { LoginPage } from './pages/LoginPage';
import type { UserRole } from './lib/types';

/**
 * Cada pantalla viaja en su propio paquete.
 *
 * En una aplicación pensada para el campo, con conexiones lentas, hacer que la
 * primera carga arrastre las quince pantallas es tiempo de espera que nadie
 * pidio. El inicio de sesión no se difiere: es lo primero que se ve.
 */
const page = <T extends Record<string, ComponentType<object>>>(
  loader: () => Promise<T>,
  name: keyof T,
) => lazy(() => loader().then((module) => ({ default: module[name] })));

const DashboardPage = page(() => import('./pages/DashboardPage'), 'DashboardPage');
const ProducersPage = page(() => import('./pages/ProducersPage'), 'ProducersPage');
const EstablishmentsPage = page(() => import('./pages/EstablishmentsPage'), 'EstablishmentsPage');
const ApiariesPage = page(() => import('./pages/ApiariesPage'), 'ApiariesPage');
const MovementsPage = page(() => import('./pages/MovementsPage'), 'MovementsPage');
const MovementDetailPage = page(() => import('./pages/MovementDetailPage'), 'MovementDetailPage');
const ExtractionsPage = page(() => import('./pages/ExtractionsPage'), 'ExtractionsPage');
const LotsPage = page(() => import('./pages/LotsPage'), 'LotsPage');
const LotDetailPage = page(() => import('./pages/LotDetailPage'), 'LotDetailPage');
const DrumsPage = page(() => import('./pages/DrumsPage'), 'DrumsPage');
const TracePage = page(() => import('./pages/TracePage'), 'TracePage');
const AuditPage = page(() => import('./pages/AuditPage'), 'AuditPage');
const RulesPage = page(() => import('./pages/RulesPage'), 'RulesPage');
const PendingPage = page(() => import('./pages/PendingPage'), 'PendingPage');

const OPERATION_ROLES: UserRole[] = [
  'ADMIN',
  'PRODUCTOR',
  'SALA',
  'ACOPIADOR',
  'FRACCIONADOR',
  'TRANSPORTISTA',
  'AUDITOR',
];
const LOT_ROLES: UserRole[] = ['ADMIN', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'LABORATORIO', 'AUDITOR'];

const Booting = () => (
  <div style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', gap: 'var(--sp-4)' }}>
    <Logo size={44} />
    <span className="small muted" role="status">
      Abriendo ApiTrace…
    </span>
  </div>
);

export const App = () => {
  const { user, ready } = useAuth();

  if (!ready) return <Booting />;

  return (
    <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route element={user ? <Layout /> : <Navigate to="/login" replace />}>
          <Route
            index
            element={
              <Suspense fallback={<SkeletonList rows={4} />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route
            path="producers"
            element={
              <RoleRoute allowedRoles={['ADMIN', 'PRODUCTOR', 'AUDITOR']}>
                <Suspense fallback={<SkeletonList />}>
                  <ProducersPage />
                </Suspense>
              </RoleRoute>
            }
          />
          <Route
            path="establishments"
            element={
              <RoleRoute
                allowedRoles={['ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'AUDITOR']}
              >
                <Suspense fallback={<SkeletonList />}>
                  <EstablishmentsPage />
                </Suspense>
              </RoleRoute>
            }
          />
          <Route
            path="apiaries"
            element={
              <RoleRoute allowedRoles={['ADMIN', 'PRODUCTOR', 'AUDITOR']}>
                <Suspense fallback={<SkeletonList />}>
                  <ApiariesPage />
                </Suspense>
              </RoleRoute>
            }
          />
          <Route
            path="movements"
            element={
              <RoleRoute allowedRoles={OPERATION_ROLES}>
                <Suspense fallback={<SkeletonList />}>
                  <MovementsPage />
                </Suspense>
              </RoleRoute>
            }
          />
          <Route
            path="movements/:id"
            element={
              <RoleRoute allowedRoles={OPERATION_ROLES}>
                <Suspense fallback={<SkeletonList />}>
                  <MovementDetailPage />
                </Suspense>
              </RoleRoute>
            }
          />
          <Route
            path="extractions"
            element={
              <RoleRoute allowedRoles={['ADMIN', 'SALA', 'ACOPIADOR', 'AUDITOR']}>
                <Suspense fallback={<SkeletonList />}>
                  <ExtractionsPage />
                </Suspense>
              </RoleRoute>
            }
          />
          <Route
            path="lots"
            element={
              <RoleRoute allowedRoles={LOT_ROLES}>
                <Suspense fallback={<SkeletonList />}>
                  <LotsPage />
                </Suspense>
              </RoleRoute>
            }
          />
          <Route
            path="lots/:id"
            element={
              <RoleRoute allowedRoles={LOT_ROLES}>
                <Suspense fallback={<SkeletonList />}>
                  <LotDetailPage />
                </Suspense>
              </RoleRoute>
            }
          />
          <Route
            path="drums"
            element={
              <RoleRoute
                allowedRoles={['ADMIN', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'EXPORTADOR', 'AUDITOR']}
              >
                <Suspense fallback={<SkeletonList />}>
                  <DrumsPage />
                </Suspense>
              </RoleRoute>
            }
          />
          <Route
            path="trace"
            element={
              <Suspense fallback={<SkeletonList />}>
                <TracePage />
              </Suspense>
            }
          />
          <Route
            path="trace/:direction/:entityType/:id"
            element={
              <Suspense fallback={<SkeletonList />}>
                <TracePage />
              </Suspense>
            }
          />
          <Route
            path="rules"
            element={
              <RoleRoute allowedRoles={['ADMIN', 'AUDITOR']}>
                <Suspense fallback={<SkeletonList />}>
                  <RulesPage />
                </Suspense>
              </RoleRoute>
            }
          />
          <Route
            path="audit"
            element={
              <RoleRoute allowedRoles={['ADMIN', 'AUDITOR']}>
                <Suspense fallback={<SkeletonList />}>
                  <AuditPage />
                </Suspense>
              </RoleRoute>
            }
          />
          <Route
            path="pending"
            element={
              <Suspense fallback={<SkeletonList />}>
                <PendingPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
    </Routes>
  );
};
