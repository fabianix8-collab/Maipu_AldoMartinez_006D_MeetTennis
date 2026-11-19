import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearUrlRuta, interpretarRuta, indicacionRuta, cargarRuta } from '../src/lib/rutas.js';
import { obtenerUbicacionRuta, recordarUbicacion, UBICACION_REQUERIDA } from '../src/lib/ubicacion.js';
import { translate } from '../src/lib/i18n.js';

const origen = { lat: -33.44889, lng: -70.669265 };
const cancha = { latitud: -33.5088252, longitud: -70.7563751 };
const respuesta = { code: 'Ok', routes: [{ distance: 12500, duration: 1600,
  geometry: { type: 'LineString', coordinates: [[-70.669265, -33.44889], [-70.7, -33.46], [-70.7563751, -33.5088252]] },
  legs: [{ steps: [{ name: 'Av. Pajaritos', distance: 120, maneuver: { type: 'turn', modifier: 'right' } }] }],
}] };

test('driving and walking use separate routing graphs, correct coordinate order and a real street geometry', () => {
  const auto = new URL(crearUrlRuta(origen, cancha, 'auto'));
  const pie = new URL(crearUrlRuta(origen, cancha, 'pie'));
  assert.ok(auto.pathname.startsWith('/routed-car/'));
  assert.ok(pie.pathname.startsWith('/routed-foot/'));
  assert.ok(auto.pathname.endsWith('-70.669265,-33.44889;-70.7563751,-33.5088252'));
  assert.equal(auto.searchParams.get('geometries'), 'geojson');
  assert.equal(auto.searchParams.get('overview'), 'full');
  assert.equal(auto.searchParams.get('steps'), 'true');
});

test('missing location or an unverified destination cannot produce a made-up route', () => {
  for (const punto of [null, {}, { lat: null, lng: '' }, { lat: 91, lng: 0 }]) {
    assert.throws(() => crearUrlRuta(punto, cancha), /ubicación/);
  }
  assert.throws(() => crearUrlRuta(origen, { direccion: 'Sierra Bella 2836, San Joaquín' }), /coordenadas/);
  assert.throws(() => crearUrlRuta(origen, { ...cancha, mapaPorDireccion: true }), /coordenadas/);
  assert.throws(() => crearUrlRuta(origen, cancha, 'invalid'), /transporte/);
});

test('the map uses the route geometry and provider totals rather than a straight line between markers', () => {
  const ruta = interpretarRuta(respuesta);
  assert.deepEqual(ruta.puntos, [[-33.44889, -70.669265], [-33.46, -70.7], [-33.5088252, -70.7563751]]);
  assert.equal(ruta.distancia, 12500);
  assert.equal(ruta.duracion, 1600);
  assert.equal(ruta.pasos[0].calle, 'Av. Pajaritos');
  for (const data of [{ code: 'NoRoute' }, { code: 'Ok', routes: [] }, { code: 'Ok', routes: [{ geometry: { type: 'LineString' } }] },
    { ...respuesta, routes: [{ ...respuesta.routes[0], distance: -1 }] },
    { ...respuesta, routes: [{ ...respuesta.routes[0], geometry: { type: 'LineString', coordinates: [[null, null], [0, 0]] } }] }]) {
    assert.throws(() => interpretarRuta(data), /recorrido/);
  }
});

test('route instructions translate directions but preserve street names', () => {
  const t = (key, values) => translate(key, values, 'en');
  assert.equal(indicacionRuta({ tipo: 'turn', giro: 'right', calle: 'Av. Pajaritos' }, t), 'Turn right · Av. Pajaritos');
  assert.equal(indicacionRuta({ tipo: 'roundabout', salida: 3 }, t), 'At the roundabout, take exit 3');
  assert.equal(indicacionRuta({ tipo: 'arrive' }, t), 'You have arrived at the court');
});

test('routing checks for an already-granted location permission, without prompting denied or undecided users', async () => {
  for (const state of ['prompt', 'denied']) {
    let consultas = 0;
    const navegador = { permissions: { query: async () => ({ state }) }, geolocation: { getCurrentPosition() { consultas++; } } };
    await assert.rejects(() => obtenerUbicacionRuta({ origen, navegador }), { message: UBICACION_REQUERIDA });
    assert.equal(consultas, 0);
  }
});

test('routing refreshes the authorized device position and shares it only in session memory', async () => {
  const navegador = { permissions: { query: async () => ({ state: 'granted' }) },
    geolocation: { getCurrentPosition(ok, _error, opciones) {
      assert.equal(opciones.enableHighAccuracy, true);
      ok({ coords: { latitude: -33.5, longitude: -70.7, accuracy: 12 } });
    } } };
  const result = await obtenerUbicacionRuta({ origen, navegador });
  assert.equal(result.lat, -33.5);
  assert.equal(result.lng, -70.7);
  assert.equal(result.precision, 12);
  assert.equal(recordarUbicacion({ lat: null, lng: null }), null);
});

test('aborted location lookups and route requests cannot start new work', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => obtenerUbicacionRuta({ signal: controller.signal }), { name: 'AbortError' });
  await assert.rejects(() => cargarRuta(origen, cancha, 'auto', { signal: controller.signal }), { name: 'AbortError' });
});
