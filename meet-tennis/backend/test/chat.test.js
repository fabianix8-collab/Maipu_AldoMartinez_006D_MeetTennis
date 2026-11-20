import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { abrirEventosChat, avisarChat, suscribirChat } from '../src/lib/chatEvents.js';

process.env.SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-key';
const { default: router } = await import('../src/routes/chat.js');
const handler = (path, method) => router.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]).route.stack.at(-1).handle;
const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const conv = { id: 7, usuario1_id: userA, usuario2_id: userB };
const json = (body) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
const respuesta = () => ({ status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

test('los eventos llegan solo a ambos participantes, incluyendo sus otras pestañas', () => {
  const recibidos = [[], [], [], []];
  const quitar = [userA, userA, userB, 'otro'].map((id, i) => suscribirChat(id, (aviso) => recibidos[i].push(aviso)));
  try {
    avisarChat(conv);
    quitar[1]();
    avisarChat(conv, 'lectura');
    assert.deepEqual(recibidos.map((items) => items.length), [2, 1, 2, 0]);
    assert.deepEqual(recibidos[0][0], { tipo: 'mensaje', conversacionId: 7 });
    assert.equal(JSON.stringify(recibidos).includes('contenido'), false);
  } finally { quitar.forEach((fn) => fn()); }
});

test('el stream envía listo y elimina la suscripción al cerrar la conexión', () => {
  const res = new EventEmitter();
  const bloques = [];
  res.set = (headers) => { assert.match(headers['Content-Type'], /text\/event-stream/); assert.equal(headers['X-Accel-Buffering'], 'no'); };
  res.flushHeaders = () => {};
  res.write = (data) => { bloques.push(data); return true; };
  abrirEventosChat({ user: { id: userA }, headers: {} }, res);
  try {
    avisarChat(conv);
    assert.match(bloques[0], /listo/);
    assert.match(bloques[1], /mensaje/);
  } finally { res.emit('close'); }
  avisarChat(conv);
  assert.equal(bloques.length, 2);
});

test('leer mensajes sin llegar al final no confirma lectura; usuarios ajenos no acceden', async (t) => {
  const llamadas = [];
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(input); llamadas.push({ url, options });
    return json(url.pathname.endsWith('/conversaciones') ? conv : []);
  });
  let res = respuesta();
  await handler('/conversations/:id/messages', 'get')({ user: { id: userA }, params: { id: '7' }, query: { marcarLeido: 'false' } }, res);
  assert.equal(res.body.success, true);
  assert.equal(llamadas.some(({ options }) => options.method === 'PATCH'), false);
  res = respuesta();
  await handler('/conversations/:id/messages', 'get')({ user: { id: 'otro' }, params: { id: '7' }, query: {} }, res);
  assert.equal(res.code, 404);
  assert.equal(llamadas.filter(({ url }) => url.pathname.endsWith('/mensajes')).length, 1);
});

test('la lectura verifica pertenencia, mensaje del hilo y avanza hasta su fecha exacta', async (t) => {
  const llamadas = [];
  const visto = '2026-11-19T12:00:00+00:00';
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(input); llamadas.push({ url, options });
    if (options.method === 'PATCH') return new Response(null, { status: 204 });
    return json(url.pathname.endsWith('/conversaciones') ? conv : { created_at: visto });
  });
  const res = respuesta();
  await handler('/conversations/:id/read', 'post')({ user: { id: userA }, params: { id: '7' }, body: { mensaje_id: 20 } }, res);
  assert.equal(res.body.success, true);
  assert.equal(llamadas[1].url.searchParams.get('conversacion_id'), 'eq.7');
  assert.equal(llamadas[1].url.searchParams.get('id'), 'eq.20');
  assert.deepEqual(JSON.parse(llamadas[2].options.body), { leido_por_1: visto });
  assert.equal(llamadas[2].url.searchParams.get('or'), `(leido_por_1.is.null,leido_por_1.lt.${visto})`);
});

test('no se puede confirmar la lectura de un chat ajeno o de un mensaje inexistente', async (t) => {
  let escrituras = 0;
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    if (options.method === 'PATCH') escrituras++;
    return json(new URL(input).pathname.endsWith('/conversaciones') ? conv : null);
  });
  for (const id of ['otro', userA]) {
    const res = respuesta();
    await handler('/conversations/:id/read', 'post')({ user: { id }, params: { id: '7' }, body: { mensaje_id: 20 } }, res);
    assert.equal(res.code, 404);
  }
  assert.equal(escrituras, 0);
});

test('solo se avisa de un envío después de guardar el mensaje y verificar el chat', async (t) => {
  let fallo = false;
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    if (new URL(input).pathname.endsWith('/mensajes')) {
      if (fallo) return new Response(JSON.stringify({ message: 'Fallo' }), { status: 400 });
      return json({ id: 20, conversacion_id: 7, remitente_id: userA, contenido: 'Hola' });
    }
    return options.method === 'PATCH' ? new Response(null, { status: 204 }) : json(conv);
  });
  const avisos = [];
  const quitar = suscribirChat(userB, (aviso) => avisos.push(aviso));
  try {
    const req = { user: { id: userA }, params: { id: '7' }, body: { contenido: 'Hola' } };
    const ok = respuesta(); await handler('/conversations/:id/messages', 'post')(req, ok);
    assert.equal(ok.code, 201);
    fallo = true;
    const error = respuesta(); await handler('/conversations/:id/messages', 'post')(req, error);
    assert.equal(error.code, 500);
    const ajeno = respuesta(); await handler('/conversations/:id/messages', 'post')({ ...req, user: { id: 'otro' } }, ajeno);
    assert.equal(ajeno.code, 404);
    assert.deepEqual(avisos, [{ tipo: 'mensaje', conversacionId: 7 }]);
  } finally { quitar(); }
});
