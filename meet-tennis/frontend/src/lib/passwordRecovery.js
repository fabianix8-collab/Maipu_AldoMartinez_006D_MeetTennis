export const RECOVERY_SESSION_KEY = 'meettennis_recovery';
let memoria = null;

export function borrarSesionRecuperacion(entorno = globalThis.window) {
  memoria = null;
  try { entorno?.sessionStorage.removeItem(RECOVERY_SESSION_KEY); } catch { /* Solo memoria. */ }
}

function sesionValida(sesion, ahora) {
  return sesion && typeof sesion.access_token === 'string' && sesion.access_token.length > 0 && sesion.access_token.length <= 16384 &&
    typeof sesion.refresh_token === 'string' && sesion.refresh_token.length > 0 && sesion.refresh_token.length <= 16384 &&
    Number.isFinite(sesion.expiresAt) && sesion.expiresAt > ahora;
}

// Supabase devuelve las credenciales en el fragmento. Se quitan de la URL y
// se mantienen solo en esta pestaña; nunca se mezclan con meettennis_auth.
export function leerSesionRecuperacion(entorno = globalThis.window, ahora = Date.now()) {
  if (!entorno) return null;
  const params = new URLSearchParams(entorno.location.hash.slice(1));
  const contieneEnlace = ['access_token', 'refresh_token', 'type', 'error', 'error_code', 'error_description'].some((key) => params.has(key));
  if (contieneEnlace) {
    borrarSesionRecuperacion(entorno);
    entorno.history.replaceState(entorno.history.state, '', entorno.location.pathname + entorno.location.search);
    if (params.get('type') !== 'recovery' || params.has('error') || params.has('error_code')) return null;
    const duracion = Number(params.get('expires_in') || 3600);
    const sesion = {
      access_token: params.get('access_token'),
      refresh_token: params.get('refresh_token'),
      expiresAt: ahora + Math.min(duracion, 3600) * 1000,
    };
    if (!sesionValida(sesion, ahora)) return null;
    memoria = sesion;
    try { entorno.sessionStorage.setItem(RECOVERY_SESSION_KEY, JSON.stringify(sesion)); } catch { /* Solo memoria. */ }
    return sesion;
  }
  let guardada = memoria;
  try { guardada = JSON.parse(entorno.sessionStorage.getItem(RECOVERY_SESSION_KEY) || 'null') || guardada; } catch { /* Solo memoria. */ }
  if (!sesionValida(guardada, ahora)) {
    borrarSesionRecuperacion(entorno);
    return null;
  }
  memoria = guardada;
  return guardada;
}
