import { coordenadasValidas } from './mapas.js';

let ultimaUbicacion = null;
const MINUTO = 60000;
export const UBICACION_REQUERIDA = 'Activa tu ubicación en Cerca de mí para ver el recorrido.';

// Memoria de esta visita; nunca se guarda en localStorage ni en la base de datos.
export function recordarUbicacion(ubicacion) {
  if (!coordenadasValidas(ubicacion?.lat, ubicacion?.lng)) return null;
  ultimaUbicacion = { lat: Number(ubicacion.lat), lng: Number(ubicacion.lng),
    precision: Number.isFinite(ubicacion.precision) ? ubicacion.precision : null, obtenidaEn: Date.now() };
  return ultimaUbicacion;
}

export function obtenerUbicacionReciente() {
  return ultimaUbicacion && Date.now() - ultimaUbicacion.obtenidaEn < MINUTO ? ultimaUbicacion : null;
}

export async function obtenerUbicacionRuta({ origen, signal, navegador = globalThis.navigator } = {}) {
  signal?.throwIfAborted();
  if (!navegador?.geolocation) throw new Error('Tu navegador no soporta la geolocalización.');
  let permiso;
  try { permiso = await navegador.permissions?.query({ name: 'geolocation' }); } catch { /* Safari antiguo: se usa la autorización obtenida en esta visita. */ }
  signal?.throwIfAborted();
  const conocida = coordenadasValidas(origen?.lat, origen?.lng) || obtenerUbicacionReciente();
  if ((permiso && permiso.state !== 'granted') || (!permiso && !conocida)) throw new Error(UBICACION_REQUERIDA);

  return new Promise((resolve, reject) => {
    let terminada = false;
    const terminar = (error, value) => {
      if (terminada) return;
      terminada = true;
      signal?.removeEventListener('abort', cancelar);
      if (error) reject(error); else resolve(value);
    };
    const cancelar = () => terminar(new DOMException('Aborted', 'AbortError'));
    signal?.addEventListener('abort', cancelar, { once: true });
    if (signal?.aborted) { cancelar(); return; }
    navegador.geolocation.getCurrentPosition(
      (position) => {
        if (terminada) return;
        const punto = recordarUbicacion({ lat: position.coords.latitude, lng: position.coords.longitude, precision: position.coords.accuracy });
        terminar(punto ? null : new Error('No pudimos obtener tu ubicación. Revisa los permisos del navegador.'), punto);
      },
      (error) => terminar(new Error(error.code === 1 ? UBICACION_REQUERIDA : 'No pudimos obtener tu ubicación. Revisa los permisos del navegador.')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });
}
