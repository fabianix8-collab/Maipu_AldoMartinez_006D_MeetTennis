import { coordenadasValidas } from './mapas.js';

const SERVIDORES = {
  auto: import.meta.env?.VITE_ROUTING_CAR_URL || 'https://routing.openstreetmap.de/routed-car',
  pie: import.meta.env?.VITE_ROUTING_WALK_URL || 'https://routing.openstreetmap.de/routed-foot',
};
const cache = new Map();
let cola = Promise.resolve();
let ultimoInicio = 0;

export function crearUrlRuta(origen, cancha, modo = 'auto') {
  if (!coordenadasValidas(origen?.lat, origen?.lng)) throw new Error('Activa tu ubicación en Cerca de mí para ver el recorrido.');
  if (!coordenadasValidas(cancha?.latitud, cancha?.longitud) || cancha.mapaPorDireccion) {
    throw new Error('Esta cancha aún no tiene coordenadas verificadas para calcular un recorrido.');
  }
  if (!Object.hasOwn(SERVIDORES, modo)) throw new Error('Medio de transporte no válido.');
  const puntos = `${Number(origen.lng)},${Number(origen.lat)};${Number(cancha.longitud)},${Number(cancha.latitud)}`;
  return `${SERVIDORES[modo].replace(/\/$/, '')}/route/v1/driving/${puntos}?overview=full&geometries=geojson&steps=true`;
}

export function interpretarRuta(data) {
  const ruta = data?.routes?.[0];
  if (data?.code !== 'Ok' || ruta?.geometry?.type !== 'LineString' || !Array.isArray(ruta.geometry.coordinates) || ruta.geometry.coordinates.length < 2 ||
    !Number.isFinite(ruta.distance) || ruta.distance < 0 || !Number.isFinite(ruta.duration) || ruta.duration < 0 ||
    !ruta.geometry.coordinates.every((p) => Array.isArray(p) && coordenadasValidas(p[1], p[0]))) {
    throw new Error('No encontramos un recorrido por calles para esta cancha.');
  }
  return { distancia: ruta.distance, duracion: ruta.duration,
    puntos: ruta.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    pasos: (ruta.legs || []).flatMap((leg) => leg.steps || []).map((step) => ({
      calle: typeof step.name === 'string' ? step.name : '', distancia: step.distance,
      tipo: step.maneuver?.type, giro: step.maneuver?.modifier, salida: step.maneuver?.exit,
    })) };
}

export function cargarRuta(origen, cancha, modo, { signal } = {}) {
  const url = crearUrlRuta(origen, cancha, modo);
  const guardada = cache.get(url);
  if (guardada && Date.now() - guardada.fecha < 300000) return Promise.resolve(guardada.ruta);
  // El servicio público admite una consulta por segundo; no se precargan rutas.
  const tarea = cola.catch(() => {}).then(async () => {
    signal?.throwIfAborted();
    const espera = Math.max(0, 1100 - (Date.now() - ultimoInicio));
    if (espera) await new Promise((resolve) => setTimeout(resolve, espera));
    signal?.throwIfAborted();
    ultimoInicio = Date.now();
    const controller = new AbortController();
    const cancelar = () => controller.abort();
    signal?.addEventListener('abort', cancelar, { once: true });
    const timeout = setTimeout(() => controller.abort(), 18000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error('No se pudo calcular el recorrido. Inténtalo de nuevo.');
      const ruta = interpretarRuta(await res.json());
      if (cache.size >= 20) cache.delete(cache.keys().next().value);
      cache.set(url, { ruta, fecha: Date.now() });
      return ruta;
    } catch (error) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (error.name === 'AbortError' || error instanceof TypeError || error instanceof SyntaxError) throw new Error('No se pudo calcular el recorrido. Inténtalo de nuevo.');
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', cancelar);
    }
  });
  cola = tarea;
  return tarea;
}

export function indicacionRuta(paso, t) {
  const giros = {
    left: 'Gira a la izquierda', right: 'Gira a la derecha',
    'slight left': 'Mantente a la izquierda', 'slight right': 'Mantente a la derecha',
    'sharp left': 'Gira pronunciadamente a la izquierda', 'sharp right': 'Gira pronunciadamente a la derecha',
    uturn: 'Da la vuelta',
  };
  if (paso.tipo === 'arrive') return t('Llegaste a la cancha');
  if (['roundabout', 'rotary'].includes(paso.tipo) && paso.salida) return t('En la rotonda, toma la salida {0}', { 0: paso.salida });
  const accion = paso.tipo === 'depart' ? t('Inicia el recorrido') : t(giros[paso.giro] || 'Continúa');
  return paso.calle ? `${accion} · ${paso.calle}` : accion;
}
