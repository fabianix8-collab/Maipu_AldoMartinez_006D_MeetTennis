import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGE_KEY, getLanguage, getLocale, resolveLanguage, setLanguage, subscribeLanguage, translate } from '../src/lib/i18n.js';
import { english } from '../src/lib/translations/en.js';
import { haceCuanto, nombreCompleto } from '../src/lib/formato.js';

function browserGlobal(t, key, value) {
  const original = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, key, original);
    else Reflect.deleteProperty(globalThis, key);
  });
}

test('saved preference takes priority; unsupported browser languages fall back to Spanish', () => {
  assert.equal(resolveLanguage('es', 'en-US'), 'es');
  assert.equal(resolveLanguage('en', 'es-CL'), 'en');
  assert.equal(resolveLanguage(null, 'en-GB'), 'en');
  assert.equal(resolveLanguage('invalid', 'es-CL'), 'es');
  assert.equal(resolveLanguage(null, 'fr-FR'), 'es');
});

test('switching languages persists only the language, updates accessibility and notifies subscribers', (t) => {
  const storage = new Map([['meettennis_auth', 'existing-session']]);
  browserGlobal(t, 'localStorage', { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) });
  browserGlobal(t, 'document', { documentElement: { lang: 'es' } });
  let notifications = 0;
  const unsubscribe = subscribeLanguage(() => notifications++);
  setLanguage('en');
  assert.equal(getLanguage(), 'en');
  assert.equal(getLocale(), 'en-GB');
  assert.equal(document.documentElement.lang, 'en');
  assert.equal(storage.get(LANGUAGE_KEY), 'en');
  assert.equal(storage.get('meettennis_auth'), 'existing-session');
  setLanguage('invalid');
  assert.equal(getLanguage(), 'en');
  setLanguage('es');
  assert.equal(document.documentElement.lang, 'es');
  assert.equal(notifications, 2);
  unsubscribe();
});

test('language selection works even when browser storage is disabled', (t) => {
  browserGlobal(t, 'localStorage', { setItem() { throw new Error('Storage blocked'); } });
  assert.doesNotThrow(() => setLanguage('en'));
  assert.equal(getLanguage(), 'en');
  setLanguage('es');
});

test('messages kept in state can be translated in either language without changing their values', () => {
  const validation = 'La contraseña debe tener al menos 6 caracteres.';
  assert.equal(translate(validation, undefined, 'en'), 'Your password must have at least 6 characters.');
  assert.equal(translate(validation, undefined, 'es'), validation);
  assert.equal(translate('5ta Categoría', undefined, 'en'), 'Category 5');
  assert.equal(translate('5ta Categoría', undefined, 'es'), '5ta Categoría');
  assert.equal(translate(4, undefined, 'en'), 4);
});

test('backend notifications and status messages preserve player names and interpolated values', () => {
  assert.equal(translate('Jugador confirmó el partido: +25 pts.', undefined, 'en'), 'Jugador confirmed the match: +25 pts.');
  assert.equal(translate('¿Confirmas tu partido de mañana con John Smith a las 18:00?', undefined, 'en'), 'Do you confirm your match tomorrow with John Smith at 18:00?');
  assert.equal(translate('Partido registrado. Sumará puntos cuando Sarah lo confirme.', undefined, 'en'), 'Match recorded. Points will be awarded when Sarah confirms it.');
  assert.equal(translate('¡Ascendiste a 4ta Categoría! Tu desafío comienza de nuevo desde cero.', undefined, 'en'), "You've moved up to Category 4! Your challenge starts again from zero.");
  assert.equal(translate('El comentario no puede superar los 300 caracteres.', undefined, 'en'), 'The comment cannot exceed 300 characters.');
});

test('explicit interpolation does not interpret user text or replacement syntax', () => {
  const name = '<b>Jugador $&</b>';
  assert.equal(translate('Foto de {0}', { 0: name }, 'en'), 'Photo of ' + name);
  assert.equal(translate('Foto de {0}', { 0: name }, 'es'), 'Foto de ' + name);
  assert.equal(translate('Club de Tenis Maipú', undefined, 'en'), 'Club de Tenis Maipú');
  assert.equal(translate('Chacabuco 100, Maipú', undefined, 'en'), 'Chacabuco 100, Maipú');
});

test('weekday lists, counts, network errors and relative times use the selected language', () => {
  assert.equal(translate('Lunes, Miércoles, Sábado', undefined, 'en'), 'Monday, Wednesday, Saturday');
  assert.equal(translate('2 rivales encontrados', undefined, 'en'), '2 opponents found');
  assert.equal(translate('Failed to fetch', undefined, 'es'), 'No se pudo conectar con el servidor.');
  assert.equal(translate('Failed to fetch', undefined, 'en'), 'Could not connect to the server.');
  setLanguage('en');
  assert.equal(haceCuanto(new Date(Date.now() - 5 * 60000).toISOString()), '5 min ago');
  assert.equal(nombreCompleto({ nombre: 'Jugador' }), 'Jugador');
  assert.equal(nombreCompleto({}), 'Player');
  setLanguage('es');
  assert.equal(nombreCompleto({}), 'Jugador');
});

test('every translation preserves the same interpolation parameters', () => {
  const parameters = (text) => [...new Set([...text.matchAll(/\{(\d+)\}/g)].map((m) => m[1]))].sort();
  for (const [source, target] of Object.entries(english)) {
    assert.deepEqual(parameters(target), parameters(source), source);
    assert.ok(target.trim(), source);
  }
});
