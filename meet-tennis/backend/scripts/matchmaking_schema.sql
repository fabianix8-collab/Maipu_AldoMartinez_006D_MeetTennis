-- ==========================================================
-- Matchmaking Schema (MeetTennis) - Buscar Partido
-- ==========================================================
-- Run this SQL in your Supabase Dashboard → SQL Editor
-- Crea las tablas de disponibilidad compartida y solicitudes
-- de partido, necesarias para coordinar rivales y recomendar
-- la cancha más cercana entre dos jugadores.
-- ==========================================================

-- ----------------------------------------------------------
-- 1. Tabla: disponibilidad
--    Bloques de disponibilidad PUBLICADOS por cada usuario.
--    A diferencia del localStorage, aquí son visibles para
--    todos los usuarios y permiten encontrar rivales.
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS disponibilidad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  dias text[] NOT NULL DEFAULT '{}',
  desde time NOT NULL,
  hasta time NOT NULL,
  modalidad text NOT NULL DEFAULT 'Disponible para jugar',
  zona text,
  tipo_zona text DEFAULT '',
  latitud double precision,
  longitud double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disponibilidad_usuario
  ON disponibilidad(usuario_id);

-- ----------------------------------------------------------
-- 2. Tabla: solicitudes_partido
--    Invitaciones a jugar: un usuario propone un partido a un
--    rival con la cancha recomendada y un horario sugerido.
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS solicitudes_partido (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitante_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  receptor_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  -- La tabla 'canchas' usa id integer (no uuid), por eso cancha_id es integer.
  cancha_id integer REFERENCES canchas(id) ON DELETE SET NULL,
  cancha_nombre text,
  fecha_sugerida date,
  hora_desde time,
  hora_hasta time,
  mensaje text,
  estado text NOT NULL DEFAULT 'pendiente',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_receptor
  ON solicitudes_partido(receptor_id);

CREATE INDEX IF NOT EXISTS idx_solicitudes_solicitante
  ON solicitudes_partido(solicitante_id);

-- ----------------------------------------------------------
-- 3. RLS: disponibilidad
--    Cualquiera puede leer (necesario para el matchmaking),
--    pero cada usuario solo gestiona sus propios bloques.
-- ----------------------------------------------------------
ALTER TABLE disponibilidad ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Disponibilidad visible para autenticados" ON disponibilidad;
CREATE POLICY "Disponibilidad visible para autenticados"
  ON disponibilidad
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Disponibilidad visible para público" ON disponibilidad;
CREATE POLICY "Disponibilidad visible para público"
  ON disponibilidad
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Usuarios insertan su disponibilidad" ON disponibilidad;
CREATE POLICY "Usuarios insertan su disponibilidad"
  ON disponibilidad
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Usuarios actualizan su disponibilidad" ON disponibilidad;
CREATE POLICY "Usuarios actualizan su disponibilidad"
  ON disponibilidad
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

DROP POLICY IF EXISTS "Usuarios eliminan su disponibilidad" ON disponibilidad;
CREATE POLICY "Usuarios eliminan su disponibilidad"
  ON disponibilidad
  FOR DELETE
  TO authenticated
  USING (auth.uid() = usuario_id);

-- ----------------------------------------------------------
-- 4. RLS: solicitudes_partido
--    Solo los involucrados (solicitante o receptor) pueden ver
--    y modificar una solicitud.
-- ----------------------------------------------------------
ALTER TABLE solicitudes_partido ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Solicitudes visibles para involucrados" ON solicitudes_partido;
CREATE POLICY "Solicitudes visibles para involucrados"
  ON solicitudes_partido
  FOR SELECT
  TO authenticated
  USING (auth.uid() = solicitante_id OR auth.uid() = receptor_id);

DROP POLICY IF EXISTS "Usuarios crean solicitudes" ON solicitudes_partido;
CREATE POLICY "Usuarios crean solicitudes"
  ON solicitudes_partido
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = solicitante_id);

DROP POLICY IF EXISTS "Receptor actualiza solicitud" ON solicitudes_partido;
CREATE POLICY "Receptor actualiza solicitud"
  ON solicitudes_partido
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = receptor_id)
  WITH CHECK (auth.uid() = receptor_id);

-- ==========================================================
-- NOTA: El backend usa la service_role key (bypass de RLS),
-- por lo que estas políticas son una capa de seguridad extra
-- para accesos directos desde el cliente.
-- ==========================================================