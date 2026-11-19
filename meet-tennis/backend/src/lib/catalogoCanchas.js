import { readFileSync } from 'node:fs';

export const catalogoCanchas = JSON.parse(
  readFileSync(new URL('../../data/canchas.json', import.meta.url), 'utf8'),
);

export const nombresCanchasVigentes = catalogoCanchas.canchas.map((c) => c.nombre);

const normalizar = (nombre) => nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export function validarCatalogo(canchas = catalogoCanchas.canchas) {
  if (!Array.isArray(canchas) || canchas.length === 0) throw new Error('El catálogo está vacío.');
  const claves = new Set();
  const nombres = new Map();
  for (const cancha of canchas) {
    if (!cancha.clave || claves.has(cancha.clave)) throw new Error(`Clave duplicada: ${cancha.clave}`);
    claves.add(cancha.clave);
    if (!cancha.nombre?.trim() || !cancha.direccion?.includes(',') || !cancha.fuentes?.length || !cancha.ubicacionFuente) {
      throw new Error(`Falta nombre, dirección, comuna o fuente en ${cancha.clave}.`);
    }
    const porDireccion = cancha.mapaPorDireccion === true && cancha.latitud === null && cancha.longitud === null;
    if (!porDireccion && (!Number.isFinite(cancha.latitud) || !Number.isFinite(cancha.longitud) ||
        cancha.latitud < -34 || cancha.latitud > -33 || cancha.longitud < -71.1 || cancha.longitud > -70.3)) {
      throw new Error(`Ubicación sin verificar o fuera de Santiago: ${cancha.clave}`);
    }
    for (const nombre of [cancha.nombre, ...(cancha.alias || [])]) {
      const clave = normalizar(nombre);
      if (nombres.has(clave) && nombres.get(clave) !== cancha.clave) {
        throw new Error(`Nombre compartido por dos recintos: ${nombre}`);
      }
      nombres.set(clave, cancha.clave);
    }
  }
}

// Conserva los ID de recintos equivalentes. Nunca reutiliza un ID retirado
// para otra cancha: los partidos y disponibilidades mantienen su historial.
export function planificarCatalogo(actuales, canchas = catalogoCanchas.canchas) {
  validarCatalogo(canchas);
  const utilizados = new Set();
  let siguienteId = Math.max(0, ...actuales.map((c) => Number(c.id))) + 1;
  const altas = [];
  const cambios = [];
  const sinCambios = [];
  for (const cancha of canchas) {
    const nombres = new Set([cancha.nombre, ...(cancha.alias || [])].map(normalizar));
    const coincidencias = actuales.filter((c) => nombres.has(normalizar(c.nombre)));
    const actual = coincidencias.find((c) => c.nombre === cancha.nombre) || coincidencias[0];
    const datos = { nombre: cancha.nombre, direccion: cancha.direccion,
      latitud: cancha.latitud, longitud: cancha.longitud };
    if (!actual) {
      altas.push({ id: siguienteId++, ...datos });
      continue;
    }
    utilizados.add(actual.id);
    const distinto = (campo) => {
      if (actual[campo] === datos[campo]) return false;
      // PostgREST puede serializar el último decimal de double precision
      // con un redondeo distinto. Esta tolerancia es menor a 0,02 mm.
      if (['latitud', 'longitud'].includes(campo) && Number.isFinite(actual[campo]) && Number.isFinite(datos[campo])) {
        return Math.abs(actual[campo] - datos[campo]) > 1e-10;
      }
      return true;
    };
    if (Object.keys(datos).some(distinto)) {
      cambios.push({ antes: actual, despues: { id: actual.id, ...datos } });
    } else sinCambios.push(actual);
  }
  return { altas, cambios, sinCambios, retiradas: actuales.filter((c) => !utilizados.has(c.id)) };
}

export async function esCanchaVigente(db, id) {
  const { data, error } = await db.from('canchas').select('id')
    .eq('id', id).in('nombre', nombresCanchasVigentes).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
