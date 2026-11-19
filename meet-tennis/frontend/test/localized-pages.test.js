import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { parseSync } from 'rolldown/utils';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { setLanguage } from '../src/lib/i18n.js';
import { english } from '../src/lib/translations/en.js';

let server;
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
});
after(async () => { await server?.close(); });

function render(Component, props = {}, route = '/') {
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [route] }, createElement(Component, props)));
}

test('all 14 pages and both invitation screens render in Spanish and English', async () => {
  const cases = [
    ['LoginView', {}, '/', 'Iniciar sesión', 'Sign in'],
    ['RegisterView', {}, '/', 'Crear cuenta', 'Create account'],
    ['DashboardView', {}, '/', 'Buscar Partido', 'Find a match'],
    ['AvailabilityView', {}, '/', 'Guardar disponibilidad', 'Save availability'],
    ['CourtsView', {}, '/', 'Canchas Cercanas', 'Nearby courts'],
    ['MatchmakingView', {}, '/', 'Filtros de búsqueda', 'Search filters'],
    ['MisPartidosView', {}, '/mis-partidos', 'Historial de resultados', 'Results history'],
    ['MisPartidosView', { seccion: 'solicitudes' }, '/solicitudes', 'Invitaciones pendientes', 'Pending invitations'],
    ['MisPartidosView', { seccion: 'proximos' }, '/proximos-partidos', 'Encuentros aceptados', 'Accepted matches'],
    ['ProfileView', {}, '/', 'Mis datos', 'My details'],
    ['RankingView', {}, '/', 'Tabla de posiciones', 'Standings'],
    ['ResenasView', {}, '/', 'Dejar una reseña', 'Leave a review'],
    ['ChatView', {}, '/', 'Conversaciones', 'Conversations'],
    ['ProductosView', {}, '/', 'Tu tienda en MeetTennis', 'Your store on MeetTennis'],
    ['MonitoreoView', {}, '/', 'Cargando métricas', 'Loading metrics'],
    ['AdminUsuariosView', {}, '/', 'Administración de usuarios', 'User administration'],
  ];
  for (const [name, props, route, spanish, englishText] of cases) {
    const { default: View } = await server.ssrLoadModule(`/src/pages/${name}.jsx`);
    // Vite SSR loads the language module through its own module graph.
    const i18n = await server.ssrLoadModule('/src/lib/i18n.js');
    i18n.setLanguage('es');
    assert.ok(render(View, props, route).includes(spanish), name + ': Spanish');
    i18n.setLanguage('en');
    const html = render(View, props, route);
    assert.ok(html.includes(englishText), name + ': English');
    assert.ok(!/\{\d+\}/.test(html), name + ': no unresolved parameters');
  }
  setLanguage('es');
});

test('English registration translates labels while keeping stored Spanish enum values', async () => {
  const { default: View } = await server.ssrLoadModule('/src/pages/RegisterView.jsx');
  const i18n = await server.ssrLoadModule('/src/lib/i18n.js');
  i18n.setLanguage('en');
  const html = render(View);
  assert.match(html, /value="1ra Categoría"[^>]*>Category 1<\/option>/);
  assert.match(html, /value="Hombre"[^>]*>Male<\/option>/);
  assert.ok(html.includes('Maipú'));
  assert.ok(html.includes('placeholder="Your first name"'));
});

test('court actions open an in-app route dialog while retaining the map and selected language', async () => {
  const { default: Actions } = await server.ssrLoadModule('/src/components/CanchaPartido.jsx');
  const i18n = await server.ssrLoadModule('/src/lib/i18n.js');
  const cancha = { nombre: 'Club de Tenis Maipú', latitud: -33.5088252, longitud: -70.7563751 };
  for (const [language, mapLabel, directionsLabel] of [['es', 'Ver cancha', 'Cómo llegar'], ['en', 'View court', 'Directions']]) {
    i18n.setLanguage(language);
    const html = render(Actions, { cancha, origen: { lat: -33.44889, lng: -70.669265 } });
    assert.ok(html.includes(mapLabel) && html.includes(directionsLabel));
    assert.ok(html.includes('aria-haspopup="dialog"'));
    assert.ok(!html.includes('maps/dir/'));
    assert.ok(html.includes('Club de Tenis Maipú'));
  }
});

test('tennis language switch exposes its selected language and destination', async () => {
  const { default: Selector } = await server.ssrLoadModule('/src/components/LanguageSelector.jsx');
  const i18n = await server.ssrLoadModule('/src/lib/i18n.js');
  i18n.setLanguage('en');
  const html = render(Selector);
  assert.ok(html.includes('role="switch"'));
  assert.ok(html.includes('aria-label="Language: English"'));
  assert.ok(html.includes('aria-checked="true"'));
  assert.ok(html.includes('title="Change language: Español"'));
  i18n.setLanguage('es');
  const spanish = render(Selector);
  assert.ok(spanish.includes('aria-checked="false"'));
  assert.ok(spanish.includes('title="Cambiar idioma: English"'));
});

test('interface translation keys exist in the English catalogue', () => {
  function visit(node, file) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'CallExpression' && node.callee?.name === 't') {
      const value = node.arguments[0];
      if (value?.type === 'Literal' && typeof value.value === 'string' && /[a-záéíóúñü]/i.test(value.value)) {
        const key = value.value.replace(/\s+/g, ' ').trim();
        assert.ok(Object.hasOwn(english, key), `${file}: ${key}`);
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'comments') continue;
      if (Array.isArray(value)) value.forEach((n) => visit(n, file));
      else if (value && typeof value === 'object') visit(value, file);
    }
  }
  for (const dir of ['src/pages', 'src/components']) {
    for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.jsx'))) {
      const source = fs.readFileSync(path.join(dir, file), 'utf8');
      const parsed = parseSync(file, source, { lang: 'jsx' });
      assert.equal(parsed.errors.length, 0, file);
      visit(parsed.program, file);
    }
  }
});
