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

// Comunas de las canchas registradas (Santiago).
const COMUNAS = [
  'Cerrillos', 'Cerro Navia', 'Conchalí', 'Estación Central', 'Huechuraba',
  'Independencia', 'La Cisterna', 'La Florida', 'La Granja', 'La Reina',
  'Las Condes', 'Lo Barnechea', 'Macul', 'Maipú', 'Ñuñoa',
  'Pedro Aguirre Cerda', 'Peñalolén', 'Providencia', 'Pudahuel', 'Puente Alto',
  'Quilicura', 'Quinta Normal', 'Recoleta', 'San Bernardo', 'San Joaquín',
  'San Miguel', 'Santiago', 'Santiago Centro',
];

async function main() {
  // 1. Verificar que la columna comuna exista
  const { data: cols, error: colError } = await admin
    .from('usuario')
    .select('comuna')
    .limit(1);
  if (colError) {
    console.log('ERROR columna comuna:', JSON.stringify(colError));
    return;
  }
  console.log('1. Columna comuna OK');

  // 2. Usuarios sin comuna
  const { data: sinComuna, error: listError } = await admin
    .from('usuario')
    .select('id')
    .is('comuna', null);
  if (listError) {
    console.log('ERROR listar:', JSON.stringify(listError));
    return;
  }
  console.log('2. Usuarios sin comuna:', sinComuna.length);

  // 3. Asignar comuna aleatoria
  let actualizados = 0;
  for (const u of sinComuna) {
    const comuna = COMUNAS[Math.floor(Math.random() * COMUNAS.length)];
    const { error } = await admin
      .from('usuario')
      .update({ comuna })
      .eq('id', u.id);
    if (error) {
      console.log('ERROR actualizar', u.id, JSON.stringify(error));
    } else {
      actualizados += 1;
    }
  }
  console.log('3. Usuarios actualizados:', actualizados);

  // 4. Verificación
  const { data: conComuna, error: verError } = await admin
    .from('usuario')
    .select('id, comuna')
    .not('comuna', 'is', null)
    .limit(5);
  if (verError) {
    console.log('ERROR verificar:', JSON.stringify(verError));
  } else {
    console.log('4. Ejemplos con comuna:', JSON.stringify(conComuna));
  }
}

main();