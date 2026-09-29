import { Router } from 'express';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/auth.js';
import {
  ASCENSOS,
  CATEGORIAS,
  NOMBRES_CATEGORIAS,
  PUNTOS_RESULTADO,
  resumenJugador,
} from '../lib/ranking.js';

dotenv.config();

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const CATEGORIA_DEFECTO = 'Sin categoría';

// Partidos confirmados de todos los jugadores, agrupados por jugador y
// ordenados del más reciente al más antiguo.
export async function partidosConfirmadosPorJugador(filtroIds = null) {
  let consulta = supabase
    .from('partidos')
    .select('jugador1_id, jugador2_id, ganador_id, categoria_j1, categoria_j2, fecha, created_at')
    .eq('estado', 'confirmado')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });

  if (filtroIds) {
    const ids = filtroIds.join(',');
    consulta = consulta.or(`jugador1_id.in.(${ids}),jugador2_id.in.(${ids})`);
  }

  const { data, error } = await consulta;
  if (error) throw error;

  const porJugador = new Map();
  for (const partido of data || []) {
    for (const id of [partido.jugador1_id, partido.jugador2_id]) {
      if (!porJugador.has(id)) porJugador.set(id, []);
      porJugador.get(id).push(partido);
    }
  }
  return porJugador;
}

router.use(requireAuth);

// Ranking separado por categorías: cada categoría tiene su propia tabla
// de posiciones y los puntos salen de los partidos confirmados.
// Incluye el resumen del usuario autenticado ("yo") y las reglas.
router.get('/', async (req, res) => {
  try {
    const { data: usuarios, error } = await supabase
      .from('usuario')
      .select('id, nombre, apellido, nivel, avatar_url');

    if (error) {
      return res.status(500).json({ success: false, data: null, error: error.message });
    }

    const partidosPorJugador = await partidosConfirmadosPorJugador();

    const ranking = Object.fromEntries(
      [...NOMBRES_CATEGORIAS, CATEGORIA_DEFECTO].map((nombre) => [nombre, []]),
    );
    let yo = null;

    for (const usuario of usuarios || []) {
      const resumen = resumenJugador(
        usuario.id,
        usuario.nivel,
        partidosPorJugador.get(usuario.id) || [],
      );
      const grupo = NOMBRES_CATEGORIAS.includes(usuario.nivel)
        ? usuario.nivel
        : CATEGORIA_DEFECTO;

      ranking[grupo].push({
        id: usuario.id,
        nombre: usuario.nombre || '',
        apellido: usuario.apellido || '',
        nivel: usuario.nivel || 'Sin nivel',
        avatar_url: usuario.avatar_url || null,
        puntos: resumen.puntos,
        jugados: resumen.jugados,
      });

      if (usuario.id === req.user.id) {
        yo = { ...resumen, nivel: usuario.nivel || null };
      }
    }

    // Orden dentro de cada categoría: puntos, luego partidos jugados y nombre.
    for (const grupo of Object.keys(ranking)) {
      ranking[grupo] = ranking[grupo]
        .sort(
          (a, b) =>
            b.puntos - a.puntos ||
            b.jugados - a.jugados ||
            `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`, 'es'),
        )
        .map((jugador, index) => ({ ...jugador, posicion: index + 1 }));
    }

    if (yo) {
      const grupoYo = NOMBRES_CATEGORIAS.includes(yo.nivel) ? yo.nivel : CATEGORIA_DEFECTO;
      yo.posicion = ranking[grupoYo].find((j) => j.id === req.user.id)?.posicion ?? null;
      yo.totalCategoria = ranking[grupoYo].length;
    }

    return res.status(200).json({
      success: true,
      data: {
        ranking,
        total: (usuarios || []).length,
        yo,
        reglas: {
          categorias: CATEGORIAS,
          ascensos: ASCENSOS,
          puntosResultado: PUNTOS_RESULTADO,
        },
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
