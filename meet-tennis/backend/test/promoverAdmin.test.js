import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerArgumentos, seleccionarAdministradores } from '../scripts/promover_admin.mjs';

test('la promoción requiere correos explícitos y solo escribe con --aplicar', () => {
  assert.throws(() => leerArgumentos([]));
  assert.throws(() => leerArgumentos(['--aplicar']));
  assert.throws(() => leerArgumentos(['--email']));
  assert.throws(() => leerArgumentos(['--email', 'no-es-correo']));
  assert.throws(() => leerArgumentos(['--nombre', 'Jugador']));
  assert.deepEqual(leerArgumentos(['--email', 'ADMIN@example.test', '--email', 'admin@example.test']),
    { correos: ['admin@example.test'], aplicar: false });
  assert.equal(leerArgumentos(['--aplicar', '--email', 'admin@example.test']).aplicar, true);
});

test('solo se selecciona el correo solicitado aunque otros jugadores compartan el nombre', () => {
  const perfiles = [
    { id: 'primero', nombre: 'Jugador', apellido: 'Ejemplo' },
    { id: 'segundo', nombre: 'Jugador', apellido: 'Ejemplo' },
  ];
  const cuentas = [{ id: 'primero', email: 'otro@example.test' }, { id: 'segundo', email: 'admin@example.test' }];
  assert.deepEqual(seleccionarAdministradores(perfiles, cuentas, ['admin@example.test']).map((p) => p.id), ['segundo']);
  assert.throws(() => seleccionarAdministradores(perfiles, cuentas, ['ausente@example.test']));
  assert.throws(() => seleccionarAdministradores([], cuentas, ['admin@example.test']));
  assert.throws(() => seleccionarAdministradores(perfiles, null, ['admin@example.test']));
});
