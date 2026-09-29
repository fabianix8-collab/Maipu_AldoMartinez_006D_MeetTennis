-- ==========================================================
-- MeetTennis - Paso 4: avisos (campana de notificaciones)
-- ==========================================================
-- Ejecutar en Supabase Dashboard → SQL Editor (una sola vez).
-- Es seguro volver a ejecutarlo: usa IF NOT EXISTS.
--
-- Los avisos se calculan a partir de solicitudes y partidos; aquí
-- solo se agrega lo necesario para saber cuáles son nuevos.
-- ==========================================================

-- Hasta cuándo el jugador ya vio sus avisos informativos.
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS avisos_vistos_at timestamptz;

-- Cuándo el rival confirmó o rechazó el partido (antes solo se
-- guardaba la fecha de confirmación).
ALTER TABLE partidos ADD COLUMN IF NOT EXISTS respondido_at timestamptz;
UPDATE partidos SET respondido_at = confirmado_at
WHERE respondido_at IS NULL AND confirmado_at IS NOT NULL;
