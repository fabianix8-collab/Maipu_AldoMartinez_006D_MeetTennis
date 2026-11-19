// Network smoke test between two public sports venues from the repository.
// No browser, geolocation API, session, user profile or private coordinates.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { cargarRuta } from '../src/lib/rutas.js';

const catalogo = JSON.parse(fs.readFileSync(new URL('../../backend/data/canchas.json', import.meta.url), 'utf8'));
const salida = catalogo.canchas.find((c) => c.clave === 'maipu');
const llegada = catalogo.canchas.find((c) => c.clave === 'lonquen');
assert.equal(salida.ubicacionFuente, 'https://www.openstreetmap.org/way/175940917');
assert.equal(llegada.ubicacionFuente, 'https://www.openstreetmap.org/way/238755053');
for (const modo of ['auto', 'pie']) {
  const ruta = await cargarRuta({ lat: salida.latitud, lng: salida.longitud }, llegada, modo);
  console.log(JSON.stringify({ desde: salida.nombre, hasta: llegada.nombre, modo,
    metros: ruta.distancia, segundos: ruta.duracion, puntos: ruta.puntos.length, pasos: ruta.pasos.length }));
}
