-- ==========================================================
-- MeetTennis - Paso 6: reseñas y calificaciones de jugadores
-- ==========================================================
-- Ejecutar en Supabase Dashboard → SQL Editor (una sola vez).
-- Es seguro volver a ejecutarlo: usa IF NOT EXISTS.
--
-- Cada jugador puede dejar UNA reseña por rival (calificación de
-- 1 a 5 estrellas y comentario opcional). Sirve para conocer la
-- confiabilidad de otros jugadores: asistencia, puntualidad,
-- actitud, nivel de juego, etc.
-- ==========================================================

CREATE TABLE IF NOT EXISTS resenas (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  autor_id     uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  jugador_id   uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  calificacion integer NOT NULL CHECK (calificacion BETWEEN 1 AND 5),
  comentario   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT resenas_autor_distinto CHECK (autor_id <> jugador_id),
  CONSTRAINT resenas_unica_por_par UNIQUE (autor_id, jugador_id)
);

CREATE INDEX IF NOT EXISTS resenas_jugador_idx ON resenas (jugador_id);
CREATE INDEX IF NOT EXISTS resenas_autor_idx ON resenas (autor_id);

-- Seguridad: todo el acceso pasa por el backend (service_role), igual
-- que el resto de las tablas. RLS activado y sin políticas para
-- anon/authenticated.
ALTER TABLE resenas ENABLE ROW LEVEL SECURITY;

-- Verificación: debe devolver la tabla.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'resenas';