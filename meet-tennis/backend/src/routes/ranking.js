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

// Tabla de puntos: ganar a rival superior, igual o inferior.
const PUNTOS_RESULTADO_SEED = {
  Ganado: { superior: 40, igual: 25, inferior: 10 },
  Perdido: { superior: -5, igual: -15, inferior: -25 },
};

const NOMBRES_CATEGORIAS_LIST = CATEGORIAS.map((c) => c.nombre);
const ORDEN_POR_CATEGORIA = Object.fromEntries(
  CATEGORIAS.map((c) => [c.nombre, c.orden]),
);

function relacionCategorias(miNivel, rivalNivel) {
  const mi = ORDEN_POR_CATEGORIA[miNivel];
  const rival = ORDEN_POR_CATEGORIA[rivalNivel];
  if (mi == null || rival == null) return 'igual';
  if (rival === mi) return 'igual';
  return rival < mi ? 'superior' : 'inferior';
}

function calcularPuntosUsuario(miNivel, partidos) {
  let total = 0;
  for (const partido of partidos) {
    if (partido.categoria !== miNivel) continue;
    const relacion = relacionCategorias(miNivel, partido.rivalNivel);
    total += PUNTOS_RESULTADO_SEED[partido.resultado]?.[relacion] ?? 0;
  }
  return Math.max(0, total);
}

// Genera partidos de ejemplo para todos los usuarios registrados
// y devuelve también los puntos calculados por usuario/categoría.
router.get('/seed', async (req, res) => {
  try {
    const { data: usuarios, error } = await supabase
      .from('usuario')
      .select('id, nombre, apellido, nivel');

    if (error) {
      return res.status(500).json({
        success: false,
        data: null,
        error: error.message,
      });
    }

    const usuariosConNivel = (usuarios || []).filter(
      (u) => u.nivel && NOMBRES_CATEGORIAS.has(u.nivel),
    );

    if (usuariosConNivel.length < 2) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Se necesitan al menos 2 usuarios con categoría para generar partidos.',
      });
    }

    const seedPartidos = {};
    const seedPuntos = {};
    const hoy = new Date();
    const resultados = ['Ganado', 'Perdido'];

    // Fase 1: generar partidos
    for (const usuario of usuariosConNivel) {
      const partidos = [];
      const categoria = usuario.nivel;
      const rivales = usuariosConNivel.filter((u) => u.id !== usuario.id);

      if (rivales.length === 0) continue;

      const cantidad = 5 + Math.floor(Math.random() * 8);

      for (let i = 0; i < cantidad; i++) {
        const rival = rivales[Math.floor(Math.random() * rivales.length)];
        const resultado = resultados[Math.floor(Math.random() * resultados.length)];
        const fecha = new Date(hoy);
        fecha.setDate(fecha.getDate() - Math.floor(Math.random() * 90));

        partidos.push({
          id: `seed_${usuario.id.slice(0, 8)}_${i}_${Date.now()}`,
          rival: `${rival.nombre} ${rival.apellido}`.trim(),
          rivalNivel: rival.nivel,
          resultado,
          marcador: resultado === 'Ganado'
            ? `${6 + Math.floor(Math.random() * 2)}-${Math.floor(Math.random() * 4)} ${6}-${Math.floor(Math.random() * 3)}`
            : `${Math.floor(Math.random() * 4)}-${6 + Math.floor(Math.random() * 2)} ${Math.floor(Math.random() * 3)}-${6}`,
          fecha: fecha.toISOString().slice(0, 10),
          categoria,
        });
      }

      seedPartidos[usuario.id] = partidos;
    }

    // Fase 2: calcular puntos para cada usuario en su categoría
    for (const usuario of usuariosConNivel) {
      const partidos = seedPartidos[usuario.id] || [];
      seedPuntos[usuario.id] = calcularPuntosUsuario(usuario.nivel, partidos);
    }

    return res.status(200).json({
      success: true,
      data: {
        partidos: seedPartidos,
        puntos: seedPuntos,
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
