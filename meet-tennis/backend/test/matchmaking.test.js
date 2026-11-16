import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularCoincidencias, seCruzan } from '../src/routes/matchmaking.js';

// Bloque de disponibilidad mínimo para las pruebas.
const slot = (id, dias, desde, hasta) => ({ id, dias, desde, hasta });

test('seCruzan: comparte día y horario', () => {
  const sabado = slot(1, [6], '09:00', '12:00');
  const domingo = slot(2, [7], '09:00', '12:00');

  // Mismo día y horario idéntico.
  assert.equal(seCruzan(sabado, slot(3, [6], '09:00', '12:00')), true);
  // Mismo día y horario solapado.
  assert.equal(seCruzan(sabado, slot(4, [6], '10:00', '13:00')), true);
  // Mismo día pero horarios que no se tocan.
  assert.equal(seCruzan(sabado, slot(5, [6], '12:00', '15:00')), false);
  assert.equal(seCruzan(sabado, slot(6, [6], '08:00', '09:00')), false);
  // Días distintos.
  assert.equal(seCruzan(sabado, domingo), false);
  // Día compartido en listas.
  assert.equal(seCruzan(slot(7, [1, 6], '09:00', '12:00'), slot(8, [6, 7], '10:00', '11:00')), true);
});

test('calcularCoincidencias: cada bloque del rival aparece una sola vez', () => {
  // El usuario tiene DOS bloques que cruzan con el MISMO bloque del rival.
  // Antes del fix esto generaba la coincidencia duplicada.
  const misSlots = [
    slot(1, [6], '09:00', '12:00'),
    slot(2, [6], '09:00', '12:00'),
  ];
  const rivalSlots = [slot(10, [6], '09:00', '12:00')];

  const coincidencias = calcularCoincidencias(misSlots, rivalSlots);

  assert.equal(coincidencias.length, 1, 'el bloque del rival no debe duplicarse');
  assert.equal(coincidencias[0].rivalSlot.id, 10);
});

test('calcularCoincidencias: bloques distintos del rival sí se listan', () => {
  const misSlots = [slot(1, [6], '09:00', '12:00')];
  const rivalSlots = [
    slot(10, [6], '09:00', '12:00'),
    slot(11, [6], '10:00', '13:00'),
    slot(12, [7], '09:00', '12:00'), // domingo: no cruza
  ];

  const coincidencias = calcularCoincidencias(misSlots, rivalSlots);

  assert.equal(coincidencias.length, 2);
  assert.deepEqual(
    coincidencias.map((c) => c.rivalSlot.id).sort(),
    [10, 11],
  );
});

test('calcularCoincidencias: sin cruces devuelve lista vacía', () => {
  const misSlots = [slot(1, [6], '09:00', '12:00')];
  const rivalSlots = [slot(10, [6], '13:00', '15:00')];

  assert.deepEqual(calcularCoincidencias(misSlots, rivalSlots), []);
  assert.deepEqual(calcularCoincidencias([], rivalSlots), []);
  assert.deepEqual(calcularCoincidencias(misSlots, []), []);
});
