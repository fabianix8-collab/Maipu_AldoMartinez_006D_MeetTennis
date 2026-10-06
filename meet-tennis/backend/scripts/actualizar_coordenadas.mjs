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

// Coordenadas precisas por nombre de cancha (Santiago de Chile).
const COORDENADAS = {
  'Club de Tenis Maipú': [-33.508905, -70.756532],
  'Club de Tenis Parque Araucano': [-33.4024, -70.5753],
  'Canchas de Tenis Parque O\'Higgins': [-33.4651, -70.6603],
  'Club de Tenis La Reina (Aldea del Encuentro)': [-33.4542, -70.5402],
  'Tenis Estadio Municipal de Las Condes': [-33.3987, -70.5367],
  'Club de Tenis San Miguel': [-33.4981, -70.6518],
  'Ciudad Deportiva USS (Ex Zamorano)': [-33.4285, -70.5402],
  'Club de Tenis Pato Cornejo': [-33.3856, -70.596],
  'Club de Tenis El Alba': [-33.3958, -70.5211],
  'Alto Tenis Peñalolén': [-33.4761, -70.5511],
  'Canchas Parque Mahuida': [-33.4452, -70.5153],
  'Club de Tenis La Florida': [-33.5222, -70.5842],
  'Club de Tenis Macul': [-33.4906, -70.5955],
  'Canchas Tenis San Joaquín': [-33.4953, -70.6256],
  'Club Náutico (Canchas Tenis)': [-33.4682, -70.6553],
  'Club de Tenis Conchalí': [-33.3865, -70.676],
  'Canchas Recoleta (Estadio Municipal)': [-33.397, -70.6419],
  'Canchas Parque Bernardo Leighton': [-33.4658, -70.6865],
  'Club de Tenis Rinconada': [-33.5165, -70.7726],
  'Estadio Modelo Pudahuel': [-33.4362, -70.7461],
  'Club de Tenis Providencia': [-33.4361, -70.598],
  'Club de Tenis Sucre': [-33.4491, -70.5952],
  'Club de Tenis Quinta Normal': [-33.4426, -70.6788],
  'Club de Tenis Chile': [-33.4615, -70.6591],
  'Club de Tenis Lo Cañas': [-33.5265, -70.5515],
  'Estadio El Llano': [-33.486, -70.6511],
  'Club de Tenis Independencia': [-33.3963, -70.666],
  'Ciudad Deportiva Universidad San Sebastián': [-33.3865, -70.6205],
  'Club de Tenis Puente Alto': [-33.6136, -70.579],
  'Canchas Tenis San Bernardo': [-33.5945, -70.7021],
  'Canchas Tenis Parque Cerrillos': [-33.4986, -70.716],
  'Estadio Municipal de Quilicura': [-33.36, -70.7291],
  'Club de Tenis La Cisterna': [-33.5263, -70.6655],
  'Canchas Tenis Cerro Navia': [-33.4225, -70.7316],
  'Complejo Deportivo La Granja': [-33.5375, -70.6231],
  'Estadio Municipal Pedro Aguirre Cerda': [-33.4906, -70.676],
};

async function main() {
  const { data: canchas, error } = await admin.from('canchas').select('id, nombre, latitud, longitud');
  if (error) {
    console.log('ERROR listar:', JSON.stringify(error));
    return;
  }

  let actualizadas = 0;
  for (const c of canchas || []) {
    const coords = COORDENADAS[c.nombre];
    if (coords && (coords[0] !== c.latitud || coords[1] !== c.longitud)) {
      const { error: upError } = await admin
        .from('canchas')
        .update({ latitud: coords[0], longitud: coords[1] })
        .eq('id', c.id);
      if (upError) {
        console.log('ERROR actualizar', c.id, c.nombre, JSON.stringify(upError));
      } else {
        actualizadas += 1;
        console.log(`  ${c.id} | ${c.nombre} -> ${coords[0]}, ${coords[1]}`);
      }
    }
  }
  console.log('Canchas actualizadas:', actualizadas);
}

main();