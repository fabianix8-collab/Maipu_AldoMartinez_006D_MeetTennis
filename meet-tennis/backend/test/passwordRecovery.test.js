import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearRateLimit } from '../src/middleware/rateLimit.js';

// Credenciales sintéticas y fetch simulado: las pruebas no envían correos ni cambian cuentas.
process.env.SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_ANON_KEY = 'anon-de-prueba';
process.env.NODE_ENV = 'development';
const { default: router, urlRecuperacion } = await import('../src/routes/passwordRecovery.js');
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'cuenta@example.test' };
const jwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.cHJ1ZWJh`;
const bodyReset = { access_token: jwt, refresh_token: 'refresh-de-prueba', password: 'Clave-nueva-123' };
const respuesta = () => ({ status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const handler = (path) => router.stack.find((entry) => entry.route?.path === path).route.stack.at(-1).handle;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' } });

test('los destinos se limitan a orígenes configurados y HTTPS en producción', () => {
  const env = { NODE_ENV: 'production', FRONTEND_URL: 'https://app.example.test', CORS_ORIGIN: 'https://otra.example.test,http://inseguro.example.test' };
  assert.equal(urlRecuperacion('https://app.example.test', env), 'https://app.example.test/restablecer-contrasena');
  assert.equal(urlRecuperacion(undefined, env), 'https://app.example.test/restablecer-contrasena');
  for (const origin of ['https://app.example.test.evil.test', 'https://app.example.test@evil.test', 'http://inseguro.example.test', 'javascript:alert(1)', [], 'https://app.example.test/ruta']) assert.equal(urlRecuperacion(origin, env), null);
  assert.equal(urlRecuperacion('http://localhost:5173', { NODE_ENV: 'development' }), 'http://localhost:5173/restablecer-contrasena');
});

test('solicitar el enlace usa la clave pública y responde igual para correos existentes y desconocidos', async (t) => {
  const solicitudes = [];
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(input);
    solicitudes.push({ url, options });
    return json({});
  });
  for (const email of [' Cuenta@Example.test ', 'desconocido@example.test']) {
    const res = respuesta();
    await handler('/forgot-password')({ body: { email, origin: 'http://localhost:5173' } }, res);
    assert.deepEqual(res.body, { success: true, data: null, error: null });
    assert.equal(res.code, 200);
  }
  assert.equal(solicitudes[0].url.pathname, '/auth/v1/recover');
  assert.equal(solicitudes[0].url.searchParams.get('redirect_to'), 'http://localhost:5173/restablecer-contrasena');
  assert.equal(new Headers(solicitudes[0].options.headers).get('apikey'), 'anon-de-prueba');
  assert.equal(JSON.parse(solicitudes[0].options.body).email, 'cuenta@example.test');
});

test('correos y redirecciones inválidos se rechazan antes de contactar a Supabase', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('No debe consultar'); });
  for (const body of [{ email: [] }, { email: 'correo-invalido' }, { email: 'a@example.test', origin: 'https://evil.test' }]) {
    const res = respuesta();
    await handler('/forgot-password')({ body }, res);
    assert.equal(res.code, 400);
  }
});

test('el cambio valida la sesión, actualiza solamente a su usuario y finaliza las sesiones renovables', async (t) => {
  const llamadas = [];
  t.mock.method(globalThis, 'fetch', async (input, options) => {
    const url = new URL(input);
    llamadas.push({ url, options });
    if (url.pathname.endsWith('/logout')) return new Response(null, { status: 204 });
    return json(user);
  });
  const res = respuesta();
  await handler('/reset-password')({ body: { ...bodyReset, user_id: 'otro-usuario', email: 'otro@example.test' } }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(llamadas.map(({ url, options }) => [options.method, url.pathname]), [['GET', '/auth/v1/user'], ['PUT', '/auth/v1/user'], ['POST', '/auth/v1/logout']]);
  assert.equal(JSON.parse(llamadas[1].options.body).password, bodyReset.password);
  assert.equal(JSON.parse(llamadas[1].options.body).email, undefined);
  assert.equal(new Headers(llamadas[1].options.headers).get('Authorization'), `Bearer ${jwt}`);
  assert.equal(new Headers(llamadas[1].options.headers).get('apikey'), 'anon-de-prueba');
  assert.equal(JSON.stringify(res.body).includes(jwt), false);
});

test('una sesión falsa o vencida nunca puede actualizar la contraseña', async (t) => {
  let escrituras = 0;
  t.mock.method(globalThis, 'fetch', async (_input, options) => {
    if (options.method === 'PUT') escrituras++;
    return json({ code: 'bad_jwt', message: 'Invalid token' }, 401);
  });
  const res = respuesta();
  await handler('/reset-password')({ body: bodyReset }, res);
  assert.equal(res.code, 401);
  assert.equal(escrituras, 0);
  for (const body of [{ password: 'Clave-123' }, { ...bodyReset, access_token: 'no-es-un-jwt' }, { ...bodyReset, access_token: 'a.b.c' }, { ...bodyReset, password: '123' }]) {
    const invalida = respuesta();
    await handler('/reset-password')({ body }, invalida);
    assert.ok([400, 401].includes(invalida.code));
  }
});

test('la contraseña anterior o débil permite corregir el formulario con un mensaje claro', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_input, options) => options.method === 'PUT'
    ? json({ code: 'same_password', message: 'New password should be different' }, 422) : json(user));
  const res = respuesta();
  await handler('/reset-password')({ body: bodyReset }, res);
  assert.equal(res.code, 400);
  assert.equal(res.body.error, 'La nueva contraseña debe ser distinta de la anterior.');
});

test('los límites de recuperación y login no comparten el contador de una misma IP', () => {
  const recuperar = crearRateLimit({ max: 1 });
  const login = crearRateLimit({ max: 1 });
  let permitidas = 0;
  const req = { ip: 'ip-de-prueba' };
  recuperar(req, respuesta(), () => permitidas++);
  login(req, respuesta(), () => permitidas++);
  assert.equal(permitidas, 2);
  const bloqueada = respuesta();
  recuperar(req, bloqueada, () => permitidas++);
  assert.equal(bloqueada.code, 429);
});
