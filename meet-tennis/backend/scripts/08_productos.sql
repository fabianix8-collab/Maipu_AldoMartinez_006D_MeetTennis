-- ==========================================================
-- MeetTennis - Paso 8: Recomendaciones de productos (publicidad)
-- ==========================================================
-- Ejecutar en Supabase Dashboard → SQL Editor (una sola vez).
-- Es seguro volver a ejecutarlo: no borra datos y cada paso
-- comprueba si ya se hizo.
--
-- Modelo: sección de recomendaciones de equipo de tenis de
-- tiendas asociadas (modelo de publicidad / afiliación). Cada
-- producto tiene un enlace de compra y una tienda.
-- ==========================================================

-- ----------------------------------------------------------
-- 1. Productos recomendados.
--    precio en CLP (entero). destacado = aparece primero.
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre      text NOT NULL,
  descripcion text,
  categoria   text NOT NULL,
  precio      integer,
  imagen_url  text,
  enlace      text NOT NULL,
  tienda      text NOT NULL,
  destacado   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT productos_categoria_valida
    CHECK (categoria IN ('Raquetas', 'Zapatillas', 'Cuerdas', 'Accesorios', 'Ropa'))
);

CREATE INDEX IF NOT EXISTS productos_categoria_idx ON productos (categoria);
CREATE INDEX IF NOT EXISTS productos_destacado_idx ON productos (destacado);

-- ----------------------------------------------------------
-- 2. Datos de ejemplo (solo si la tabla está vacía).
--    Reemplaza los enlaces por los de tus tiendas afiliadas.
-- ----------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM productos) THEN
    RETURN;
  END IF;

  INSERT INTO productos (nombre, descripcion, categoria, precio, imagen_url, enlace, tienda, destacado) VALUES
    ('Raqueta Wilson Clash 100 V3.0', 'Raqueta con máxima flexibilidad y comodidad. Perfecta para control y efecto.', 'Raquetas', 269990, 'https://media.falabella.com/falabellaCL/140215826_01/public', 'https://www.falabella.com/falabella-cl/product/140215825/raqueta-wilson-clash-100-v3-0-295gr', 'Falabella', true),
    ('Raqueta Babolat Pure Drive 100 Gen11', 'La raqueta más popular del mundo: potencia y versatilidad para todo nivel.', 'Raquetas', 299990, 'https://media.falabella.com/falabellaCL/151496149_01/public', 'https://www.falabella.com/falabella-cl/product/151496148/raqueta-tenis-babolat-pure-drive-100-gen11', 'Falabella', false),
    ('Raqueta Head Geo Speed Bicolor', 'Raqueta de Head con buen balance, ideal para jugadores de nivel intermedio.', 'Raquetas', 69990, 'https://media.falabella.com/falabellaCL/142163236_01/public', 'https://www.falabella.com/falabella-cl/product/142163235/Raqueta-Tenis-Head-Geo-Speed-Bicolor-Negra', 'Falabella', false),
    ('Zapatillas Asics Gel-Dedicate 9 Clay', 'Zapatillas de tenis con estabilidad y agarre para cancha de arcilla.', 'Zapatillas', 79990, 'https://media.falabella.com/falabellaCL/80791030_1/public', 'https://www.falabella.com/falabella-cl/product/80790557/gel-dedicate-9-clay-zapatilla-tenis-hombre-blanco-asics', 'Falabella', true),
    ('Zapatillas Nike Court Lite 4 HC', 'Zapatillas ligeras y cómodas para jugar en cancha dura.', 'Zapatillas', 82990, 'https://media.falabella.com/falabellaCL/80789183_1/public', 'https://www.falabella.com/falabella-cl/product/80789102/court-lite-4-hc-zapatilla-tenis-mujer-blanco-nike', 'Falabella', false),
    ('Cuerda Luxilon Alu Power 1.25', 'Cuerda de poliéster de alto rendimiento: gran control y durabilidad.', 'Cuerdas', 27990, 'https://media.falabella.com/falabellaCL/139996697_01/public', 'https://www.falabella.com/falabella-cl/product/139996696/Cuerda-Luxilon-Alu-Power-1.25-12m', 'Falabella', false),
    ('Pelota de Tenis Head Championship', 'Pelota de tenis de gran durabilidad para entrenamiento y partidos.', 'Accesorios', 6990, 'https://media.falabella.com/falabellaCL/80643918_1/public', 'https://www.falabella.com/falabella-cl/product/80643918/pelota-de-tenis-championship-head', 'Falabella', true),
    ('Pack 3 Pelotas Babolat Gold Championship', 'Pack de 3 pelotas de tenis de alto rendimiento.', 'Accesorios', 16990, 'https://media.falabella.com/falabellaCL/80647569_1/public', 'https://www.falabella.com/falabella-cl/product/80647569/pack-3-pelotas-tenis-babolat-gold-championship-babolat', 'Falabella', false),
    ('Overgrip Babolat My Overgrip Multicolor X70', 'Pack de overgrips para mejor agarre y comodidad en cada golpe.', 'Accesorios', 104990, 'https://media.falabella.com/falabellaCL/128041784_01/public', 'https://www.falabella.com/falabella-cl/product/128041783/overgrip-babolat-my-overgrip-multicolor-x70-tenis-padel', 'Falabella', false),
    ('Polera Nike Training Mujer', 'Polera deportiva transpirable para jugar con comodidad.', 'Ropa', 36990, 'https://media.falabella.com/falabellaCL/80791658_1/public', 'https://www.falabella.com/falabella-cl/product/80791491/polera-deportiva-training-mujer-nike', 'Falabella', false),
    ('Shorts Adidas Club Climacool', 'Short de tenis ligero con gran libertad de movimiento.', 'Ropa', 29990, 'https://media.falabella.com/falabellaCL/80816547_1/public', 'https://www.falabella.com/falabella-cl/product/80816543/shorts-de-tenis-club-climacool-adidas', 'Falabella', false);
END $$;

-- ----------------------------------------------------------
-- 3. Seguridad (RLS).
--    Todo el acceso pasa por el backend (service_role). RLS
--    activado y sin políticas, igual que el resto del proyecto.
-- ----------------------------------------------------------
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;

-- Verificación: debe devolver 0 filas.
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'productos';
