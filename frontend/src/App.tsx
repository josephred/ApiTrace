import { Suspense, lazy, type ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { FocusLayout } from './components/Screen';
import { RoleRoute } from './components/RoleRoute';
import { Logo } from './components/Icon';
import { SkeletonList } from './components/ui';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
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
const DtePage = page(() => import('./pages/DtePage'), 'DtePage');
const DteDetailPage = page(() => import('./pages/DteDetailPage'), 'DteDetailPage');
const ExtractionsPage = page(() => import('./pages/ExtractionsPage'), 'ExtractionsPage');
const LotsPage = page(() => import('./pages/LotsPage'), 'LotsPage');
const LotDetailPage = page(() => import('./pages/LotDetailPage'), 'LotDetailPage');
const DrumsPage = page(() => import('./pages/DrumsPage'), 'DrumsPage');
const TracePage = page(() => import('./pages/TracePage'), 'TracePage');
const AuditPage = page(() => import('./pages/AuditPage'), 'AuditPage');
const RulesPage = page(() => import('./pages/RulesPage'), 'RulesPage');
const PendingPage = page(() => import('./pages/PendingPage'), 'PendingPage');
const SettingsPage = page(() => import('./pages/SettingsPage'), 'SettingsPage');
// Rediseño (doc 13)
const DataHubPage = page(() => import('./pages/DataHubPage'), 'DataHubPage');
const ApiaryFormPage = page(() => import('./pages/ApiaryFormPage'), 'ApiaryFormPage');
const SalasPage = page(() => import('./pages/SalasPage'), 'SalasPage');
const SalaFormPage = page(() => import('./pages/SalaFormPage'), 'SalaFormPage');
const TransportsPage = page(() => import('./pages/TransportsPage'), 'TransportsPage');
const TransportFormPage = page(() => import('./pages/TransportFormPage'), 'TransportFormPage');
const DteNewPage = page(() => import('./pages/DteNewPage'), 'DteNewPage');
const MapPage = page(() => import('./pages/MapPage'), 'MapPage');

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
const DTE_ROLES: UserRole[] = ['ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'AUDITOR'];
/** Arman trámites quienes despachan; el auditor solo consulta. */
const DTE_ISSUERS: UserRole[] = ['ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'FRACCIONADOR'];
const MASTER_WRITERS: UserRole[] = ['ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'TRANSPORTISTA'];
const HUB_ROLES: UserRole[] = [...MASTER_WRITERS, 'AUDITOR'];
const SALA_ROLES: UserRole[] = ['ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'FRACCIONADOR', 'AUDITOR'];

/** Pantalla de arranque: la marca, como el splash del prototipo ApiAsistente. */
const Booting = () => (
  <div className="boot">
    <span className="boot-logo">
      <Logo size={64} />
    </span>
    <span className="boot-name">ApiTrace</span>
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
        <Route path="/registro" element={user ? <Navigate to="/" replace /> : <RegisterPage />} />

        {/* Pantallas de foco: altas y asistente, sin barra inferior (doc 13). */}
        <Route element={user ? <FocusLayout /> : <Navigate to="/login" replace />}>
          <Route
            path="apiaries/nuevo"
            element={
              <RoleRoute allowedRoles={['ADMIN', 'PRODUCTOR']}>
                <Suspense fallback={<SkeletonList />}>
                  <ApiaryFormPage />
                </Suspense>
              </RoleRoute>
            }
          />
          <Route
            path="salas/:kind/nueva"
            element={
              <RoleRoute allowedRoles={['ADMIN', 'PRODUCTOR', 'SALA', 'ACOPIADOR', 'FRACCIONADOR']}>
                <Suspense fallback={<SkeletonList />}>
                  <SalaFormPage />
                </Suspense>
              </RoleRoute>
            }
          />
          <Route
            path="traslados/transporte/nuevo"
            element={
              <RoleRoute allowedRoles={MASTER_WRITERS}>
                <Suspense fallback={<SkeletonList />}>
                  <TransportFormPage />
                </Suspense>
              </RoleRoute>
            }
          />
          <Route
            path="dte/nuevo"
            element={
              <RoleRoute allowedRoles={DTE_ISSUERS}>
                <Suspense fallback={<SkeletonList />}>
                  <DteNewPage />
                </Suspense>
              </RoleRoute>
            }
          />
        </Route>

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
            path="mapa"
            element={
              <Suspense fallback={<SkeletonList />}>
                <MapPage />
              </Suspense>
            }
          />
          <Route
            path="carga"
            element={
              <RoleRoute allowedRoles={HUB_ROLES}>
                <Suspense fallback={<SkeletonList />}>
                  <DataHubPage />
                </Suspense>
              </RoleRoute>
            }
          />
          <Route
            path="salas/:kind"
            element={
              <RoleRoute allowedRoles={SALA_ROLES}>
                <Suspense fallback={<SkeletonList />}>
                  <SalasPage />
                </Suspense>
              </RoleRoute>
            }
          />
          <Route
            path="traslados"
            element={
              <RoleRoute allowedRoles={HUB_ROLES}>
                <Suspense fallback={<SkeletonList />}>
                  <TransportsPage />
                </Suspense>
              </RoleRoute>
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
            path="dte"
            element={
              <RoleRoute allowedRoles={DTE_ROLES}>
                <Suspense fallback={<SkeletonList />}>
                  <DtePage />
                </Suspense>
              </RoleRoute>
            }
          />
          <Route
            path="dte/:id"
            element={
              <RoleRoute allowedRoles={DTE_ROLES}>
                <Suspense fallback={<SkeletonList />}>
                  <DteDetailPage />
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
          <Route
            path="settings"
            element={
              <Suspense fallback={<SkeletonList rows={4} />}>
                <SettingsPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
    </Routes>
  );
};
