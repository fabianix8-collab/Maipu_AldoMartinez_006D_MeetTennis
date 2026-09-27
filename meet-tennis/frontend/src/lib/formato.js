// Utilidades de formato compartidas entre pantallas.

// Fecha de hoy en formato YYYY-MM-DD respetando la zona horaria local.
export function hoyISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

// "2026-10-10" → "10/10/2026".
export function formatFecha(fecha) {
  if (!fecha) return 'Sin fecha';
  const [anio, mes, dia] = String(fecha).split('-');
  if (!anio || !mes || !dia) return fecha;
  return `${dia}/${mes}/${anio}`;
}

export function iniciales(nombre, apellido) {
  const primera = (nombre || '').trim().charAt(0);
  const segunda = (apellido || '').trim().charAt(0);
  return `${primera}${segunda}`.toUpperCase() || '?';
}

export function nombreCompleto(jugador) {
  return `${jugador?.nombre || ''} ${jugador?.apellido || ''}`.trim() || 'Jugador';
}

// "+25 pts" / "-15 pts".
export function formatPuntos(puntos) {
  return `${puntos > 0 ? '+' : ''}${puntos} pts`;
}

export function getStoredAuth() {
  try {
    return JSON.parse(localStorage.getItem('meettennis_auth') || 'null');
  } catch {
    return null;
  }
}
