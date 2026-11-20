import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { borrarSesionRecuperacion, leerSesionRecuperacion, RECOVERY_SESSION_KEY } from '../src/lib/passwordRecovery.js';

function navegador(hash = '') {
  const datos = new Map();
  const location = { hash, pathname: '/restablecer-contrasena', search: '' };
  const history = { state: { key: 'router-key' }, replaceState(state, _title, url) { this.state = state; this.url = url; location.hash = ''; } };
  return { location, history, datos, sessionStorage: { getItem: (key) => datos.get(key) || null, setItem: (key, value) => datos.set(key, value), removeItem: (key) => datos.delete(key) } };
}
afterEach(() => borrarSesionRecuperacion());

test('el enlace se limpia de la URL y la recuperación resiste la inicialización doble y una recarga de la pestaña', () => {
  const browser = navegador('#access_token=token-de-prueba&refresh_token=refresh-de-prueba&type=recovery&expires_in=3600');
  const sesion = leerSesionRecuperacion(browser, 1000);
  assert.equal(sesion.access_token, 'token-de-prueba');
  assert.equal(browser.location.hash, '');
  assert.equal(browser.history.url, '/restablecer-contrasena');
  assert.deepEqual(browser.history.state, { key: 'router-key' });
  assert.deepEqual(leerSesionRecuperacion(browser, 1001), sesion);
  const otraCarga = navegador();
  otraCarga.datos.set(RECOVERY_SESSION_KEY, browser.datos.get(RECOVERY_SESSION_KEY));
  borrarSesionRecuperacion();
  assert.deepEqual(leerSesionRecuperacion(otraCarga, 1002), sesion);
});

test('un enlace inválido o un login ordinario no reutiliza una recuperación anterior', () => {
  for (const hash of ['#error=access_denied&error_code=otp_expired', '#access_token=otro&refresh_token=otro&type=signup', '#type=recovery&access_token=incompleto']) {
    const browser = navegador('#access_token=primero&refresh_token=refresh&type=recovery');
    leerSesionRecuperacion(browser, 1000);
    browser.location.hash = hash;
    assert.equal(leerSesionRecuperacion(browser, 1001), null);
    assert.equal(browser.location.hash, '');
    assert.equal(browser.datos.has(RECOVERY_SESSION_KEY), false);
  }
});

test('las credenciales caducan, se eliminan al terminar y no tocan la sesión de login', () => {
  const browser = navegador('#access_token=token&refresh_token=refresh&type=recovery&expires_in=1');
  browser.datos.set('meettennis_auth', 'sesion-normal');
  leerSesionRecuperacion(browser, 1000);
  assert.equal(leerSesionRecuperacion(browser, 2001), null);
  assert.equal(browser.datos.has(RECOVERY_SESSION_KEY), false);
  assert.equal(browser.datos.get('meettennis_auth'), 'sesion-normal');
});

test('el flujo funciona en memoria si sessionStorage está bloqueado y el render del servidor no necesita window', () => {
  const browser = navegador('#access_token=token&refresh_token=refresh&type=recovery');
  browser.sessionStorage = { getItem() { throw new Error('Bloqueado'); }, setItem() { throw new Error('Bloqueado'); }, removeItem() { throw new Error('Bloqueado'); } };
  assert.ok(leerSesionRecuperacion(browser, 1000));
  assert.ok(leerSesionRecuperacion(browser, 1001));
  assert.equal(leerSesionRecuperacion(undefined), null);
});
