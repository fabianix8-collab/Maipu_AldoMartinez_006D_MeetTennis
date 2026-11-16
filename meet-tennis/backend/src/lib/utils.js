// Utilidades compartidas entre rutas.

// Fecha de hoy (YYYY-MM-DD) en hora de Chile, para no rechazar
// fechas de "hoy" por la diferencia con UTC.
export function hoyChile() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(
    new Date(),
  );
}

// Suma días a una fecha "YYYY-MM-DD" (sin zona horaria de por medio).
export function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// "hoy" o "mañana" si el partido cae dentro de la ventana para
// confirmar asistencia; null en cualquier otro caso.
export function ventanaAsistencia(fecha, hoy = hoyChile()) {
  if (fecha === hoy) return 'hoy';
  if (fecha === sumarDias(hoy, 1)) return 'mañana';
  return null;
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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Valida un id de usuario antes de usarlo en consultas o filtros.
export function esUuid(valor) {
  return typeof valor === 'string' && UUID_REGEX.test(valor);
}

// Tamaño máximo de un avatar subido (5 MB).
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

// Valida el contenido real de un archivo de imagen por sus "magic bytes",
// no solo por el mimetype declarado (que el cliente puede falsear).
// Soporta JPEG, PNG, GIF, WebP y SVG.
export function esImagenValida(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;

  const b = buffer;
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return true;
  }
  // GIF: "GIF8"
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return true;
  // WebP: "RIFF" .... "WEBP"
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return true;
  }
  // SVG: texto que empieza con "<svg" o "<?xml" (con espacios/BOM tolerados).
  const inicio = buffer.subarray(0, 256).toString('utf8').replace(/^\uFEFF/, '').trimStart();
  if (inicio.startsWith('<svg') || inicio.startsWith('<?xml')) return true;

  return false;
}
