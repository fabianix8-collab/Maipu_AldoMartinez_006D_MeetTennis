-- ==========================================================
-- RLS de la tabla 'usuario' (MeetTennis)
-- ==========================================================
-- Ejecutar en Supabase Dashboard → SQL Editor.
--
-- Modelo de seguridad: el frontend NUNCA consulta Supabase
-- directamente; todo pasa por el backend, que usa la
-- service_role (ignora RLS) y aplica sus propias validaciones
-- (sesión, dueño del perfil, reglas de ascenso, etc.).
--
-- Por eso la tabla tiene RLS activado y NINGUNA política para
-- los roles anon/authenticated: con la anon key (que es pública)
-- no se puede leer ni modificar nada directamente.
-- ==========================================================

ALTER TABLE usuario ENABLE ROW LEVEL SECURITY;

-- Elimina las políticas antiguas si existían. Eran demasiado
-- abiertas: permitían leer todos los perfiles (incluida la fecha
-- de nacimiento), insertar perfiles falsos y cambiarse la
-- categoría saltándose las reglas del backend.
DROP POLICY IF EXISTS "Usuarios pueden ver perfiles" ON usuario;
DROP POLICY IF EXISTS "Usuarios pueden insertar su propio perfil" ON usuario;
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON usuario;
DROP POLICY IF EXISTS "Público puede ver perfiles" ON usuario;
DROP POLICY IF EXISTS "Público puede registrarse" ON usuario;
