import { Router } from 'express';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Categorías ordenadas de MAYOR a MENOR nivel competitivo.
// En el tenis cada categoría es un circuito separado: los jugadores
// compiten dentro de su categoría y solo ascienden al demostrar un
// nivel sostenido (puntos acumulados + victorias válidas).
export const CATEGORIAS = [
  { nombre: '1ra Categoría', orden: 1 },
  { nombre: '2da Categoría', orden: 2 },
  { nombre: '3ra Categoría', orden: 3 },
  { nombre: '4ta Categoría', orden: 4 },
  { nombre: '5ta Categoría', orden: 5 },
];

// Requisitos para ascender desde cada categoría hacia la superior.
// - puntos: puntos netos acumulados DENTRO de la categoría actual.
// - victorias: cantidad mínima de victorias contra rivales de tu misma
//   categoría o superiores (victorias "válidas"). Así no se asciende
//   solo ganándole a categorías inferiores.
// Subir cuesta: los umbrales son altos y cada derrota resta puntos.
export const ASCENSOS = {
  '5ta Categoría': { puntos: 200, victorias: 10 },
  '4ta Categoría': { puntos: 350, victorias: 14 },
  '3ra Categoría': { puntos: 500, victorias: 18 },
  '2da Categoría': { puntos: 700, victorias: 22 },
  '1ra Categoría': null, // Máxima categoría, no hay ascenso.
};

const NOMBRES_CATEGORIAS = new Set(CATEGORIAS.map((c) => c.nombre));
const CATEGORIA_DEFECTO = 'Sin categoría';

// Lista el ranking separado por categorías: cada categoría tiene su
// propia tabla de posiciones y no se mezclan jugadores de niveles
// distintos. El puntaje de cada jugador parte desde 0 en su categoría.
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

    const ranking = {};
    for (const categoria of CATEGORIAS) {
      ranking[categoria.nombre] = [];
    }
    ranking[CATEGORIA_DEFECTO] = [];

    for (const item of data || []) {
      const nivel =
        NOMBRES_CATEGORIAS.has(item.nivel) || !item.nivel
          ? item.nivel || CATEGORIA_DEFECTO
          : CATEGORIA_DEFECTO;

      ranking[nivel].push({
        id: item.id,
        nombre: item.nombre || '',
        apellido: item.apellido || '',
        nivel: item.nivel || 'Sin nivel',
        avatar_url: item.avatar_url || null,
        puntos: 0,
      });
    }

    // Ordena y asigna posición dentro de cada categoría.
    for (const categoria of Object.keys(ranking)) {
      ranking[categoria].sort((a, b) => {
        if (b.puntos !== a.puntos) return b.puntos - a.puntos;
        return `${a.nombre} ${a.apellido}`.localeCompare(
          `${b.nombre} ${b.apellido}`,
          'es',
        );
      });
      ranking[categoria] = ranking[categoria].map((jugador, index) => ({
        ...jugador,
        posicion: index + 1,
      }));
    }

    const total = Object.values(ranking).reduce(
      (acc, lista) => acc + lista.length,
      0,
    );

    return res.status(200).json({
      success: true,
      data: {
        ranking,
        total,
        categorias: CATEGORIAS,
        ascensos: ASCENSOS,
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
