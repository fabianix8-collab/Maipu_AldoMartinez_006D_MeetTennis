import { Router } from 'express';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/auth.js';
import { esUuid } from '../lib/utils.js';

dotenv.config();

const router = Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const JUGADOR = 'id, nombre, apellido, nivel, avatar_url';
const COMENTARIO_MAX = 300;

// 42703: columna inexistente (falta ejecutar scripts/06_resenas.sql).
const FALTA_SCRIPT =
  'Falta ejecutar el script backend/scripts/06_resenas.sql en Supabase.';

const mensajeError = (error) => (error.code === '42703' ? FALTA_SCRIPT : error.message);

function idValido(id) {
  return /^\d+$/.test(id);
}

function nombreCompleto(jugador) {
  return `${jugador?.nombre || ''} ${jugador?.apellido || ''}`.trim() || 'Jugador';
}

router.use(requireAuth);

// Lista todos los jugadores con su promedio de calificación y la reseña
// que dejó el usuario autenticado (si existe), además de las reseñas que
// recibió el propio usuario y su promedio.
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const [usuariosRes, resenasRes, partidosRes] = await Promise.all([
      supabaseAdmin.from('usuario').select(JUGADOR),
      supabaseAdmin
        .from('resenas')
        .select(
          `id, autor_id, jugador_id, calificacion, comentario, created_at, updated_at,
           autor:usuario!resenas_autor_id_fkey(${JUGADOR}),
           jugador:usuario!resenas_jugador_id_fkey(${JUGADOR})`,
        )
        .order('created_at', { ascending: false }),
      // Solo se puede reseñar a rivales con los que ya se jugó un partido
      // confirmado por ambos jugadores.
      supabaseAdmin
        .from('partidos')
        .select('jugador1_id, jugador2_id')
        .or(`jugador1_id.eq.${userId},jugador2_id.eq.${userId}`)
        .eq('estado', 'confirmado'),
    ]);

    const error = usuariosRes.error || resenasRes.error || partidosRes.error;
    if (error) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(error),
      });
    }

    // Rivales con partido confirmado (jugué contra ellos).
    const rivalIds = new Set();
    for (const p of partidosRes.data || []) {
      rivalIds.add(p.jugador1_id === userId ? p.jugador2_id : p.jugador1_id);
    }

    const resenas = resenasRes.data || [];

    // Promedio por jugador y reseña que dejó el usuario autenticado.
    const porJugador = new Map();
    for (const r of resenas) {
      if (!porJugador.has(r.jugador_id)) {
        porJugador.set(r.jugador_id, { suma: 0, total: 0, miResena: null });
      }
      const grupo = porJugador.get(r.jugador_id);
      grupo.suma += r.calificacion;
      grupo.total += 1;
      if (r.autor_id === userId) grupo.miResena = r;
    }

    const jugadores = (usuariosRes.data || [])
      .filter((u) => u.id !== userId && rivalIds.has(u.id))
      .map((u) => {
        const grupo = porJugador.get(u.id);
        return {
          ...u,
          promedio:
            grupo && grupo.total > 0 ? +(grupo.suma / grupo.total).toFixed(1) : null,
          totalResenas: grupo?.total || 0,
          miResena: grupo?.miResena || null,
        };
      })
      .sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'));

    // Reseñas que recibió el usuario autenticado. Son anónimas: no se
    // revela quién dejó cada reseña para que se pueda calificar con
    // honestidad sin miedo a represalias.
    const recibidas = resenas
      .filter((r) => r.jugador_id === userId)
      .map((r) => ({
        id: r.id,
        calificacion: r.calificacion,
        comentario: r.comentario,
        created_at: r.created_at,
        autor: null,
      }));

    const miPromedio = recibidas.length
      ? +(recibidas.reduce((suma, r) => suma + r.calificacion, 0) / recibidas.length).toFixed(1)
      : null;

    return res.status(200).json({
      success: true,
      data: { jugadores, recibidas, miPromedio },
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

// Reseñas recibidas por un jugador (anónimas) y su promedio.
// Sirve para decidir si jugar contra ese rival desde su perfil.
router.get('/player/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!esUuid(id)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Identificador no válido.',
      });
    }

    const { data: resenas, error } = await supabaseAdmin
      .from('resenas')
      .select('id, calificacion, comentario, created_at')
      .eq('jugador_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(error),
      });
    }

    const recibidas = (resenas || []).map((r) => ({
      id: r.id,
      calificacion: r.calificacion,
      comentario: r.comentario,
      created_at: r.created_at,
      autor: null, // anónimo: no se revela quién la dejó
    }));

    const promedio = recibidas.length
      ? +(recibidas.reduce((suma, r) => suma + r.calificacion, 0) / recibidas.length).toFixed(1)
      : null;

    return res.status(200).json({
      success: true,
      data: { promedio, totalResenas: recibidas.length, recibidas },
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

// Crea una reseña para otro jugador.
// Body: { jugador_id, calificacion (1-5), comentario? }
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { jugador_id, calificacion, comentario } = req.body || {};

    if (!esUuid(jugador_id) || jugador_id === userId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Selecciona un jugador válido.',
      });
    }

    const nota = Number(calificacion);
    if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'La calificación debe ser un número entre 1 y 5.',
      });
    }

    const comentarioLimpio = typeof comentario === 'string' ? comentario.trim() : '';
    if (comentarioLimpio.length > COMENTARIO_MAX) {
      return res.status(400).json({
        success: false,
        data: null,
        error: `El comentario no puede superar los ${COMENTARIO_MAX} caracteres.`,
      });
    }

    const { data: jugador, error: jugadorError } = await supabaseAdmin
      .from('usuario')
      .select('id')
      .eq('id', jugador_id)
      .maybeSingle();

    if (jugadorError) {
      return res.status(500).json({
        success: false,
        data: null,
        error: jugadorError.message,
      });
    }
    if (!jugador) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'El jugador no existe.',
      });
    }

    // Solo se puede reseñar a rivales con los que ya se jugó un partido
    // confirmado por ambos jugadores.
    const { data: partido, error: partidoError } = await supabaseAdmin
      .from('partidos')
      .select('id')
      .or(
        `and(jugador1_id.eq.${userId},jugador2_id.eq.${jugador_id}),` +
          `and(jugador1_id.eq.${jugador_id},jugador2_id.eq.${userId})`,
      )
      .eq('estado', 'confirmado')
      .limit(1);

    if (partidoError) {
      return res.status(500).json({
        success: false,
        data: null,
        error: partidoError.message,
      });
    }
    if (!partido || partido.length === 0) {
      return res.status(403).json({
        success: false,
        data: null,
        error: 'Solo puedes reseñar a rivales con los que ya jugaste un partido confirmado.',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('resenas')
      .insert([
        {
          autor_id: userId,
          jugador_id,
          calificacion: nota,
          comentario: comentarioLimpio || null,
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          data: null,
          error: 'Ya dejaste una reseña para este jugador. Puedes editarla.',
        });
      }
      return res.status(400).json({
        success: false,
        data: null,
        error: mensajeError(error),
      });
    }

    return res.status(201).json({
      success: true,
      data,
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

// Edita una reseña propia.
// Body: { calificacion (1-5), comentario? }
router.patch('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { calificacion, comentario } = req.body || {};

    if (!idValido(req.params.id)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Identificador no válido.',
      });
    }

    const cambios = {};

    if (calificacion !== undefined) {
      const nota = Number(calificacion);
      if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
        return res.status(400).json({
          success: false,
          data: null,
          error: 'La calificación debe ser un número entre 1 y 5.',
        });
      }
      cambios.calificacion = nota;
    }

    if (comentario !== undefined) {
      const comentarioLimpio = typeof comentario === 'string' ? comentario.trim() : '';
      if (comentarioLimpio.length > COMENTARIO_MAX) {
        return res.status(400).json({
          success: false,
          data: null,
          error: `El comentario no puede superar los ${COMENTARIO_MAX} caracteres.`,
        });
      }
      cambios.comentario = comentarioLimpio || null;
    }

    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'No hay cambios para guardar.',
      });
    }

    cambios.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('resenas')
      .update(cambios)
      .eq('id', req.params.id)
      .eq('autor_id', userId)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(error),
      });
    }
    if (!data) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'No encontré una reseña tuya con ese identificador.',
      });
    }

    return res.status(200).json({
      success: true,
      data,
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

// Borra una reseña propia.
router.delete('/:id', async (req, res) => {
  try {
    if (!idValido(req.params.id)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Identificador no válido.',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('resenas')
      .delete()
      .eq('id', req.params.id)
      .eq('autor_id', req.user.id)
      .select('id');

    if (error) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(error),
      });
    }
    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Solo puedes borrar reseñas que dejaste tú.',
      });
    }

    return res.status(200).json({
      success: true,
      data: { id: data[0].id },
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