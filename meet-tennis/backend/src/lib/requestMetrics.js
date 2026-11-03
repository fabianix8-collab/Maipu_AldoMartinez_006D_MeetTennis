// ==========================================================
// Métricas técnicas en memoria del backend.
// ==========================================================
// Registra en vivo cada petición que pasa por Express (sin
// infraestructura extra) y entrega un resumen listo para el panel
// de monitoreo: volúmenes por ruta y estado, latencia, tasa de
// error y una serie de los últimos 60 minutos.
//
// Los datos viven solo en este proceso: si el servidor se reinicia,
// se reinician. Para un proyecto de esta escala es suficiente y no
// requiere servicios externos.
// ==========================================================

const LIMITE_ERRORES = 50;
const TOP_RUTAS = 8;
const VENTANA_MINUTOS = 60;

const estado = {
  inicio: Date.now(),
  total: 0,
  errores4xx: 0,
  errores5xx: 0,
  sumaMs: 0,
  maxMs: 0,
  porRuta: new Map(), // ruta -> { count, sumaMs, errores }
  porEstado: new Map(), // status -> count
  porMinuto: new Map(), // 'YYYY-MM-DDTHH:mm' -> { count, sumaMs, errores }
  errores: [], // { h, ruta, metodo, status, ms }
};

// Clave de minuto (UTC) usada para agrupar la serie temporal.
function minutoActual() {
  return new Date().toISOString().slice(0, 16);
}

// Última ruta de Express sin los parámetros (:id etc.) para agrupar
// peticiones parecidas, p. ej. "GET /api/matches/:id".
function rutaDe(req) {
  const plantilla = req.route?.path;
  if (plantilla) return `${req.method} ${plantilla}`;
  return `${req.method} ${req.originalUrl}`;
}

// Registra una petición ya respondida.
export function registrar(req, res, duracionMs) {
  const ruta = rutaDe(req);
  const status = res.statusCode;
  const esError = status >= 400;

  estado.total += 1;
  estado.sumaMs += duracionMs;
  if (duracionMs > estado.maxMs) estado.maxMs = duracionMs;
  if (status >= 500) estado.errores5xx += 1;
  else if (status >= 400) estado.errores4xx += 1;

  let r = estado.porRuta.get(ruta);
  if (!r) {
    r = { count: 0, sumaMs: 0, errores: 0 };
    estado.porRuta.set(ruta, r);
  }
  r.count += 1;
  r.sumaMs += duracionMs;
  if (esError) r.errores += 1;

  estado.porEstado.set(status, (estado.porEstado.get(status) || 0) + 1);

  const claveMinuto = minutoActual();
  let m = estado.porMinuto.get(claveMinuto);
  if (!m) {
    m = { count: 0, sumaMs: 0, errores: 0 };
    estado.porMinuto.set(claveMinuto, m);
  }
  m.count += 1;
  m.sumaMs += duracionMs;
  if (esError) m.errores += 1;

  // Poda: conserva solo la ventana de minutos + margen.
  if (estado.porMinuto.size > VENTANA_MINUTOS + 5) {
    const claves = [...estado.porMinuto.keys()].sort();
    while (estado.porMinuto.size > VENTANA_MINUTOS) {
      estado.porMinuto.delete(claves.shift());
    }
  }

  if (esError) {
    estado.errores.push({
      h: new Date().toISOString(),
      ruta,
      metodo: req.method,
      status,
      ms: duracionMs,
    });
    if (estado.errores.length > LIMITE_ERRORES) estado.errores.shift();
  }
}

// Resumen de métricas para exponer al panel.
export function resumen() {
  const ahora = Date.now();
  const corteHora = ahora - 3600000;

  // Agregados de la última hora (desde cada minuto guardado).
  let peticionesHora = 0;
  let erroresHora = 0;
  let sumaMsHora = 0;
  for (const [clave, m] of estado.porMinuto) {
    const t = new Date(clave).getTime();
    if (t >= corteHora) {
      peticionesHora += m.count;
      erroresHora += m.errores;
      sumaMsHora += m.sumaMs;
    }
  }

  // Serie de los últimos 60 minutos (rellenando huecos con ceros).
  const series = [];
  for (let i = VENTANA_MINUTOS - 1; i >= 0; i -= 1) {
    const d = new Date(ahora - i * 60000);
    const clave = d.toISOString().slice(0, 16);
    const m = estado.porMinuto.get(clave) || { count: 0, sumaMs: 0, errores: 0 };
    series.push({
      minuto: d.toISOString(),
      peticiones: m.count,
      latenciaMs: m.count > 0 ? Math.round(m.sumaMs / m.count) : 0,
      errores: m.errores,
    });
  }

  const total = estado.total;
  const erroresTotales = estado.errores4xx + estado.errores5xx;

  return {
    inicio: new Date(estado.inicio).toISOString(),
    total,
    errores4xx: estado.errores4xx,
    errores5xx: estado.errores5xx,
    tasaError: total > 0 ? +((erroresTotales / total) * 100).toFixed(2) : 0,
    latenciaPromedioMs: total > 0 ? Math.round(estado.sumaMs / total) : 0,
    latenciaMaxMs: estado.maxMs,
    hora: {
      peticiones: peticionesHora,
      errores: erroresHora,
      tasaError: peticionesHora > 0 ? +((erroresHora / peticionesHora) * 100).toFixed(2) : 0,
      latenciaPromedioMs: peticionesHora > 0 ? Math.round(sumaMsHora / peticionesHora) : 0,
    },
    porEstado: [...estado.porEstado.entries()]
      .map(([estadoCodigo, count]) => ({ estado: estadoCodigo, count }))
      .sort((a, b) => a.estado - b.estado),
    topRutas: [...estado.porRuta.entries()]
      .map(([ruta, v]) => ({
        ruta,
        count: v.count,
        promedioMs: Math.round(v.sumaMs / v.count),
        errores: v.errores,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_RUTAS),
    series,
    erroresRecientes: [...estado.errores].slice(-12).reverse(),
  };
}
