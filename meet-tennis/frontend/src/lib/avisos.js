import { referenciaPartido, SECCIONES_PARTIDOS } from './partidos.js';

const memoria = new Map();
const claveUsuario = (userId) => `meettennis_avisos_leidos:${userId}`;
const claveAviso = (aviso) => aviso.id && aviso.fecha ? JSON.stringify([aviso.id, aviso.fecha]) : null;

export function anclaAviso(aviso) {
  const fragmento = (aviso.destino || '').split('#')[1];
  return referenciaPartido(`#${fragmento || ''}`)?.ancla || null;
}

export function esAvisoSinLeer(aviso) {
  return aviso.tipo === 'accion' ? !aviso.visto : aviso.tipo === 'info' && Boolean(aviso.nuevo);
}

function categoriaAviso(aviso) {
  const [pathname, search] = (aviso.destino || '').split('#')[0].split('?');
  if (pathname === '/partidos') {
    const seccion = new URLSearchParams(search).get('seccion') || 'proximos';
    return Object.hasOwn(SECCIONES_PARTIDOS, seccion) ? SECCIONES_PARTIDOS[seccion].aviso : null;
  }
  return Object.values(SECCIONES_PARTIDOS).find((seccion) => seccion.ruta === pathname)?.aviso || null;
}

function leerVistos(userId) {
  const vistos = new Set(memoria.get(userId) || []);
  if (!userId) return vistos;
  try {
    const guardados = JSON.parse(globalThis.localStorage?.getItem(claveUsuario(userId)) || '[]');
    if (Array.isArray(guardados)) guardados.filter((id) => typeof id === 'string').forEach((id) => vistos.add(id));
  } catch { /* Mantiene la lectura en memoria si el almacenamiento no está disponible. */ }
  return vistos;
}

export function aplicarLecturas(data, userId) {
  const vistos = leerVistos(userId);
  const avisos = (data?.avisos || []).map((aviso) => {
    const visto = Boolean(aviso.visto || vistos.has(claveAviso(aviso)));
    return { ...aviso, visto, nuevo: visto ? false : aviso.nuevo };
  });
  const tarjetasSinLeer = { solicitudes: new Set(), proximos: new Set(), partidos: new Set() };
  for (const aviso of avisos) {
    if (!esAvisoSinLeer(aviso)) continue;
    const categoria = categoriaAviso(aviso);
    const ancla = anclaAviso(aviso);
    // Dos avisos sobre la misma tarjeta representan un solo elemento sin ver.
    if (categoria && ancla) tarjetasSinLeer[categoria].add(ancla);
  }
  return {
    ...data,
    avisos,
    noLeidos: avisos.filter(esAvisoSinLeer).length,
    sinLeer: Object.fromEntries(Object.entries(tarjetasSinLeer).map(([categoria, tarjetas]) => [categoria, tarjetas.size])),
  };
}

export function marcarAvisosLeidos(userId, avisos) {
  if (!userId) return;
  const vistos = leerVistos(userId);
  for (const aviso of avisos) {
    const clave = claveAviso(aviso);
    if (esAvisoSinLeer(aviso) && clave) vistos.add(clave);
  }
  // La API conserva como máximo 20 novedades de los últimos 30 días.
  const guardados = [...vistos].slice(-500);
  memoria.set(userId, guardados);
  try { globalThis.localStorage?.setItem(claveUsuario(userId), JSON.stringify(guardados)); }
  catch { /* La lectura sigue vigente durante esta sesión. */ }
}
