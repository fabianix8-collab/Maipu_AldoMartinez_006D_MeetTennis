import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anclaAviso, aplicarLecturas, marcarAvisosLeidos } from '../src/lib/avisos.js';

const novedad = { id: 'partido-42-confirmado', fecha: '2026-11-19T18:00:00Z', tipo: 'info', nuevo: true, destino: '/mis-partidos#partido-42' };

function usarAlmacenamiento(t, almacenamiento) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: almacenamiento });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  });
}

test('ver una novedad reduce los no leídos sin resolver acciones ni leer otras tarjetas', (t) => {
  const almacenamiento = new Map();
  usarAlmacenamiento(t, {
    getItem: (key) => almacenamiento.get(key) || null,
    setItem: (key, value) => almacenamiento.set(key, value),
  });
  const accion = { id: 'asistencia-42', tipo: 'accion', destino: '/proximos-partidos#solicitud-42' };
  const otra = { ...novedad, id: 'partido-43-confirmado', destino: '/mis-partidos#partido-43' };
  const data = { avisos: [novedad, accion, otra], pendientes: { proximos: 1 }, noLeidos: 3 };
  marcarAvisosLeidos('lectora', [novedad, accion]);
  const resultado = aplicarLecturas(data, 'lectora');
  assert.equal(resultado.avisos[0].nuevo, false);
  assert.equal(resultado.avisos[2].nuevo, true);
  assert.equal(resultado.noLeidos, 2);
  assert.deepEqual(resultado.pendientes, data.pendientes);
  assert.equal(data.avisos[0].nuevo, true, 'no modifica la respuesta original');
  assert.equal(aplicarLecturas(data, 'otra-lectora').noLeidos, 3);
  assert.equal(JSON.parse(almacenamiento.get('meettennis_avisos_leidos:lectora')).length, 1);
});

test('una actualización posterior del mismo aviso vuelve a ser nueva', () => {
  marcarAvisosLeidos('versiones', [novedad]);
  const posterior = { ...novedad, fecha: '2026-11-20T18:00:00Z' };
  assert.equal(aplicarLecturas({ avisos: [novedad, posterior] }, 'versiones').noLeidos, 1);
});

test('ver una asistencia pendiente quita su contador sin confirmarla ni leer otros partidos', () => {
  const asistencia = { id: 'asistencia-55', fecha: novedad.fecha, tipo: 'accion', categoria: 'proximos', destino: '/proximos-partidos#solicitud-55' };
  const otro = { ...asistencia, id: 'asistencia-56', destino: '/proximos-partidos#solicitud-56' };
  const data = { avisos: [asistencia, otro], pendientes: { proximos: 2 } };
  assert.equal(aplicarLecturas(data, 'asistencias').sinLeer.proximos, 2);
  marcarAvisosLeidos('asistencias', [asistencia]);
  const leido = aplicarLecturas(data, 'asistencias');
  assert.equal(leido.sinLeer.proximos, 1);
  assert.equal(leido.noLeidos, 1);
  assert.equal(leido.avisos[0].tipo, 'accion');
  assert.equal(leido.avisos[0].visto, true);
  assert.equal(leido.pendientes.proximos, 2, 'siguen existiendo dos asistencias por responder');
  assert.equal(aplicarLecturas(data, 'otra-persona').sinLeer.proximos, 2);
});

test('varios avisos sobre una tarjeta suman uno y los destinos antiguos y actuales usan la misma sección', () => {
  const accion = { id: 'asistencia-60', fecha: novedad.fecha, tipo: 'accion', destino: '/proximos-partidos#solicitud-60' };
  const info = { ...accion, id: 'solicitud-60-aceptada', tipo: 'info', nuevo: true, destino: '/partidos?seccion=proximos#solicitud-60' };
  const data = { avisos: [accion, info] };
  assert.equal(aplicarLecturas(data, 'duplicados').sinLeer.proximos, 1);
  marcarAvisosLeidos('duplicados', [accion, info]);
  assert.equal(aplicarLecturas(data, 'duplicados').sinLeer.proximos, 0);
  assert.equal(aplicarLecturas(data, 'duplicados').noLeidos, 0);
});

test('la lectura resiste almacenamiento bloqueado y separa los ID de solicitudes y resultados', (t) => {
  usarAlmacenamiento(t, { getItem() { throw new Error('Bloqueado'); }, setItem() { throw new Error('Bloqueado'); } });
  marcarAvisosLeidos('sin-almacenamiento', [novedad]);
  assert.equal(aplicarLecturas({ avisos: [novedad] }, 'sin-almacenamiento').noLeidos, 0);
  assert.equal(anclaAviso(novedad), 'partido-42');
  assert.equal(anclaAviso({ destino: '/proximos-partidos#solicitud-42' }), 'solicitud-42');
  assert.equal(anclaAviso({ destino: '/chat' }), null);
});
