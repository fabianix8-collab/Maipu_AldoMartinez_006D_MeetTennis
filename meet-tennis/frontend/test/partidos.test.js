import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rutaPartidos } from '../src/lib/partidos.js';

test('las tres pestañas comparten la página Partidos y conservan una sección válida', () => {
  for (const seccion of ['solicitudes', 'proximos', 'resultados']) {
    const url = new URL(rutaPartidos(seccion), 'https://meet.test');
    assert.equal(url.pathname, '/partidos');
    assert.equal(url.searchParams.get('seccion'), seccion);
  }
  for (const seccion of [undefined, 'desconocida', 'constructor']) {
    assert.equal(new URL(rutaPartidos(seccion), 'https://meet.test').searchParams.get('seccion'), 'proximos');
  }
});

test('los enlaces anteriores conservan la bandeja, el ancla y los datos de un resultado precargado', () => {
  const parametros = new URLSearchParams({ rival: 'rival-de-prueba', fecha: '2026-11-19', cancha: '41', seccion: 'proximos' });
  const url = new URL(rutaPartidos('resultados', parametros, '#registrar-resultado'), 'https://meet.test');
  assert.equal(url.searchParams.get('seccion'), 'resultados');
  assert.equal(url.searchParams.get('rival'), 'rival-de-prueba');
  assert.equal(url.searchParams.get('fecha'), '2026-11-19');
  assert.equal(url.searchParams.get('cancha'), '41');
  assert.equal(url.hash, '#registrar-resultado');
  assert.equal(parametros.get('seccion'), 'proximos', 'no modifica la consulta original');
  assert.equal(new URL(rutaPartidos('solicitudes', { bandeja: 'enviadas' }, '#solicitud-42'), 'https://meet.test').searchParams.get('bandeja'), 'enviadas');
});
