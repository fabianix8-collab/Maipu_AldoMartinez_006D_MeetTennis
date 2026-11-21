// Promueve solo las cuentas indicadas por correo. Sin --aplicar muestra el plan.
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

export function leerArgumentos(args) {
  const correos = new Set();
  let aplicar = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--aplicar') aplicar = true;
    else if (args[i] === '--email' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(args[i + 1] || '')) {
      correos.add(args[++i].trim().toLowerCase());
    } else throw new Error('Uso: node scripts/promover_admin.mjs --email correo [--email otro-correo] [--aplicar]');
  }
  if (!correos.size) throw new Error('Indica al menos una cuenta registrada con --email.');
  return { correos: [...correos], aplicar };
}

export function seleccionarAdministradores(perfiles, cuentas, correos) {
  if (!Array.isArray(perfiles) || !Array.isArray(cuentas)) throw new Error('No se pudieron verificar las cuentas.');
  const cuentasPorCorreo = new Map(cuentas.filter((cuenta) => cuenta.email)
    .map((cuenta) => [cuenta.email.toLowerCase(), cuenta]));
  return correos.map((correo) => {
    const cuenta = cuentasPorCorreo.get(correo);
    const perfil = perfiles.find((usuario) => usuario.id === cuenta?.id);
    if (!cuenta || !perfil) throw new Error(`No existe una cuenta y un perfil registrados para ${correo}.`);
    return { ...perfil, email: cuenta.email };
  });
}

async function main() {
  const { correos, aplicar } = leerArgumentos(process.argv.slice(2));
  dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: perfiles, error } = await client.from('usuario').select('id,nombre,apellido,rol');
  if (error) throw new Error(error.code === '42703' ? 'Ejecuta primero scripts/09_admin_rol.sql.' : error.message);
  const cuentas = [];
  for (let page = 1; ; page++) {
    const { data, error: cuentasError } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (cuentasError) throw new Error(cuentasError.message);
    cuentas.push(...data.users);
    if (data.users.length < 200) break;
  }
  const seleccionados = seleccionarAdministradores(perfiles, cuentas, correos);
  console.log(JSON.stringify({ aplicar, cuentas: seleccionados.map(({ id, nombre, apellido, email, rol }) =>
    ({ id, nombre, apellido, email, rolActual: rol })) }, null, 2));
  if (!aplicar) {
    console.log('Revision solamente. Usa --aplicar con los mismos correos para promover estas cuentas.');
    return;
  }
  const { data, error: actualizarError } = await client.from('usuario').update({ rol: 'admin' })
    .in('id', seleccionados.map((usuario) => usuario.id)).select('id,rol');
  if (actualizarError) throw new Error(actualizarError.message);
  if (data.length !== seleccionados.length || data.some((usuario) => usuario.rol !== 'admin')) {
    throw new Error('No se pudo verificar la promocion de todas las cuentas solicitadas.');
  }
  console.log(`Administradores verificados: ${data.length}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
