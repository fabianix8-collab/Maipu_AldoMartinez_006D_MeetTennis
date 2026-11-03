-- ==========================================================
-- MeetTennis - Paso 9: rol de administrador
-- ==========================================================
-- Ejecutar en Supabase Dashboard → SQL Editor (una sola vez).
-- Es seguro volver a ejecutarlo: usa IF NOT EXISTS y los UPDATE
-- son idempotentes (puedes re-ejecutar al agregar más admins).
--
-- Agrega a la tabla 'usuario' una columna de rol que controla el
-- acceso a herramientas internas, como el panel de monitoreo:
--   'jugador' (por defecto) → experiencia normal de la app
--   'admin'                 → puede ver el panel de monitoreo
--
-- Los administradores se pueden promover de dos formas (basta con
-- que una de las dos coincida):
--   1) Por correo (vive en auth.users; la tabla pública guarda el id).
--   2) Por nombre completo (nombre + apellido, sin diferenciar
--      mayúsculas/minúsculas). Útil cuando no se sabe el correo.
-- ==========================================================

-- 1. Columna de rol con su restricción de valores.
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS rol text NOT NULL DEFAULT 'jugador';

ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_rol_valido;
ALTER TABLE usuario ADD CONSTRAINT usuario_rol_valido
  CHECK (rol IN ('jugador', 'admin'));

-- 2. Promover a administradores por correo (ajusta esta lista).
UPDATE usuario u
SET rol = 'admin'
WHERE EXISTS (
  SELECT 1
  FROM auth.users au
  WHERE au.id = u.id
    AND lower(au.email) IN (
      'admin@meettennis.cl'
      -- 'otro@correo.cl',
    )
);

-- 3. Promover a administradores por nombre completo (ajusta esta lista).
--    Se compara "nombre apellido" en minúsculas, así que el orden y la
--    ortografía deben coincidir con lo registrado al crear la cuenta.
UPDATE usuario
SET rol = 'admin'
WHERE lower(nombre || ' ' || apellido) IN (
  'tomy jerry',
  'pedro pascal'
);

-- 4. Verificación: lista los administradores (id + rol).
SELECT u.id, u.nombre, u.apellido, au.email, u.rol
FROM usuario u
LEFT JOIN auth.users au ON au.id = u.id
WHERE u.rol = 'admin';
