// Utilidades de formato compartidas entre pantallas.
import { getLocale, translate } from './i18n.js';

// Fecha de hoy en formato YYYY-MM-DD respetando la zona horaria local.
export function hoyISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

// "2026-10-10" → "10/10/2026".
export function formatFecha(fecha) {
  if (!fecha) return translate('Sin fecha');
  const [anio, mes, dia] = String(fecha).split('-');
  if (!anio || !mes || !dia) return fecha;
  return new Intl.DateTimeFormat(getLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(`${anio}-${mes}-${dia.slice(0, 2)}T12:00:00`));
}

export function iniciales(nombre, apellido) {
  const primera = (nombre || '').trim().charAt(0);
  const segunda = (apellido || '').trim().charAt(0);
  return `${primera}${segunda}`.toUpperCase() || '?';
}

export function nombreCompleto(jugador) {
  return `${jugador?.nombre || ''} ${jugador?.apellido || ''}`.trim() || translate('Jugador');
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

// Tiempo transcurrido legible: "recién", "hace 5 min", "hace 2 h", "hace 3 días".
export function haceCuanto(fecha) {
  const minutos = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
  if (minutos < 1) return translate('recién');
  if (minutos < 60) return translate('hace {0} min', { 0: minutos });
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return translate('hace {0} h', { 0: horas });
  const dias = Math.floor(horas / 24);
  return translate(dias === 1 ? 'hace {0} día' : 'hace {0} días', { 0: dias });
}
