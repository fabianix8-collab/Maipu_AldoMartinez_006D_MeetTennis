-- ==========================================================
-- MeetTennis - Paso 10: timestamps en la tabla usuario
-- ==========================================================
-- Ejecutar en Supabase Dashboard → SQL Editor (una sola vez).
-- Es seguro volver a ejecutarlo: usa IF NOT EXISTS.
--
-- La tabla 'usuario' no tenía created_at, lo que obligaba al panel de
-- monitoreo a pedir la fecha de registro a auth.users. Esta columna
-- agrega el timestamp en la tabla y lo rellena con la fecha real que
-- ya existe en auth.users para no perder el histórico.
-- ==========================================================

-- 1. Agregar sin default para poder recuperar la fecha real de las filas existentes.
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS created_at timestamptz;

-- 2. Rellenar el histórico con la fecha real de auth.users
--    (solo cuando aún esté NULL).
UPDATE usuario u
SET created_at = au.created_at
FROM auth.users au
WHERE au.id = u.id
  AND u.created_at IS NULL;

-- 3. Respaldo para perfiles antiguos sin cuenta de Auth y configuración de nuevas filas.
UPDATE usuario SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE usuario ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE usuario ALTER COLUMN created_at SET NOT NULL;

-- 4. Verificación: usuarios con y sin fecha.
SELECT
  COUNT(*) FILTER (WHERE created_at IS NOT NULL) AS con_fecha,
  COUNT(*) FILTER (WHERE created_at IS NULL)     AS sin_fecha,
  COUNT(*)                                       AS total
FROM usuario;
