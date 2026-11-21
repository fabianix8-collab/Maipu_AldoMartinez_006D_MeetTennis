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
import { PUNTOS_RESULTADO, REQUISITOS_ASCENSO, resumenJugador } from '../../backend/src/lib/ranking.js';

let server;
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
});
after(async () => { await server?.close(); });

function render(Component, props = {}, route = '/') {
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [route] }, createElement(Component, props)));
}

test('all app pages, invitation screens and recovery screens render in Spanish and English', async () => {
  const cases = [
    ['LoginView', {}, '/', 'Iniciar sesión', 'Sign in'],
    ['RegisterView', {}, '/', 'Crear cuenta', 'Create account'],
    ['PasswordRecoveryView', {}, '/recuperar-contrasena', '¿Olvidaste tu contraseña?', 'Forgot your password?'],
    ['PasswordRecoveryView', { mode: 'reset' }, '/restablecer-contrasena', 'Restablecer contraseña', 'Reset password'],
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

test('ranking explains the actual scoring and promotion rules in both languages', async () => {
  const { RankingGuide } = await server.ssrLoadModule('/src/components/RankingHelp.jsx');
  const i18n = await server.ssrLoadModule('/src/lib/i18n.js');
  const reglas = { puntosResultado: PUNTOS_RESULTADO, ascenso: REQUISITOS_ASCENSO };
  for (const [language, example, explanation] of [
    ['es', 'ganar 9 de 10 partidos válidos', 'Solo cuentan los resultados confirmados por tu rival.'],
    ['en', 'winning 9 of 10 qualifying matches', 'Only results confirmed by your opponent count.'],
  ]) {
    i18n.setLanguage(language);
    const html = render(RankingGuide, { reglas });
    assert.ok(html.includes(example));
    assert.ok(html.includes(explanation));
    for (const points of [40, 25, 10]) assert.ok(html.includes(`>+${points}</td>`));
    for (const points of [-5, -15, -25]) assert.ok(html.includes(`>${points}</td>`));
    assert.match(html, /<details/);
    assert.ok(!/\{\d+\}/.test(html));
  }
  i18n.setLanguage('es');
});

test('ranking progress uses qualifying results, exposes both requirements and respects the promotion boundary', async () => {
  const { RankingProgress } = await server.ssrLoadModule('/src/components/RankingHelp.jsx');
  const i18n = await server.ssrLoadModule('/src/lib/i18n.js');
  i18n.setLanguage('es');
  const resumen = (wins, losses, extraWins = 0, categoria = '4ta Categoría') => resumenJugador('yo', categoria, [
    ...Array.from({ length: wins + losses + extraWins }, (_, index) => ({
      jugador1_id: 'yo', jugador2_id: 'rival',
      ganador_id: index < wins || index >= wins + losses ? 'yo' : 'rival',
      categoria_j1: categoria,
      categoria_j2: index < wins + losses ? categoria : '5ta Categoría',
    })),
  ]);
  const progress = (yo, extra = {}) => render(RankingProgress, { yo, requisitos: REQUISITOS_ASCENSO, ...extra });
  const empty = progress(resumen(0, 0));
  assert.ok(empty.includes('0 jugados · mínimo 10'));
  assert.ok(empty.includes('0% · mínimo 85%'));
  assert.ok(!empty.includes('<button'));
  const notEnough = progress(resumen(9, 0));
  assert.ok(notEnough.includes('100% · mínimo 85%'));
  assert.ok(!notEnough.includes('<button'));
  const below = progress(resumen(28, 5));
  assert.ok(below.includes('84,8% · mínimo 85%'));
  assert.ok(!below.includes('<button'));
  const eligible = progress(resumen(9, 1, 10));
  assert.ok(eligible.includes('9 victorias en 10 partidos válidos.'));
  assert.ok(eligible.includes('90% · mínimo 85%'));
  assert.ok(eligible.includes('Subir a 3ra Categoría'));
  assert.equal((eligible.match(/<progress /g) || []).length, 2);
  assert.ok(progress(resumen(9, 1), { ascendiendo: true }).includes('disabled=""'));
  const top = progress(resumen(10, 0, 0, '1ra Categoría'));
  assert.ok(top.includes('el nivel más alto'));
  assert.ok(!top.includes('<button'));
  assert.ok(!top.includes('<progress'));
  i18n.setLanguage('en');
  const translated = progress(resumen(9, 1));
  assert.ok(translated.includes('Move up to Category 3'));
  assert.ok(translated.includes('9 wins in 10 qualifying matches.'));
  i18n.setLanguage('es');
});
