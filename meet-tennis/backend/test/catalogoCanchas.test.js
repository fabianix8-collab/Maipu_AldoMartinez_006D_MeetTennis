import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogoCanchas, esCanchaVigente, nombresCanchasVigentes, planificarCatalogo, validarCatalogo } from '../src/lib/catalogoCanchas.js';

test('el catálogo exige ubicaciones en Santiago, fuentes y recintos sin duplicados', () => {
  assert.doesNotThrow(() => validarCatalogo());
  const [cancha] = catalogoCanchas.canchas;
  assert.throws(() => validarCatalogo([{ ...cancha, latitud: null }]), /Ubicación/);
  assert.throws(() => validarCatalogo([{ ...cancha, longitud: 70.7 }]), /Ubicación/);
  assert.throws(() => validarCatalogo([cancha, cancha]), /duplicada/);
  assert.throws(() => validarCatalogo([{ ...cancha, ubicacionFuente: null }]), /fuente/);
});

test('se rechazan ID retirados y los errores de base de datos no se confunden con una cancha vigente', async () => {
  const db = (resultado) => ({ from(tabla) {
    assert.equal(tabla, 'canchas');
    return { select() { return this; }, eq(campo, id) { assert.equal(campo, 'id'); assert.equal(id, 8); return this; },
      in(campo, nombres) { assert.equal(campo, 'nombre'); assert.deepEqual(nombres, nombresCanchasVigentes); return this; },
      async maybeSingle() { return resultado; } };
  } });
  assert.equal(await esCanchaVigente(db({ data: null, error: null }), 8), false);
  assert.equal(await esCanchaVigente(db({ data: { id: 8 }, error: null }), 8), true);
  await assert.rejects(() => esCanchaVigente(db({ data: null, error: new Error('sin conexión') }), 8), /sin conexión/);
});

test('se conservan las dos canchas de Bonilla en los puntos distintos del usuario', () => {
  const primera = catalogoCanchas.canchas.find((c) => c.clave === 'bonilla-cruz');
  const segunda = catalogoCanchas.canchas.find((c) => c.clave === 'bonilla-oriente');
  assert.ok(Math.abs(primera.latitud - (-33.45286111111111)) < 1e-10);
  assert.ok(Math.abs(primera.longitud - (-70.73838888888889)) < 1e-10);
  assert.equal(segunda.latitud, -33.453895);
  assert.equal(segunda.longitud, -70.732931);
  assert.notEqual(primera.longitud, segunda.longitud);
});

test('los recintos descartados no forman parte de la oferta vigente', () => {
  const nombres = catalogoCanchas.canchas.map((c) => c.nombre).join('\n');
  assert.doesNotMatch(nombres, /Pato Cornejo|Náutico|Bernardo Leighton|Parque Mahuida|Mundial Lawn|Club Don Carlos|Club AFT|Parque Cerrillos/);
  assert.equal(catalogoCanchas.canchas.find((c) => c.clave === 'futuros').direccion, 'Av. Lo Ovalle 02420, Lo Espejo');
});

test('la sincronización conserva ID equivalentes y nunca reutiliza los de canchas retiradas', () => {
  const cancha = catalogoCanchas.canchas.find((c) => c.clave === 'uss');
  const nueva = catalogoCanchas.canchas.find((c) => c.clave === 'bonilla-cruz');
  const actuales = [
    { id: 7, nombre: 'Ciudad Deportiva USS (Ex Zamorano)', direccion: 'Dirección antigua', latitud: -33.4, longitud: -70.5 },
    { id: 8, nombre: 'Club de Tenis Pato Cornejo', direccion: 'Dirección antigua' },
  ];
  const copia = structuredClone(actuales);
  const plan = planificarCatalogo(actuales, [cancha, nueva]);
  assert.equal(plan.cambios[0].despues.id, 7);
  assert.equal(plan.altas[0].id, 9);
  assert.equal(plan.retiradas[0].id, 8);
  assert.deepEqual(actuales, copia, 'planificar no debe modificar el respaldo');

  const sincronizadas = [...plan.cambios.map((c) => c.despues), ...plan.altas, ...plan.retiradas];
  const repetido = planificarCatalogo(sincronizadas, [cancha, nueva]);
  assert.equal(repetido.altas.length, 0);
  assert.equal(repetido.cambios.length, 0);
  assert.equal(repetido.retiradas[0].id, 8);
});

test('el redondeo de PostgREST no provoca actualizaciones perpetuas y un punto desplazado sí se corrige', () => {
  const cancha = catalogoCanchas.canchas.find((c) => c.clave === 'bonilla-cruz');
  const actual = { id: 41, nombre: cancha.nombre, direccion: cancha.direccion,
    latitud: -33.4528611111111, longitud: -70.7383888888889 };
  assert.equal(planificarCatalogo([actual], [cancha]).cambios.length, 0);
  assert.equal(planificarCatalogo([{ ...actual, latitud: actual.latitud + 0.00001 }], [cancha]).cambios.length, 1);
  assert.equal(planificarCatalogo([{ ...actual, latitud: null }], [cancha]).cambios.length, 1);
});
