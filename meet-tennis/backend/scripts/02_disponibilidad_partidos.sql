-- ==========================================================
-- MeetTennis - Paso 2: disponibilidad y partidos en Supabase
-- ==========================================================
-- Ejecutar en Supabase Dashboard → SQL Editor (una sola vez).
-- Es seguro volver a ejecutarlo: usa IF NOT EXISTS / DROP IF EXISTS.
-- ==========================================================

-- ----------------------------------------------------------
-- 1. Datos extra del jugador (bio y ubicación base).
--    La ubicación se usará para buscar partidos cerca.
-- ----------------------------------------------------------
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS comuna text;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS latitud double precision;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS longitud double precision;

-- ----------------------------------------------------------
-- 2. Disponibilidad: bloques horarios en que el jugador puede jugar.
--    dias: 1 = Lunes ... 7 = Domingo.
--    Zona opcional: una comuna o una cancha específica (no ambas).
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS disponibilidad (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id  uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  dias        smallint[] NOT NULL,
  desde       time NOT NULL,
  hasta       time NOT NULL,
  modalidad   text NOT NULL DEFAULT 'Disponible para jugar',
  comuna      text,
  cancha_id   integer REFERENCES canchas(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT disponibilidad_dias_validos
    CHECK (cardinality(dias) > 0 AND dias <@ ARRAY[1,2,3,4,5,6,7]::smallint[]),
  CONSTRAINT disponibilidad_horario_valido CHECK (hasta > desde),
  CONSTRAINT disponibilidad_modalidad_valida
    CHECK (modalidad IN ('Disponible para jugar', 'Buscando partido')),
  CONSTRAINT disponibilidad_una_zona
    CHECK (comuna IS NULL OR cancha_id IS NULL)
);

CREATE INDEX IF NOT EXISTS disponibilidad_usuario_idx
  ON disponibilidad (usuario_id);

-- ----------------------------------------------------------
-- 3. Partidos entre dos jugadores registrados.
--    jugador1 = quien registra el resultado; jugador2 = el rival.
--    El partido solo suma puntos cuando el rival lo CONFIRMA.
--    categoria_j1/j2 guardan la categoría que tenía cada uno al
--    jugar, porque los puntos dependen de eso y la categoría cambia.
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS partidos (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  jugador1_id   uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  jugador2_id   uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  ganador_id    uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  categoria_j1  text NOT NULL,
  categoria_j2  text NOT NULL,
  marcador      text,
  fecha         date NOT NULL,
  cancha_id     integer REFERENCES canchas(id) ON DELETE SET NULL,
  estado        text NOT NULL DEFAULT 'pendiente',
  created_at    timestamptz NOT NULL DEFAULT now(),
  confirmado_at timestamptz,

  CONSTRAINT partidos_jugadores_distintos CHECK (jugador1_id <> jugador2_id),
  CONSTRAINT partidos_ganador_valido
    CHECK (ganador_id IN (jugador1_id, jugador2_id)),
  CONSTRAINT partidos_estado_valido
    CHECK (estado IN ('pendiente', 'confirmado', 'rechazado'))
);

CREATE INDEX IF NOT EXISTS partidos_jugador1_idx ON partidos (jugador1_id);
CREATE INDEX IF NOT EXISTS partidos_jugador2_idx ON partidos (jugador2_id);
CREATE INDEX IF NOT EXISTS partidos_estado_idx ON partidos (estado);

-- ----------------------------------------------------------
-- 4. Seguridad (RLS).
--    Todo el acceso pasa por el backend, que usa la service_role
--    (ignora RLS) y valida sesión, dueño y reglas por su cuenta.
--    Por eso las tablas tienen RLS activado y NINGUNA política:
--    con la anon key no se puede leer ni escribir nada directo.
-- ----------------------------------------------------------
ALTER TABLE usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE disponibilidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE partidos ENABLE ROW LEVEL SECURITY;

-- Políticas antiguas de 'usuario' (rls_policies.sql original):
-- permitían leer todos los perfiles, insertar perfiles falsos y
-- cambiarse la categoría sin pasar por las reglas del backend.
DROP POLICY IF EXISTS "Usuarios pueden ver perfiles" ON usuario;
DROP POLICY IF EXISTS "Usuarios pueden insertar su propio perfil" ON usuario;
DROP POLICY IF EXISTS "Usuarios pueden actualizar su propio perfil" ON usuario;
DROP POLICY IF EXISTS "Público puede ver perfiles" ON usuario;
DROP POLICY IF EXISTS "Público puede registrarse" ON usuario;

-- Verificación: debe devolver 0 filas.
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('usuario', 'disponibilidad', 'partidos');
