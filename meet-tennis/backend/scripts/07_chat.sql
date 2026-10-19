-- ==========================================================
-- MeetTennis - Paso 7: Chat entre jugadores
-- ==========================================================
-- Ejecutar en Supabase Dashboard → SQL Editor (una sola vez).
-- Es seguro volver a ejecutarlo: no borra datos y cada paso
-- comprueba si ya se hizo.
--
-- Modelo: mensajería directa 1 a 1 (estilo Messenger) para que
-- dos jugadores coordinen cancha, horario y detalles del partido.
-- ==========================================================

-- ----------------------------------------------------------
-- 1. Conversaciones (hilo entre dos jugadores).
--    Para que la pareja (A,B) sea única sin importar quién la
--    inicia, se guarda siempre con usuario1_id < usuario2_id.
--    leido_por_1 / leido_por_2 guardan hasta qué momento cada
--    jugador leyó el hilo (para contar mensajes no leídos).
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversaciones (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario1_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  usuario2_id uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  leido_por_1 timestamptz,
  leido_por_2 timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT conversaciones_jugadores_distintos
    CHECK (usuario1_id <> usuario2_id),
  CONSTRAINT conversaciones_orden
    CHECK (usuario1_id < usuario2_id)
);

-- Una sola conversación por pareja de jugadores.
CREATE UNIQUE INDEX IF NOT EXISTS conversaciones_par_idx
  ON conversaciones (usuario1_id, usuario2_id);

CREATE INDEX IF NOT EXISTS conversaciones_usuario1_idx
  ON conversaciones (usuario1_id);
CREATE INDEX IF NOT EXISTS conversaciones_usuario2_idx
  ON conversaciones (usuario2_id);

-- ----------------------------------------------------------
-- 2. Mensajes de cada conversación.
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS mensajes (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversacion_id bigint NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  remitente_id    uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  contenido       text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT mensajes_contenido_largo
    CHECK (char_length(contenido) <= 1000)
);

CREATE INDEX IF NOT EXISTS mensajes_conversacion_idx
  ON mensajes (conversacion_id, created_at);

-- ----------------------------------------------------------
-- 3. Seguridad (RLS).
--    Todo el acceso pasa por el backend, que usa la service_role
--    (ignora RLS) y valida sesión y pertenencia por su cuenta.
--    Por eso las tablas tienen RLS activado y NINGUNA política.
-- ----------------------------------------------------------
ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;

-- Verificación: debe devolver 0 filas.
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('conversaciones', 'mensajes');
