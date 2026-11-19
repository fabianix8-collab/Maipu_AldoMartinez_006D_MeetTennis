import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seleccionarPerfilesPrueba } from '../scripts/limpiar_usuarios_prueba.mjs';

const perfil = { id: '29fd314d-589e-414a-8d94-640a5fe77c53', rol: 'jugador', avatar_url: null };

test('selecciona un perfil sin correo, foto ni cuenta de acceso', () => {
  assert.deepEqual(seleccionarPerfilesPrueba([perfil], []), [perfil]);
});

test('conserva toda cuenta de acceso aunque no tenga correo ni foto', () => {
  for (const cuenta of [{ id: perfil.id, email: 'jugador@example.com' }, { id: perfil.id, phone: '+56000000000' }]) {
    assert.deepEqual(seleccionarPerfilesPrueba([perfil], [cuenta]), []);
  }
});

test('conserva perfiles que tengan cualquiera de los datos de contacto o foto', () => {
  for (const campo of ['email', 'correo', 'avatar_url', 'foto', 'foto_url']) {
    assert.deepEqual(seleccionarPerfilesPrueba([{ ...perfil, [campo]: 'dato-existente' }], []), []);
  }
});

test('protege administradores y rechaza identificadores inválidos', () => {
  assert.deepEqual(seleccionarPerfilesPrueba([{ ...perfil, rol: 'admin' }, { ...perfil, id: 'id-invalido' }], []), []);
});

test('una consulta fallida de Auth no se interpreta como cuentas ausentes', () => {
  assert.throws(() => seleccionarPerfilesPrueba([perfil], null), /cuentas de acceso/);
});
