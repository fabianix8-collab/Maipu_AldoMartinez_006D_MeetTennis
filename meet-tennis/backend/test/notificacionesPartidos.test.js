import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hoyChile } from '../src/lib/utils.js';
import { referenciaPartido } from '../../frontend/src/lib/partidos.js';

// Solo datos sintéticos: ninguna consulta de estas pruebas llega a Supabase.
process.env.SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba';
const { default: notificaciones } = await import('../src/routes/notifications.js');
const { default: partidos } = await import('../src/routes/matches.js');
const { default: matchmaking } = await import('../src/routes/matchmaking.js');

const yo = { id: '11111111-1111-4111-8111-111111111111', nombre: 'Ana', apellido: 'Prueba' };
const rival = { id: '22222222-2222-4222-8222-222222222222', nombre: 'Luis', apellido: 'Prueba' };
const ahora = new Date().toISOString();
const cancha = { id: 41, nombre: 'Cancha de prueba', direccion: 'Bonilla, Lo Prado', latitud: -33.45286111111111, longitud: -70.73838888888889 };

function solicitud(id, estado, recibida = true, extra = {}) {
  return { id, estado, solicitante_id: recibida ? rival.id : yo.id, receptor_id: recibida ? yo.id : rival.id,
    solicitante: recibida ? rival : yo, receptor: recibida ? yo : rival,
    fecha: hoyChile(), hora_desde: '18:00:00', hora_hasta: '19:00:00', created_at: ahora,
    respondida_at: estado === 'pendiente' ? null : ahora, cancha,
    asiste_solicitante: null, asiste_receptor: null, ...extra };
}

function resultado(id, estado, registradoPorMi) {
  return { id, estado, jugador1_id: registradoPorMi ? yo.id : rival.id,
    jugador2_id: registradoPorMi ? rival.id : yo.id, jugador1: registradoPorMi ? yo : rival,
    jugador2: registradoPorMi ? rival : yo, ganador_id: yo.id, categoria_j1: '5ta Categoría',
    categoria_j2: '5ta Categoría', fecha: hoyChile(), created_at: ahora, respondido_at: ahora, cancha };
}

async function ejecutar(router, ruta, fixtures, t) {
  const consultas = [];
  t.mock.method(globalThis, 'fetch', async (entrada) => {
    const url = new URL(typeof entrada === 'string' ? entrada : entrada.url || entrada.href);
    assert.equal(url.origin, 'https://supabase.test');
    const tabla = url.pathname.split('/').at(-1);
    assert.ok(Object.hasOwn(fixtures, tabla), `Consulta inesperada: ${tabla}`);
    consultas.push(url);
    return new Response(JSON.stringify(fixtures[tabla]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  const handler = router.stack.find((capa) => capa.route?.path === ruta && capa.route.methods.get).route.stack[0].handle;
  await handler({ user: yo }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.success, true);
  return { data: res.body.data, consultas };
}

test('cada tipo de aviso abre su solicitud o resultado exacto en Mis partidos', async (t) => {
  const { data } = await ejecutar(notificaciones, '/', {
    usuario: { avisos_vistos_at: null }, conversaciones: [],
    solicitudes_partido: [
      solicitud(11, 'pendiente'), solicitud(12, 'aceptada', false), solicitud(13, 'rechazada', false),
      solicitud(14, 'cancelada'),
      solicitud(15, 'aceptada', true, { asiste_receptor: true, asiste_solicitante: true, asistencia_solicitante_at: ahora }),
      solicitud(16, 'cancelada', true, { asiste_solicitante: false, asistencia_solicitante_at: ahora }),
    ],
    partidos: [resultado(11, 'pendiente', false), resultado(12, 'confirmado', true), resultado(13, 'rechazado', true)],
  }, t);
  const esperados = {
    'solicitud-11': '#solicitud-11', 'asistencia-12': '#solicitud-12', 'solicitud-12-aceptada': '#solicitud-12',
    'solicitud-13-rechazada': '#solicitud-13', 'solicitud-14-cancelada': '#solicitud-14',
    'asistencia-15-si': '#solicitud-15', 'asistencia-16-no': '#solicitud-16',
    'partido-11': '#partido-11', 'partido-12-confirmado': '#partido-12', 'partido-13-rechazado': '#partido-13',
  };
  assert.equal(data.avisos.length, Object.keys(esperados).length);
  for (const aviso of data.avisos) {
    assert.equal(aviso.destino, `/mis-partidos${esperados[aviso.id]}`, aviso.id);
    const referencia = referenciaPartido(new URL(aviso.destino, 'https://meet.test').hash);
    assert.ok(referencia, 'El frontend debe reconocer el destino del backend');
    assert.equal(`#${referencia.ancla}`, esperados[aviso.id]);
  }
});

test('solicitudes y resultados incluyen el destino cartográfico de su cancha, aunque ya no esté en el selector', async (t) => {
  const resPartidos = await ejecutar(partidos, '/', { partidos: [resultado(11, 'pendiente', false)], usuario: { nivel: '5ta Categoría' } }, t);
  assert.deepEqual(resPartidos.data.partidos[0].cancha, cancha);
  const resSolicitudes = await ejecutar(matchmaking, '/requests', { solicitudes_partido: [solicitud(11, 'pendiente')] }, t);
  assert.deepEqual(resSolicitudes.data.recibidas[0].cancha, cancha);
  for (const consulta of [...resPartidos.consultas, ...resSolicitudes.consultas].filter((u) => ['partidos', 'solicitudes_partido'].some((tabla) => u.pathname.endsWith(`/${tabla}`)))) {
    assert.match(consulta.searchParams.get('select'), /cancha:canchas\(id,nombre,direccion,latitud,longitud\)/);
  }
});

test('los destinos separan solicitudes y resultados y rechazan fragmentos desconocidos', () => {
  assert.notDeepEqual(referenciaPartido('#solicitud-11'), referenciaPartido('#partido-11'));
  for (const hash of ['', '#partidos-pendientes', '#partido--1', '#solicitud-0', '#solicitud-11/otro', '#partido-NaN']) {
    assert.equal(referenciaPartido(hash), null);
  }
});
