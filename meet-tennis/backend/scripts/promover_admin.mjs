// ==========================================================
// MeetTennis - Promover administradores (asistente local)
// ==========================================================
// Usa las credenciales de backend/.env (SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY). NUNCA imprime ni comparte las
// claves: todo ocurre en esta máquina.
//
// Busca los usuarios por nombre y/o correo, los muestra y, con
// --aplicar, actualiza su rol a 'admin' en la tabla usuario.
//
// Uso (desde backend/):
//   node scripts/promover_admin.mjs                → solo muestra (dry run)
//   node scripts/promover_admin.mjs --aplicar      → aplica los cambios
//   node scripts/promover_admin.mjs --aplicar --email alice@x.cl
//                                                   → además promueve un correo
//
// Requisito: la columna "rol" debe existir en 'usuario' (ejecutar
// scripts/09_admin_rol.sql una vez en Supabase → SQL Editor).
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

const url = get('SUPABASE_URL');
const key = get('SUPABASE_SERVICE_ROLE_KEY');

if (!url || !key) {
  console.error('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en backend/.env');
  process.exit(1);
}

const client = createClient(url, key);

const aplicar = process.argv.includes('--aplicar');

// Emails extra pasados como --email a@x.cl --email b@y.cl
const emailsExtras = [];
process.argv.forEach((arg, i) => {
  if (arg === '--email' && process.argv[i + 1]) emailsExtras.push(process.argv[i + 1].trim().toLowerCase());
});

// Objetivos por nombre completo (todas las palabras deben aparecer en
// "nombre apellido", sin diferenciar mayúsculas).
const OBJETIVOS_POR_NOMBRE = [
  { palabras: ['tomy', 'jerry'], etiqueta: 'Tomy Jerry' },
  { palabras: ['pedro', 'pascal'], etiqueta: 'Pedro Pascal' },
];

async function existeColumnaRol() {
  const { error } = await client.from('usuario').select('rol').limit(1);
  return !error;
}

async function listarUsuarios() {
  const { data, error } = await client.from('usuario').select('id, nombre, apellido');
  if (error) throw error;
  return data || [];
}

async function mapEmails() {
  const mapa = new Map();
  try {
    for (let page = 1; ; page += 1) {
      const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
      if (error) break;
      for (const u of data.users) mapa.set(u.id, u.email);
      if (data.users.length < 200) break;
    }
  } catch {
    // Sin emails: no bloquea la promoción por nombre.
  }
  return mapa;
}

function coincide(usuario, palabras) {
  const texto = `${usuario.nombre || ''} ${usuario.apellido || ''}`.toLowerCase();
  return palabras.every((p) => texto.includes(p));
}

async function main() {
  const columna = await existeColumnaRol();
  if (!columna) {
    console.log('La columna "rol" aún no existe en la tabla "usuario".');
    console.log('Ejecuta UNA VEZ en Supabase → SQL Editor este bloque:');
    console.log('');
    console.log("  ALTER TABLE usuario ADD COLUMN IF NOT EXISTS rol text NOT NULL DEFAULT 'jugador';");
    console.log('  ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_rol_valido;');
    console.log("  ALTER TABLE usuario ADD CONSTRAINT usuario_rol_valido CHECK (rol IN ('jugador', 'admin'));");
    console.log('');
    console.log('Después vuelve a ejecutar este script.');
    process.exit(1);
  }

  const usuarios = await listarUsuarios();
  const emails = await mapEmails();
  const aPromover = new Map(); // id -> { objetivo, usuario, por }

  for (const objetivo of OBJETIVOS_POR_NOMBRE) {
    for (const u of usuarios.filter((x) => coincide(x, objetivo.palabras))) {
      if (!aPromover.has(u.id)) aPromover.set(u.id, { objetivo: objetivo.etiqueta, usuario: u, por: 'nombre' });
    }
  }

  if (emailsExtras.length > 0) {
    for (const u of usuarios) {
      const correo = emails.get(u.id) || '';
      if (emailsExtras.includes(correo.toLowerCase()) && !aPromover.has(u.id)) {
        aPromover.set(u.id, { objetivo: correo, usuario: u, por: 'correo' });
      }
    }
  }

  const lista = [...aPromover.values()];

  if (lista.length === 0) {
    console.log('No se encontraron usuarios que coincidan con los objetivos.');
    console.log('');
    console.log('Usuarios registrados actualmente:');
    for (const u of usuarios) {
      const correo = emails.get(u.id) || '(sin correo visible)';
      console.log(`  - ${u.nombre || '?'} ${u.apellido || '?'}  <${correo}>`);
    }
    console.log('');
    console.log('Revisa la ortografía exacta o pásalos por --email (p. ej. --email tomy@x.cl).');
    return;
  }

  console.log(aplicar ? 'APLICANDO promoción a admin:\n' : 'DRY RUN: se promoverían a admin:\n');
  for (const { objetivo, usuario, por } of lista) {
    const correo = emails.get(usuario.id) || '(sin correo visible)';
    console.log(`  · ${usuario.nombre || '?'} ${usuario.apellido || '?'} <${correo}>  [${objetivo} | por ${por}]`);
  }

  if (aplicar) {
    const ids = lista.map((x) => x.usuario.id);
    const { data, error } = await client
      .from('usuario')
      .update({ rol: 'admin' })
      .in('id', ids)
      .select('id, nombre, apellido, rol');

    if (error) {
      console.error('\nERROR al actualizar:', error.message);
      process.exit(1);
    }

    console.log(`\n✓ Promovidos ${data.length} administrador(es):`);
    for (const u of data) console.log(`  - ${u.nombre} ${u.apellido} (${u.rol})`);
    console.log('\nListo. Recarga la app y el ícono de monitoreo aparecerá para ellos.');
  } else {
    console.log('\nCierra el "ojo": ejecuta con --aplicar para comprometer los cambios.');
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
