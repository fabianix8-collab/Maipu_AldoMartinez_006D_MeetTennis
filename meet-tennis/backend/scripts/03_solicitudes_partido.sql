-- ==========================================================
-- MeetTennis - Paso 3: solicitudes de partido (Buscar partido)
-- ==========================================================
-- Ejecutar en Supabase Dashboard → SQL Editor, DESPUÉS del
-- script 02_disponibilidad_partidos.sql (una sola vez).
-- Es seguro volver a ejecutarlo: no borra datos y cada paso
-- comprueba si ya se hizo.
-- ==========================================================

-- ----------------------------------------------------------
-- 0. Respaldo de la tabla con el formato anterior.
--    La versión previa (matchmaking_schema.sql) usaba id uuid,
--    horario opcional y políticas RLS abiertas. En vez de borrarla
--    se renombra a solicitudes_partido_old (con sus índices y
--    restricciones) y sus datos se migran en el paso 2.
-- ----------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'solicitudes_partido'
      AND column_name = 'id'
      AND data_type = 'uuid'
  ) OR to_regclass('public.solicitudes_partido_old') IS NOT NULL THEN
    RETURN;
  END IF;

  ALTER TABLE solicitudes_partido RENAME TO solicitudes_partido_old;

  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.solicitudes_partido_old'::regclass
  LOOP
    EXECUTE format('ALTER TABLE solicitudes_partido_old RENAME CONSTRAINT %I TO %I',
      r.conname, r.conname || '_old');
  END LOOP;

  FOR r IN
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'solicitudes_partido_old'
      AND indexname NOT LIKE '%\_old'
  LOOP
    EXECUTE format('ALTER INDEX %I RENAME TO %I', r.indexname, r.indexname || '_old');
  END LOOP;

  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'solicitudes_partido_old'
  LOOP
    EXECUTE format('DROP POLICY %I ON solicitudes_partido_old', r.policyname);
  END LOOP;
END $$;

-- ----------------------------------------------------------
-- 1. Solicitudes de partido.
--    Un jugador (solicitante) invita a otro (receptor) a jugar,
--    con una cancha y un horario propuestos.
--    Flujo de estados:
--      pendiente → aceptada | rechazada  (lo decide el receptor)
--      pendiente → cancelada             (lo decide el solicitante)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS solicitudes_partido (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solicitante_id  uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  receptor_id     uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  cancha_id       integer REFERENCES canchas(id) ON DELETE SET NULL,
  fecha           date NOT NULL,
  hora_desde      time NOT NULL,
  hora_hasta      time NOT NULL,
  mensaje         text,
  estado          text NOT NULL DEFAULT 'pendiente',
  created_at      timestamptz NOT NULL DEFAULT now(),
  respondida_at   timestamptz,

  CONSTRAINT solicitudes_jugadores_distintos
    CHECK (solicitante_id <> receptor_id),
  CONSTRAINT solicitudes_horario_valido CHECK (hora_hasta > hora_desde),
  CONSTRAINT solicitudes_mensaje_largo
    CHECK (mensaje IS NULL OR char_length(mensaje) <= 300),
  CONSTRAINT solicitudes_estado_valido
    CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'cancelada'))
);

CREATE INDEX IF NOT EXISTS solicitudes_solicitante_idx
  ON solicitudes_partido (solicitante_id);
CREATE INDEX IF NOT EXISTS solicitudes_receptor_idx
  ON solicitudes_partido (receptor_id);

-- Evita invitaciones duplicadas: solo una solicitud pendiente
-- por pareja de jugadores y sentido.
CREATE UNIQUE INDEX IF NOT EXISTS solicitudes_una_pendiente_idx
  ON solicitudes_partido (solicitante_id, receptor_id)
  WHERE estado = 'pendiente';

-- ----------------------------------------------------------
-- 2. Migración de las solicitudes antiguas (si existen).
--    Se omiten las que no tenían fecha u horario, que ahora son
--    obligatorios. Solo se ejecuta si la tabla nueva está vacía.
-- ----------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.solicitudes_partido_old') IS NULL
     OR EXISTS (SELECT 1 FROM solicitudes_partido) THEN
    RETURN;
  END IF;

  EXECUTE $sql$
    INSERT INTO solicitudes_partido
      (solicitante_id, receptor_id, cancha_id, fecha, hora_desde, hora_hasta,
       mensaje, estado, created_at)
    SELECT solicitante_id, receptor_id, cancha_id, fecha_sugerida, hora_desde,
      hora_hasta, left(mensaje, 300), estado, created_at
    FROM solicitudes_partido_old
    WHERE fecha_sugerida IS NOT NULL
      AND hora_desde IS NOT NULL
      AND hora_hasta > hora_desde
      AND solicitante_id <> receptor_id
      AND estado IN ('pendiente', 'aceptada', 'rechazada', 'cancelada')
    ORDER BY created_at
    ON CONFLICT DO NOTHING
  $sql$;
END $$;

-- ----------------------------------------------------------
-- 3. Seguridad (RLS).
--    Igual que el resto de tablas: todo pasa por el backend
--    (service_role), así que RLS activado y NINGUNA política.
-- ----------------------------------------------------------
ALTER TABLE solicitudes_partido ENABLE ROW LEVEL SECURITY;

-- Verificación: debe devolver 0 filas.
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'solicitudes_partido';
