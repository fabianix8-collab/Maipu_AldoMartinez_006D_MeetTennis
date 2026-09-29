import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distanciaKm,
  esUuid,
  extraerComuna,
  sumarDias,
  ventanaAsistencia,
} from '../src/lib/utils.js';

test('extrae la comuna de la dirección de una cancha', () => {
  assert.equal(extraerComuna('Av. Las Perdices 1230, Peñalolén'), 'Peñalolén');
  assert.equal(extraerComuna('Sin coma'), 'Sin coma');
  assert.equal(extraerComuna(''), null);
  assert.equal(extraerComuna(null), null);
});

test('distancia entre dos puntos de Santiago', () => {
  // Plaza de Armas → Plaza Maipú: unos 13 km en línea recta.
  const km = distanciaKm(-33.4378, -70.6505, -33.5106, -70.7572);
  assert.ok(km > 12 && km < 14, `distancia inesperada: ${km}`);
  assert.equal(distanciaKm(-33.4, -70.6, -33.4, -70.6), 0);
});

test('valida ids de usuario antes de usarlos en filtros', () => {
  assert.equal(esUuid('29fd314d-589e-414a-8d94-640a5fe77c53'), true);
  assert.equal(esUuid('x'), false);
  assert.equal(esUuid('1,jugador1_id.neq.0'), false);
  assert.equal(esUuid(undefined), false);
});

test('suma días cruzando fin de mes y de año', () => {
  assert.equal(sumarDias('2026-09-30', 1), '2026-10-01');
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(sumarDias('2028-02-28', 1), '2028-02-29');
});

test('la asistencia se confirma solo el día antes o el mismo día', () => {
  assert.equal(ventanaAsistencia('2026-10-10', '2026-10-10'), 'hoy');
  assert.equal(ventanaAsistencia('2026-10-11', '2026-10-10'), 'mañana');
  assert.equal(ventanaAsistencia('2026-10-12', '2026-10-10'), null);
  assert.equal(ventanaAsistencia('2026-10-09', '2026-10-10'), null);
});
