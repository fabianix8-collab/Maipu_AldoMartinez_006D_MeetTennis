import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearUrlComoLlegar, crearUrlMapa, coordenadasValidas } from '../../frontend/src/lib/mapas.js';
import { catalogoCanchas } from '../src/lib/catalogoCanchas.js';

test('cada recinto del catálogo abre su punto verificado o su dirección municipal explícita', () => {
  for (const cancha of catalogoCanchas.canchas) {
    const consulta = new URL(crearUrlMapa(cancha)).searchParams.get('q');
    assert.equal(consulta, cancha.mapaPorDireccion ? cancha.direccion : `${cancha.latitud},${cancha.longitud}`, cancha.nombre);
  }
  const sinPunto = catalogoCanchas.canchas.filter((c) => c.mapaPorDireccion);
  assert.deepEqual(sinPunto.map((c) => c.clave), ['san-joaquin']);
  assert.equal(sinPunto[0].direccion, 'Sierra Bella 2836, San Joaquín');
});

test('el mapa utiliza el punto verificado aunque la avenida tenga varias canchas', () => {
  const url = new URL(crearUrlMapa({ latitud: -33.453895, longitud: -70.732931,
    direccion: 'Av. General Óscar Bonilla, Lo Prado' }));
  assert.equal(url.searchParams.get('q'), '-33.453895,-70.732931');
  assert.equal(url.searchParams.get('output'), 'embed');
});

test('no convierte coordenadas ausentes en cero ni muestra NaN en el mapa', () => {
  for (const valor of [null, undefined, '', ' ', false, 'no-es-numero', Infinity]) {
    assert.equal(coordenadasValidas(valor, -70.7), false);
    assert.equal(coordenadasValidas(-33.5, valor), false);
  }
  assert.equal(coordenadasValidas(-91, -70), false);
  assert.equal(coordenadasValidas('-33.5', '-70.7'), true);
  const url = new URL(crearUrlMapa({ latitud: null, longitud: null, direccion: 'Chacabuco 100, Maipú' }));
  assert.equal(url.searchParams.get('q'), 'Chacabuco 100, Maipú');
  assert.equal(crearUrlMapa({}), null);
});

test('Cómo llegar usa enlaces universales de Google Maps con el mismo destino que el mapa', () => {
  for (const cancha of catalogoCanchas.canchas) {
    const enlace = new URL(crearUrlComoLlegar(cancha));
    const mapa = new URL(crearUrlMapa(cancha));
    assert.equal(enlace.origin, 'https://www.google.com');
    assert.equal(enlace.pathname, '/maps/dir/');
    assert.equal(enlace.searchParams.get('api'), '1');
    assert.equal(enlace.searchParams.get('destination'), mapa.searchParams.get('q'));
    assert.equal(enlace.searchParams.get('dir_action'), 'navigate');
    assert.equal(enlace.searchParams.has('origin'), false, 'Maps debe usar la ubicación actual del visitante');
  }
  assert.equal(crearUrlComoLlegar({ nombre: 'Cancha sin ubicación', latitud: null, longitud: null }), null);
  const soloDireccion = new URL(crearUrlComoLlegar({ direccion: 'Simón González 8515, La Reina' }));
  assert.equal(soloDireccion.searchParams.get('destination'), 'Simón González 8515, La Reina');
});

test('Cómo llegar utiliza la ubicación obtenida en Cerca de mí sin cambiar el destino', () => {
  const origen = { lat: -33.44889, lng: -70.669265 };
  for (const cancha of catalogoCanchas.canchas) {
    const url = new URL(crearUrlComoLlegar(cancha, origen));
    assert.equal(url.searchParams.get('origin'), '-33.44889,-70.669265');
    assert.equal(url.searchParams.get('destination'), new URL(crearUrlMapa(cancha)).searchParams.get('q'));
    assert.equal(url.searchParams.get('dir_action'), 'navigate');
    assert.equal(url.searchParams.has('travelmode'), false, 'Maps permite elegir el medio de transporte');
  }
});

test('sin un origen válido se deja que Maps determine la ubicación; nunca se convierte un dato ausente en cero', () => {
  const cancha = { direccion: 'Chacabuco 100, Maipú' };
  for (const origen of [undefined, null, {}, { lat: null, lng: null }, { lat: '', lng: '' },
    { lat: 91, lng: -70.7 }, { lat: -33.5, lng: Infinity }]) {
    assert.equal(new URL(crearUrlComoLlegar(cancha, origen)).searchParams.has('origin'), false);
  }
  assert.equal(new URL(crearUrlComoLlegar(cancha, { lat: 0, lng: 0 })).searchParams.get('origin'), '0,0');
  assert.equal(crearUrlComoLlegar({}, { lat: -33.5, lng: -70.7 }), null);
});

test('Iniciar navegación respeta auto o a pie y deja que Maps tome la posición actual al salir', () => {
  const cancha = { latitud: -33.5088252, longitud: -70.7563751 };
  for (const [modo, travelmode] of [['auto', 'driving'], ['pie', 'walking']]) {
    const url = new URL(crearUrlComoLlegar(cancha, undefined, modo));
    assert.equal(url.origin, 'https://www.google.com');
    assert.equal(url.searchParams.get('destination'), '-33.5088252,-70.7563751');
    assert.equal(url.searchParams.get('travelmode'), travelmode);
    assert.equal(url.searchParams.get('dir_action'), 'navigate');
    assert.equal(url.searchParams.has('origin'), false, 'No debe fijar una ubicación antigua de la vista previa');
  }
  assert.throws(() => crearUrlComoLlegar(cancha, undefined, 'invalid'), /transporte/);
});
