// Sin --confirmar solamente revisa el plan. No borra canchas históricas.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { catalogoCanchas, nombresCanchasVigentes, planificarCatalogo } from '../src/lib/catalogoCanchas.js';

export async function actualizarCatalogo() {
  dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: actuales, error } = await db.from('canchas').select('*').order('id');
  if (error) throw new Error(error.message);
  const plan = planificarCatalogo(actuales);
  if (process.argv.includes('--resumen')) {
    const { data: listado, error: listadoError } = await db.from('canchas')
      .select('id, nombre, direccion, latitud, longitud').in('nombre', nombresCanchasVigentes);
    if (listadoError) throw new Error(listadoError.message);
    console.log(JSON.stringify({ altas: plan.altas.length, cambios: plan.cambios.length,
      vigentesSinCambios: plan.sinCambios.length, listadoApi: listado.length, historicas: plan.retiradas.length,
      diferencias: plan.cambios.map(({ antes, despues }) => ({ id: antes.id,
        almacenadas: [antes.latitud, antes.longitud], catalogo: [despues.latitud, despues.longitud] })) }, null, 2));
    return;
  }
  console.log(JSON.stringify({ revisadoEl: catalogoCanchas.revisadoEl,
    altas: plan.altas.map((c) => ({ id: c.id, nombre: c.nombre, direccion: c.direccion })),
    cambios: plan.cambios.map(({ antes, despues }) => ({ id: antes.id, antes: antes.nombre, ...despues })),
    retiradasDeLosListados: plan.retiradas.map((c) => ({ id: c.id, nombre: c.nombre })),
    sinCambios: plan.sinCambios.length }, null, 2));

  if (!process.argv.includes('--confirmar')) {
    console.log('Revisión solamente. Usa --confirmar para sincronizar el catálogo.');
    return;
  }
  if (!plan.altas.length && !plan.cambios.length) {
    console.log('El catálogo ya está sincronizado.');
    return;
  }

  const fecha = new Date().toISOString().replace(/[:.]/g, '-');
  const respaldo = new URL(`../.local/canchas-antes-${fecha}.json`, import.meta.url);
  await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
  await writeFile(respaldo, JSON.stringify({ fecha, canchas: actuales }, null, 2), { flag: 'wx' });
  console.log(`Respaldo: ${fileURLToPath(respaldo)}`);

  // INSERT evita sobrescribir un ID creado concurrentemente. Las referencias
  // de disponibilidad, solicitudes y resultados no se modifican ni se borran.
  if (plan.altas.length) {
    const { error: insertarError } = await db.from('canchas').insert(plan.altas);
    if (insertarError) throw new Error(insertarError.message);
  }
  for (const { antes, despues } of plan.cambios) {
    const { data, error: actualizarError } = await db.from('canchas').update(despues)
      .eq('id', antes.id).eq('nombre', antes.nombre).select('id').single();
    if (actualizarError || !data) throw new Error(actualizarError?.message || `Cambió la cancha ${antes.id}; revisar antes de continuar.`);
  }
  const { data: resultado, error: verificarError } = await db.from('canchas').select('*');
  if (verificarError) throw new Error(verificarError.message);
  const pendiente = planificarCatalogo(resultado);
  if (pendiente.altas.length || pendiente.cambios.length) throw new Error('La verificación detectó diferencias pendientes.');
  console.log(`Verificado: ${catalogoCanchas.canchas.length} recintos vigentes; ${pendiente.retiradas.length} registros históricos fuera de los listados.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  actualizarCatalogo().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
