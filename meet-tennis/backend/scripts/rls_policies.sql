-- ==========================================================
-- RLS Policies for the 'usuario' table (MeetTennis)
-- ==========================================================
-- Run this SQL in your Supabase Dashboard → SQL Editor
-- ==========================================================

-- 1. Enable RLS on the table (if not already enabled)
ALTER TABLE usuario ENABLE ROW LEVEL SECURITY;

-- 2. Allow any authenticated user to SELECT from usuario
--    (needed for ranking, profiles, etc.)
CREATE POLICY "Usuarios pueden ver perfiles"
  ON usuario
  FOR SELECT
  TO authenticated
  USING (true);

-- 3. Allow users to INSERT their own profile during registration
--    The id must match the authenticated user's id
CREATE POLICY "Usuarios pueden insertar su propio perfil"
  ON usuario
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- 4. Allow users to UPDATE their own profile
CREATE POLICY "Usuarios pueden actualizar su propio perfil"
  ON usuario
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 5. Allow anon/public access to SELECT from usuario
--    (needed for the ranking view before login)
CREATE POLICY "Público puede ver perfiles"
  ON usuario
  FOR SELECT
  TO anon
  USING (true);

-- 6. Allow anon to INSERT during registration
--    (the backend uses the service_role key, but this is a fallback)
CREATE POLICY "Público puede registrarse"
  ON usuario
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- ==========================================================
-- NOTA: Si las políticas anteriores no funcionan con la clave
-- de anon, asegúrate de que la opción "Force RLS" esté
-- DESACTIVADA en la tabla 'usuario' de Supabase Dashboard.
-- ==========================================================