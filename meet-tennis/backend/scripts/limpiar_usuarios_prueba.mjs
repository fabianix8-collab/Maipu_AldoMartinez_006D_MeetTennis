// Sin --confirmar solo revisa. Elimina únicamente perfiles sin foto, sin correo
// y sin cuenta de acceso; respalda primero los registros afectados en .local/.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { esUuid } from '../src/lib/utils.js';

const vacio = (valor) => valor == null || (typeof valor === 'string' && !valor.trim());

export function seleccionarPerfilesPrueba(perfiles, cuentas) {
  if (!Array.isArray(cuentas)) throw new Error('No se pudo verificar la lista de cuentas de acceso.');
  const cuentasIds = new Set(cuentas.map((cuenta) => cuenta.id));
  return perfiles.filter((perfil) => esUuid(perfil.id)
    && perfil.rol === 'jugador'
    && !cuentasIds.has(perfil.id)
    && ['email', 'correo', 'avatar_url', 'foto', 'foto_url'].every((campo) => vacio(perfil[campo])));
}

async function leerTabla(db, tabla, filtro) {
  const filas = [];
  for (let offset = 0; ; offset += 500) {
    let consulta = db.from(tabla).select('*').order('id').range(offset, offset + 499);
    if (filtro) consulta = consulta.or(filtro);
    const { data, error } = await consulta;
    if (error) throw new Error(`${tabla}: ${error.message}`);
    filas.push(...data);
    if (data.length < 500) return filas;
  }
}

async function leerCuentas(db) {
  const cuentas = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 500 });
    // Un fallo de Auth nunca se interpreta como ausencia de correo/cuenta.
    if (error) throw new Error(`No se pudo revisar Auth: ${error.message}`);
    cuentas.push(...data.users);
    if (data.users.length < 500) return cuentas;
  }
}

const filtroIds = (columnas, ids) => columnas.map((columna) => `${columna}.in.(${ids.join(',')})`).join(',');

export async function limpiarUsuariosPrueba({ confirmar = false, respaldar = false, esperados } = {}) {
  dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const perfiles = await leerTabla(db, 'usuario');
  const cuentas = await leerCuentas(db);
  const candidatos = seleccionarPerfilesPrueba(perfiles, cuentas);
  console.log(JSON.stringify({ perfiles: perfiles.length, candidatos: candidatos.length,
    conservados: perfiles.length - candidatos.length }, null, 2));
  if (esperados !== undefined && candidatos.length !== esperados) {
    throw new Error('La cantidad de candidatos cambió; revisar antes de borrar.');
  }
  if (!candidatos.length) return;
  const ids = candidatos.map((perfil) => perfil.id);
  const afectados = { usuario: candidatos };
  const relaciones = {
    disponibilidad: ['usuario_id'],
    partidos: ['jugador1_id', 'jugador2_id', 'ganador_id'],
    solicitudes_partido: ['solicitante_id', 'receptor_id'],
    resenas: ['autor_id', 'jugador_id'],
    conversaciones: ['usuario1_id', 'usuario2_id'],
  };
  for (const [tabla, columnas] of Object.entries(relaciones)) {
    afectados[tabla] = await leerTabla(db, tabla, filtroIds(columnas, ids));
  }
  const conversacionesIds = afectados.conversaciones.map((fila) => fila.id);
  if (!conversacionesIds.every((id) => /^\d+$/.test(String(id)))) throw new Error('ID de conversación no válido.');
  const filtrosMensajes = [filtroIds(['remitente_id'], ids)];
  if (conversacionesIds.length) filtrosMensajes.push(filtroIds(['conversacion_id'], conversacionesIds));
  afectados.mensajes = await leerTabla(db, 'mensajes', filtrosMensajes.join(','));
  console.log(JSON.stringify({ registrosRelacionados: Object.fromEntries(
    Object.entries(afectados).map(([tabla, filas]) => [tabla, filas.length])),
  }, null, 2));
  if (!confirmar && !respaldar) {
    console.log('Revisión solamente. Usa --respaldar para guardar una copia sin borrar datos.');
    return;
  }
  if (!Number.isInteger(esperados) || esperados < 1) throw new Error('Indica --esperados con la cantidad revisada.');

  const fecha = new Date().toISOString().replace(/[:.]/g, '-');
  const respaldo = new URL(`../.local/usuarios-prueba-${fecha}.json`, import.meta.url);
  await mkdir(new URL('../.local/', import.meta.url), { recursive: true });
  await writeFile(respaldo, JSON.stringify({ fecha, tablas: afectados }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(`Respaldo local: ${fileURLToPath(respaldo)}`);
  if (!confirmar) {
    console.log('Respaldo guardado. No se eliminó ningún dato.');
    return;
  }

  const perfilesActuales = await leerTabla(db, 'usuario', filtroIds(['id'], ids));
  const todaviaCandidatos = seleccionarPerfilesPrueba(perfilesActuales, await leerCuentas(db));
  if (todaviaCandidatos.length !== ids.length) throw new Error('Los perfiles cambiaron; no se borró nada.');
  // Una única petición DELETE: Postgres aplica las cascadas en su transacción.
  // Los filtros vuelven a proteger el rol y la foto al momento de la escritura.
  const { data: eliminados, error } = await db.from('usuario').delete().in('id', ids)
    .eq('rol', 'jugador').or('avatar_url.is.null,avatar_url.eq.').select('id');
  if (error) throw new Error(`No se pudo eliminar: ${error.message}`);
  if (eliminados.length !== ids.length) throw new Error('Se eliminaron menos perfiles de los previstos; revisar el respaldo.');

  const restantes = await leerTabla(db, 'usuario');
  const restantesIds = new Set(restantes.map((perfil) => perfil.id));
  const seleccionadosIds = new Set(ids);
  if (ids.some((id) => restantesIds.has(id))
    || perfiles.some((perfil) => !seleccionadosIds.has(perfil.id) && !restantesIds.has(perfil.id))) {
    throw new Error('La comprobación de perfiles restantes detectó diferencias.');
  }
  for (const [tabla, columnas] of Object.entries(relaciones)) {
    if ((await leerTabla(db, tabla, filtroIds(columnas, ids))).length) {
      throw new Error(`Quedaron registros relacionados en ${tabla}.`);
    }
  }
  if ((await leerTabla(db, 'mensajes', filtrosMensajes.join(','))).length) throw new Error('Quedaron mensajes relacionados.');
  const cuentasFinales = await leerCuentas(db);
  if (cuentas.some((cuenta) => !cuentasFinales.some((actual) => actual.id === cuenta.id))) {
    throw new Error('Cambió la lista de cuentas de acceso; revisar.');
  }
  console.log(JSON.stringify({ eliminados: eliminados.length, perfilesRestantes: restantes.length,
    candidatosRestantes: seleccionarPerfilesPrueba(restantes, cuentasFinales).length,
    cuentasDeAccesoConservadas: cuentas.length, verificado: true }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const indice = process.argv.indexOf('--esperados');
  limpiarUsuariosPrueba({ confirmar: process.argv.includes('--confirmar'),
    respaldar: process.argv.includes('--respaldar'),
    esperados: indice === -1 ? undefined : Number(process.argv[indice + 1]),
  }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
