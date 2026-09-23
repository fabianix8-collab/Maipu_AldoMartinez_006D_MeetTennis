import { Router } from 'express';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

// Puntaje base asociado a la categoría declarada por el jugador.
// Actúa como rating inicial mientras no exista historial de partidos.
const PUNTOS_POR_NIVEL = {
  '1ra Categoría': 1600,
  '2da Categoría': 1400,
  '3ra Categoría': 1200,
  '4ta Categoría': 1000,
  '5ta Categoría': 800,
};

const PUNTOS_DEFECTO = 1000;

function calcularPuntosBase(nivel) {
  return PUNTOS_POR_NIVEL[nivel] ?? PUNTOS_DEFECTO;
}

// Lista el ranking de jugadores registrados en MeetTennis.
// Se ordena por puntaje (según categoría) y se asigna la posición.
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuario')
      .select('id, nombre, apellido, nivel, avatar_url');

    if (error) {
      return res.status(500).json({
        success: false,
        data: null,
        error: error.message,
      });
    }

    const jugadores = (data || []).map((item) => ({
      id: item.id,
      nombre: item.nombre || '',
      apellido: item.apellido || '',
      nivel: item.nivel || 'Sin nivel',
      avatar_url: item.avatar_url || null,
      puntos: calcularPuntosBase(item.nivel),
    }));

    jugadores.sort((a, b) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      return `${a.nombre} ${a.apellido}`.localeCompare(
        `${b.nombre} ${b.apellido}`,
        'es',
      );
    });

    const ranking = jugadores.map((jugador, index) => ({
      ...jugador,
      posicion: index + 1,
    }));

    return res.status(200).json({
      success: true,
      data: {
        ranking,
        total: ranking.length,
        puntosPorNivel: PUNTOS_POR_NIVEL,
      },
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Error interno del servidor.',
    });
  }
});

export default router;
