// Consulta las coordenadas publicadas por Easycancha; no modifica Supabase.
// Uso: node scripts/consultar_ubicaciones_canchas.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const catalogo = JSON.parse(await readFile(new URL('../data/canchas.json', import.meta.url), 'utf8'));
const resultados = [];
if (process.argv.includes('--paginas')) {
  for (const url of process.argv.slice(process.argv.indexOf('--paginas') + 1)) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const html = await response.text();
      const contextos = [...html.matchAll(/.{0,90}(?:latitude|longitude|latitud|longitud|maps\/embed|maps.google|google.com\/maps|!3d-33|!4d-70|APP_INITIALIZATION_STATE|-33\.\d+|-70\.\d+|\blat\b|\blon\b|\blng\b).{0,190}/gi)].map((m) => m[0]);
      const geos = [];
      const recorrer = (valor) => {
        if (!valor || typeof valor !== 'object') return;
        if (valor.name && valor.geo) geos.push({ nombre: valor.name, geo: valor.geo, direccion: valor.address });
        for (const hijo of Object.values(valor)) recorrer(hijo);
      };
      for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try { recorrer(JSON.parse(match[1])); } catch { /* Otra marca de datos no válida. */ }
      }
      if (geos.length) console.log(JSON.stringify({ url, geos: geos.filter((g) => /tenis|tennis|soto|gabriela|faustina|san francisco|lo cañas|vitacura/i.test(g.nombre)) }));
      else console.log(JSON.stringify({ url, status: response.status, contextos: contextos.slice(0, 8) }));
      resultados.push({ url, status: response.status, contextos, geos });
    } catch (error) { console.log(JSON.stringify({ url, error: error.message })); }
  }
  await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
  await writeFile(new URL('../.local/ubicaciones-paginas.json', import.meta.url), JSON.stringify(resultados, null, 2));
  process.exit(0);
}
if (process.argv.includes('--otras')) {
  for (const cancha of catalogo.canchas.filter((c) => !c.easycancha && c.latitud === null)) {
    const consultas = {
      lonquen: 'Club Lonquen, Maipú', anachena: 'Anachena, Maipú',
      'victor-jara': 'Víctor Jara 8717, Pudahuel', modelo: 'Estadio Modelo, Pudahuel',
      'plaza-mexico': 'Plaza México, Quinta Normal', 'alto-macul': 'Club Alto Macul, La Florida',
      santuario: 'Santuario del Valle, Lo Barnechea', 'san-bernardo': 'Baquedano 1200, San Bernardo',
      'san-joaquin': 'Sierra Bella 2836, San Joaquín', 'ex-federacion': 'José Joaquín Prieto 4040, San Miguel',
      'soto-aguilar': 'Soto Aguilar 1520, San Miguel', brasil: 'Canchas de tenis, La Granja',
      vitacura: 'Club Vitacura, Vitacura', nacional: 'Centro de Tenis, Ñuñoa',
      amador: 'Amador Donoso, Puente Alto', gabriela: 'Complejo Deportivo Gabriela, Puente Alto',
      laurita: 'Laurita Vicuña, Puente Alto', faustina: 'Santa Faustina, Puente Alto',
      tocornal: 'Parque Municipal Domingo Tocornal, Puente Alto', 'san-francisco': 'Parque San Francisco, Puente Alto',
    };
    const consulta = process.argv.includes('--nombre')
      ? consultas[cancha.clave] || cancha.nombre + ', Santiago, Chile'
      : cancha.nombre + ', ' + cancha.direccion;
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.search = new URLSearchParams({ q: consulta, format: 'jsonv2', countrycodes: 'cl', limit: '3', addressdetails: '1' });
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'MeetTennis-court-catalog-review/1.0' }, signal: AbortSignal.timeout(15000) });
      const lugares = response.ok ? await response.json() : [];
      const resultado = { clave: cancha.clave, consulta, url: url.href, status: response.status, lugares };
      resultados.push(resultado);
      console.log(JSON.stringify(resultado));
    } catch (error) {
      console.log(JSON.stringify({ clave: cancha.clave, error: error.message }));
    }
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }
  await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
  await writeFile(new URL(`../.local/ubicaciones-otras${process.argv.includes('--nombre') ? '-nombres' : ''}.json`, import.meta.url), JSON.stringify(resultados, null, 2));
  process.exit(0);
}
for (const cancha of catalogo.canchas) {
  if (!cancha.easycancha) continue;
  const url = `https://www.easycancha.com/es-CL/chile/club/${cancha.easycancha}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const html = await response.text();
    const json = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s)?.[1];
    const slug = json ? JSON.parse(json).props?.pageProps?.slug : null;
    const resultado = { clave: cancha.clave, url, status: response.status,
      nombre: slug?.clubName, latitud: slug?.latitude, longitud: slug?.longitude,
      direccion: slug?.address, datos: slug };
    resultados.push(resultado);
    console.log(JSON.stringify({ ...resultado, datos: undefined }));
  } catch (error) {
    resultados.push({ clave: cancha.clave, url, error: error.message });
    console.log(JSON.stringify({ clave: cancha.clave, error: error.message }));
  }
}
await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
await writeFile(new URL('../.local/ubicaciones-easycancha.json', import.meta.url), JSON.stringify(resultados, null, 2));
