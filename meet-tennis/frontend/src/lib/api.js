const AUTH_KEY = 'meettennis_auth';

function getStoredAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
  } catch {
    return null;
  }
}

function cerrarSesion() {
  localStorage.removeItem(AUTH_KEY);
  window.location.assign('/login');
}

// Pide al backend una sesión nueva usando el refresh token guardado.
async function renovarSesion() {
  const stored = getStoredAuth();
  const refreshToken = stored?.session?.refresh_token;
  if (!refreshToken) return false;

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) return false;

    localStorage.setItem(
      AUTH_KEY,
      JSON.stringify({ ...stored, session: result.data.session }),
    );
    return true;
  } catch {
    return false;
  }
}

function conToken(options) {
  const token = getStoredAuth()?.session?.access_token;
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return { ...options, headers };
}

// fetch para rutas que requieren sesión: agrega el token y, si expiró,
// lo renueva una vez y reintenta. Si no se puede, cierra la sesión.
export async function apiFetch(url, options = {}) {
  let response = await fetch(url, conToken(options));

  if (response.status === 401) {
    const renovada = await renovarSesion();
    if (!renovada) {
      cerrarSesion();
      return response;
    }
    response = await fetch(url, conToken(options));
  }

  return response;
}
