import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { useLanguage } from './lib/i18n.js';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { rutaPartidos, SECCIONES_PARTIDOS } from './lib/partidos.js';

const LoginView = lazy(() => import('./pages/LoginView.jsx'));
const RegisterView = lazy(() => import('./pages/RegisterView.jsx'));
const PasswordRecoveryView = lazy(() => import('./pages/PasswordRecoveryView.jsx'));
const DashboardView = lazy(() => import('./pages/DashboardView.jsx'));
const AvailabilityView = lazy(() => import('./pages/AvailabilityView.jsx'));
const CourtsView = lazy(() => import('./pages/CourtsView.jsx'));
const MatchmakingView = lazy(() => import('./pages/MatchmakingView.jsx'));
const MisPartidosView = lazy(() => import('./pages/MisPartidosView.jsx'));
const ProfileView = lazy(() => import('./pages/ProfileView.jsx'));
const RankingView = lazy(() => import('./pages/RankingView.jsx'));
const ResenasView = lazy(() => import('./pages/ResenasView.jsx'));
const ChatView = lazy(() => import('./pages/ChatView.jsx'));
const ProductosView = lazy(() => import('./pages/ProductosView.jsx'));
const MonitoreoView = lazy(() => import('./pages/MonitoreoView.jsx'));
const AdminUsuariosView = lazy(() => import('./pages/AdminUsuariosView.jsx'));

function PartidosPage() {
  const [searchParams] = useSearchParams();
  const elegida = searchParams.get('seccion');
  const seccion = Object.hasOwn(SECCIONES_PARTIDOS, elegida) ? elegida : 'proximos';
  return <MisPartidosView seccion={seccion} />;
}

// Conserva los enlaces de avisos y los formularios precargados anteriores.
function PartidosRedirect({ seccion }) {
  const { search, hash } = useLocation();
  return <Navigate to={rutaPartidos(seccion, search, hash)} replace />;
}

// Supabase puede volver a la Site URL si aún no se autorizó el destino
// específico. Conserva el enlace de recuperación antes de proteger el inicio.
function RecoveryEntry({ children }) {
  const { pathname, hash } = useLocation();
  const params = new URLSearchParams(hash.slice(1));
  const recuperacion = params.get('type') === 'recovery' || (params.has('error') && params.has('error_description'));
  if (recuperacion && pathname !== '/restablecer-contrasena') {
    return <Navigate to={`/restablecer-contrasena${hash}`} replace />;
  }
  return children;
}

function App() {
  const { t } = useLanguage();
  return (
    <BrowserRouter>
      <RecoveryEntry>
      <Suspense fallback={<p role="status" className="min-h-dvh bg-slate-900 p-8 text-center text-slate-300">{t('Cargando...')}</p>}>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/buscar-partido"
          element={
            <ProtectedRoute>
              <MatchmakingView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/partidos"
          element={<ProtectedRoute><PartidosPage /></ProtectedRoute>}
        />
        <Route
          path="/solicitudes"
          element={<PartidosRedirect seccion="solicitudes" />}
        />
        <Route
          path="/proximos-partidos"
          element={<PartidosRedirect seccion="proximos" />}
        />
        <Route
          path="/mis-partidos"
          element={<PartidosRedirect seccion="resultados" />}
        />
        <Route
          path="/disponibilidad"
          element={
            <ProtectedRoute>
              <AvailabilityView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/canchas"
          element={
            <ProtectedRoute>
              <CourtsView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/perfil"
          element={
            <ProtectedRoute>
              <ProfileView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ranking"
          element={
            <ProtectedRoute>
              <RankingView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/resenas"
          element={
            <ProtectedRoute>
              <ResenasView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/productos"
          element={
            <ProtectedRoute>
              <ProductosView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/monitoreo"
          element={
            <ProtectedRoute>
              <MonitoreoView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-usuarios"
          element={
            <ProtectedRoute>
              <AdminUsuariosView />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<LoginView />} />
        <Route path="/register" element={<RegisterView />} />
        <Route path="/recuperar-contrasena" element={<PasswordRecoveryView key="request" />} />
        <Route path="/restablecer-contrasena" element={<PasswordRecoveryView key="reset" mode="reset" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      </RecoveryEntry>
    </BrowserRouter>
  );
}

export default App;
