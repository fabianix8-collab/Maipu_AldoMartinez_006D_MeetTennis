// Utilidades compartidas entre rutas.

// Fecha de hoy (YYYY-MM-DD) en hora de Chile, para no rechazar
// fechas de "hoy" por la diferencia con UTC.
export function hoyChile() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(
    new Date(),
  );
}

// Extrae la comuna desde la dirección de una cancha (última parte tras la coma).
export function extraerComuna(direccion) {
  if (!direccion) return null;
  const partes = direccion.split(',');
  const comuna = partes[partes.length - 1]?.trim();
  return comuna || null;
}

// Distancia en kilómetros entre dos coordenadas (fórmula de Haversine).
export function distanciaKm(lat1, lon1, lat2, lon2) {
  const RADIO_TIERRA = 6371;
  const aRad = (grados) => (grados * Math.PI) / 180;

  const dLat = aRad(lat2 - lat1);
  const dLon = aRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRad(lat1)) * Math.cos(aRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return 2 * RADIO_TIERRA * Math.asin(Math.sqrt(a));
}
