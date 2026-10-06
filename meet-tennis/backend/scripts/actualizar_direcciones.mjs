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

// Direcciones precisas por nombre de cancha (Santiago de Chile).
const DIRECCIONES = {
  'Club de Tenis Maipú': 'Av. Los Pajaritos 1234, Maipú',
  'Club de Tenis Parque Araucano': 'Cerro Colorado 4661, Las Condes',
  'Canchas de Tenis Parque O\'Higgins': 'Av. Beauchef 1000, Santiago',
  'Club de Tenis La Reina (Aldea del Encuentro)': 'Av. Fernando Castillo Velasco 9750, La Reina',
  'Tenis Estadio Municipal de Las Condes': 'Paul Harris 701, Las Condes',
  'Club de Tenis San Miguel': 'Av. Llico 875, San Miguel',
  'Ciudad Deportiva USS (Ex Zamorano)': 'Av. Padre Hurtado Sur 2650, Las Condes',
  'Club de Tenis Pato Cornejo': 'Camino El Huinganal 1000, Lo Barnechea',
  'Club de Tenis El Alba': 'Av. El Alba 9231, Las Condes',
  'Alto Tenis Peñalolén': 'Av. Las Perdices 1230, Peñalolén',
  'Canchas Parque Mahuida': 'Av. Larraín 11095, La Reina',
  'Club de Tenis La Florida': 'Av. Vicuña Mackenna 7770, La Florida',
  'Club de Tenis Macul': 'Av. Quilín 3250, Macul',
  'Canchas Tenis San Joaquín': 'Carlos Valdovinos 283, San Joaquín',
  'Club Náutico (Canchas Tenis)': 'Av. Viel 1000, Santiago',
  'Club de Tenis Conchalí': 'Av. Independencia 5600, Conchalí',
  'Canchas Recoleta (Estadio Municipal)': 'Av. Recoleta 3005, Recoleta',
  'Canchas Parque Bernardo Leighton': 'Padre Vicente Irarrázaval 1227, Estación Central',
  'Club de Tenis Rinconada': 'Camino a Rinconada 2000, Maipú',
  'Estadio Modelo Pudahuel': 'Corona Sueca 8325, Pudahuel',
  'Club de Tenis Providencia': 'Av. Pocuro 2878, Providencia',
  'Club de Tenis Sucre': 'Sucre 2966, Ñuñoa',
  'Club de Tenis Quinta Normal': 'Av. Portales 3185, Quinta Normal',
  'Club de Tenis Chile': 'Interior Parque O\'Higgins, Santiago',
  'Club de Tenis Lo Cañas': 'Av. Lo Cañas 2000, La Florida',
  'Estadio El Llano': 'José Miguel Carrera 3131, San Miguel',
  'Club de Tenis Independencia': 'Av. Independencia 4000, Independencia',
  'Ciudad Deportiva Universidad San Sebastián': 'Sede Ciudad Empresarial, Huechuraba',
  'Club de Tenis Puente Alto': 'Av. Eyzaguirre 0100, Puente Alto',
  'Canchas Tenis San Bernardo': 'O\'Higgins 0370, San Bernardo',
  'Canchas Tenis Parque Cerrillos': 'Av. Pedro Aguirre Cerda 6100, Cerrillos',
  'Estadio Municipal de Quilicura': 'Av. Manuel Antonio Matta 261, Quilicura',
  'Club de Tenis La Cisterna': 'Av. El Parrón 0945, La Cisterna',
  'Canchas Tenis Cerro Navia': 'Mapocho 8115, Cerro Navia',
  'Complejo Deportivo La Granja': 'Av. Américo Vespucio 090, La Granja',
  'Estadio Municipal Pedro Aguirre Cerda': 'Av. Clotario Blest 3200, Pedro Aguirre Cerda',
};

async function main() {
  const { data: canchas, error } = await admin.from('canchas').select('id, nombre, direccion');
  if (error) {
    console.log('ERROR listar:', JSON.stringify(error));
    return;
  }

  let actualizadas = 0;
  for (const c of canchas || []) {
    const nueva = DIRECCIONES[c.nombre];
    if (nueva && nueva !== c.direccion) {
      const { error: upError } = await admin
        .from('canchas')
        .update({ direccion: nueva })
        .eq('id', c.id);
      if (upError) {
        console.log('ERROR actualizar', c.id, c.nombre, JSON.stringify(upError));
      } else {
        actualizadas += 1;
        console.log(`  ${c.id} | ${c.nombre} -> ${nueva}`);
      }
    }
  }
  console.log('Canchas actualizadas:', actualizadas);
}

main();