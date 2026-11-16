import { Navigate } from 'react-router-dom';

function getStoredAuth() {
  try {
    return JSON.parse(localStorage.getItem('meettennis_auth') || 'null');
  } catch {
    return null;
  }
}

// Solo protege rutas: si no hay sesión guardada (o está corrupta, sin
// access token) redirige al login. La expiración del token la maneja
// apiFetch: renueva con el refresh token y solo cierra sesión si el
// refresh falla, así no se fuerza un login innecesario.
function ProtectedRoute({ children }) {
  const stored = getStoredAuth();

  if (!stored?.session?.access_token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
