import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;

// ----------------------------------------------------------
// Inicialización automática del esquema de matchmaking.
// Al iniciar el backend, verifica/crea las tablas
// 'disponibilidad' y 'solicitudes_partido' ejecutando el
// script backend/scripts/matchmaking_schema.sql.
//
// Requiere DATABASE_URL en .env:
//   Supabase → Settings → Database → Connection string → URI
//   Ej: postgresql://postgres.xxxx:[PASSWORD]@aws-0-xx.pooler.supabase.com:6543/postgres
// ----------------------------------------------------------
export async function initMatchmakingSchema() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.warn(
      '[initSchema] DATABASE_URL no configurada. Las tablas de matchmaking no se crearán automáticamente. ' +
        'Agrega DATABASE_URL en backend/.env o ejecuta backend/scripts/matchmaking_schema.sql manualmente en Supabase.',
    );
    return;
  }

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const schemaPath = path.resolve(__dirname, '../scripts/matchmaking_schema.sql');

  let sql;
  try {
    sql = await readFile(schemaPath, 'utf8');
  } catch (err) {
    console.error('[initSchema] No se pudo leer el script de esquema:', err.message);
    return;
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    await client.query(sql);
    console.log('[initSchema] Tablas de matchmaking verificadas/creadas correctamente.');
  } catch (err) {
    console.error('[initSchema] Error al crear las tablas de matchmaking:', err.message);
  } finally {
    await client.end().catch(() => {});
  }
}
