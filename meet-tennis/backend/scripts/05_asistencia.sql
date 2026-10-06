-- ==========================================================
-- MeetTennis - Paso 5: confirmación de asistencia
-- ==========================================================
-- Ejecutar en Supabase Dashboard → SQL Editor (una sola vez).
-- Es seguro volver a ejecutarlo: usa IF NOT EXISTS.
--
-- El día antes de un partido aceptado, cada jugador confirma si
-- asiste. NULL = sin responder, true = confirma, false = no puede
-- (en ese caso la solicitud pasa a "cancelada").
-- ==========================================================

ALTER TABLE solicitudes_partido
  ADD COLUMN IF NOT EXISTS asiste_solicitante boolean,
  ADD COLUMN IF NOT EXISTS asiste_receptor boolean,
  ADD COLUMN IF NOT EXISTS asistencia_solicitante_at timestamptz,
  ADD COLUMN IF NOT EXISTS asistencia_receptor_at timestamptz;

-- Verificación: debe devolver las 4 columnas.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'solicitudes_partido'
  AND column_name LIKE 'asist%';
