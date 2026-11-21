-- ==========================================================
-- MeetTennis - Paso 9: rol de administrador
-- ==========================================================
-- Ejecutar en Supabase Dashboard → SQL Editor (una sola vez).
-- Es seguro volver a ejecutarlo. No promueve cuentas automáticamente.
--
-- Agrega a la tabla 'usuario' una columna de rol que controla el
-- acceso a herramientas internas, como el panel de monitoreo:
--   'jugador' (por defecto) → experiencia normal de la app
--   'admin'                 → puede ver el panel de monitoreo
--
-- Después de crear la columna, promueve una cuenta registrada con:
-- node scripts/promover_admin.mjs --aplicar --email correo-del-administrador
-- Los siguientes administradores se gestionan desde la app.
-- ==========================================================

-- 1. Columna de rol con su restricción de valores.
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS rol text NOT NULL DEFAULT 'jugador';

ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_rol_valido;
ALTER TABLE usuario ADD CONSTRAINT usuario_rol_valido
  CHECK (rol IN ('jugador', 'admin'));

-- 2. Verificación: lista los administradores existentes.
SELECT u.id, u.nombre, u.apellido, au.email, u.rol
FROM usuario u
LEFT JOIN auth.users au ON au.id = u.id
WHERE u.rol = 'admin';
