// ==========================================================
// Geocodifica las canchas con la API de Google Maps para obtener
// las coordenadas EXACTAS (latitud/longitud) de cada dirección.
//
// Requisitos:
//   1. Tener una API key de Google Maps con la "Geocoding API"
//      habilitada (https://console.cloud.google.com/google/maps-apis).
//   2. Definir GOOGLE_MAPS_API_KEY en backend/.env.
//
// Uso (desde backend/):
//   node scripts/geocodificar_canchas.mjs
//
// Actualiza latitud/longitud en la tabla "canchas" a partir de la
// dirección guardada. No modifica las direcciones.
// ==========================================================

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const get = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, 'm'));
  return m ? m[1].trim() : null;
};

const admin = createClient(get('SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'));
const API_KEY = get('GOOGLE_MAPS_API_KEY');

if (!API_KEY) {
  console.error(
    'Define GOOGLE_MAPS_API_KEY en backend/.env (Google Maps Geocoding API).',
  );
  process.exit(1);
}

// Geocodifica una dirección y devuelve { lat, lng, direccionFormateada }.
async function geocodificar(direccion) {
  const url =
    'https://maps.googleapis.com/maps/api/geocode/json' +
    `?address=${encodeURIComponent(direccion)}&key=${API_KEY}&region=cl`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== 'OK' || !data.results?.[0]?.geometry?.location) {
    return null;
  }

  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng, direccionFormateada: data.results[0].formatted_address };
}

async function main() {
  const { data: canchas, error } = await admin
    .from('canchas')
    .select('id, nombre, direccion, latitud, longitud');

  if (error) {
    console.error('ERROR listar:', error.message);
    return;
  }

  let actualizadas = 0;
  let sinDireccion = 0;
  let sinResultado = 0;

  for (const c of canchas || []) {
    if (!c.direccion) {
      sinDireccion += 1;
      console.log(`  (sin dirección) ${c.nombre}`);
      continue;
    }

    const resultado = await geocodificar(c.direccion);
    if (!resultado) {
      sinResultado += 1;
      console.log(`  (sin resultado) ${c.nombre} — ${c.direccion}`);
      continue;
    }

    const { error: upError } = await admin
      .from('canchas')
      .update({ latitud: resultado.lat, longitud: resultado.lng })
      .eq('id', c.id);

    if (upError) {
      console.log('ERROR actualizar', c.id, c.nombre, upError.message);
    } else {
      actualizadas += 1;
      console.log(
        `  ${c.id} | ${c.nombre} -> ${resultado.lat}, ${resultado.lng}` +
          `  (${resultado.direccionFormateada})`,
      );
    }
  }

  console.log('\nResumen:');
  console.log('  Actualizadas:', actualizadas);
  console.log('  Sin dirección:', sinDireccion);
  console.log('  Sin resultado:', sinResultado);
}

main();