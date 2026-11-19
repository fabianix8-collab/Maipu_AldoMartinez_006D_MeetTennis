// Browser QA in a disposable, headless Chrome profile. Location and API data
// are simulated using two public venues; no user session or GPS is read.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const catalogo = JSON.parse(await fs.readFile(new URL('../../backend/data/canchas.json', import.meta.url), 'utf8'));
const canchas = ['maipu', 'lonquen'].map((clave, i) => ({ ...catalogo.canchas.find((c) => c.clave === clave), id: i + 1 }));
assert.equal(canchas[0].ubicacionFuente, 'https://www.openstreetmap.org/way/175940917');
let target;
for (let intento = 0; intento < 25; intento++) {
  try { target = await (await fetch('http://127.0.0.1:9223/json/new?about:blank', { method: 'PUT' })).json(); break; }
  catch (error) {
    if (intento === 24) throw error;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
let id = 0;
const pendientes = new Map();
const errores = [];
function send(method, params = {}) {
  return new Promise((resolve, reject) => { const numero = ++id; pendientes.set(numero, { resolve, reject }); ws.send(JSON.stringify({ id: numero, method, params })); });
}
ws.addEventListener('message', async (event) => {
  const message = JSON.parse(event.data);
  if (message.id) { const item = pendientes.get(message.id); pendientes.delete(message.id); if (message.error) item.reject(new Error(JSON.stringify(message.error))); else item.resolve(message.result); }
  if (message.method === 'Runtime.exceptionThrown') errores.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  if (message.method === 'Fetch.requestPaused') {
    const { requestId, request } = message.params;
    const data = request.url.includes('/api/courts') ? { canchas, comunas: ['Maipú'] } : {};
    await send('Fetch.fulfillRequest', { requestId, responseCode: 200,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
      body: Buffer.from(JSON.stringify({ success: true, data, error: null })).toString('base64') });
  }
});
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result?.value;
}
async function waitFor(expression, timeout = 30000) {
  const fin = Date.now() + timeout;
  while (Date.now() < fin) { if (await evaluate(expression)) return; await new Promise((resolve) => setTimeout(resolve, 150)); }
  throw new Error('Timed out: ' + expression + '\n' + await evaluate('document.body.innerText'));
}
async function screenshot(nombre) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await fs.mkdir('.local', { recursive: true });
  await fs.writeFile('.local/' + nombre + '.png', Buffer.from(data, 'base64'));
}
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*127.0.0.1:5173/api/*' }] });
  await send('Browser.grantPermissions', { origin: 'http://127.0.0.1:5173', permissions: ['geolocation'] });
  await send('Emulation.setGeolocationOverride', { latitude: canchas[0].latitud, longitude: canchas[0].longitud, accuracy: 10 });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('meettennis_language','es');localStorage.setItem('meettennis_auth',JSON.stringify({session:{access_token:'synthetic-public-venue-preview'},user:{id:'test'},profile:{nombre:'Preview'}}));` });
  await send('Page.navigate', { url: 'http://127.0.0.1:5173/canchas' });
  await waitFor("Boolean(document.querySelector('[aria-label=\"Cómo llegar a Club Lonquén\"]'))");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Cerca de mí').click()");
  await waitFor("document.body.innerText.includes('Usando tu ubicación actual')");
  await evaluate("document.querySelector('[aria-label=\"Cómo llegar a Club Lonquén\"]').click()");
  await waitFor("document.querySelector('.tennis-route-map')?.dataset.basemapReady === 'true' && document.querySelectorAll('.leaflet-overlay-pane path').length >= 2");
  assert.equal(await evaluate("document.querySelectorAll('[role=dialog]').length"), 1);
  const enlaceNavegacion = () => evaluate("document.querySelector('[role=dialog] a[href^=\"https://www.google.com/maps/dir/\"]').href");
  const urlAuto = new URL(await enlaceNavegacion());
  assert.equal(urlAuto.searchParams.get('travelmode'), 'driving');
  assert.equal(urlAuto.searchParams.get('destination'), `${canchas[1].latitud},${canchas[1].longitud}`);
  assert.equal(urlAuto.searchParams.has('origin'), false, 'Use current device location when navigation starts');
  assert.equal(await evaluate("document.querySelector('[role=dialog] a[href^=\"https://www.google.com/maps/dir/\"]').target"), '_blank');
  const desplazamiento = () => evaluate("getComputedStyle(document.querySelector('.tennis-route-flow')).strokeDashoffset");
  const primero = await desplazamiento();
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.notEqual(await desplazamiento(), primero, 'Route highlights must move');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.tennis-route-flow')).animationName"), 'none');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.tennis-map-origin-pulse')).animationName"), 'none');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.tennis-map-ball svg')).animationName"), 'none');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  console.log('Animation: route moves automatically; reduced motion disables movement.');
  await screenshot('route-desktop');
  console.log('Desktop: map tiles, street route and modal loaded.');
  await evaluate("[...document.querySelectorAll('[role=dialog] button')].find(b=>b.textContent.trim()==='A pie').click()");
  await waitFor("document.querySelector('.tennis-route-map')?.dataset.basemapReady === 'true' && [...document.querySelectorAll('[role=dialog] button')].some(b=>b.textContent.trim()==='A pie'&&b.getAttribute('aria-pressed')==='true')");
  assert.equal(new URL(await enlaceNavegacion()).searchParams.get('travelmode'), 'walking');
  assert.equal(await evaluate('location.pathname'), '/canchas', 'Preview stays inside the app until the user starts navigation');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await new Promise((resolve) => setTimeout(resolve, 600));
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  await screenshot('route-mobile');
  console.log('Mobile: walking route loaded without horizontal overflow.');
  await evaluate("document.querySelector('[aria-label=\"Cerrar recorrido\"]').click()");
  await send('Browser.setPermission', { permission: { name: 'geolocation' }, setting: 'denied', origin: 'http://127.0.0.1:5173' });
  await evaluate("document.querySelector('[aria-label=\"Cómo llegar a Club Lonquén\"]').click()");
  await waitFor("document.querySelector('[role=dialog]')?.innerText.includes('Activa tu ubicación en Cerca de mí')");
  assert.equal(await evaluate("document.querySelectorAll('[role=dialog] .tennis-route-map').length"), 0);
  console.log('Disabled location: prerequisite shown; no invented route.');
  assert.deepEqual(errores, []);
  console.log('No JavaScript exceptions. Screenshots: .local/route-desktop.png and .local/route-mobile.png');
} catch (error) {
  console.error(error.message);
  console.error('Browser exceptions: ' + JSON.stringify(errores));
  process.exitCode = 1;
} finally {
  await fetch('http://127.0.0.1:9223/json/close/' + target.id).catch(() => {});
  ws.close();
}
