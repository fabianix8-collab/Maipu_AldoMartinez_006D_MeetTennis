import { Router } from 'express';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/auth.js';

dotenv.config();

const router = Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const MODALIDADES = ['Disponible para jugar', 'Buscando partido'];
const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const COLUMNAS =
  'id, dias, desde, hasta, modalidad, comuna, cancha_id, cancha:canchas(id, nombre, direccion)';

// Postgres devuelve "HH:MM:SS"; el frontend trabaja con "HH:MM".
function formatear(bloque) {
  return {
    ...bloque,
    desde: bloque.desde?.slice(0, 5),
    hasta: bloque.hasta?.slice(0, 5),
  };
}

router.use(requireAuth);

// Lista la disponibilidad del usuario autenticado.
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('disponibilidad')
      .select(COLUMNAS)
      .eq('usuario_id', req.user.id)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        data: null,
        error: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      data: (data || []).map(formatear),
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

// Agrega un bloque de disponibilidad.
// Body: { dias: [1..7], desde: "HH:MM", hasta: "HH:MM", modalidad,
//         comuna?: string, cancha_id?: number }
router.post('/', async (req, res) => {
  try {
    const { dias, desde, hasta, modalidad, comuna, cancha_id } = req.body || {};

    const diasValidos =
      Array.isArray(dias) &&
      dias.length > 0 &&
      dias.every((d) => Number.isInteger(d) && d >= 1 && d <= 7);

    if (!diasValidos) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Selecciona al menos un día válido.',
      });
    }

    if (!HORA_REGEX.test(desde || '') || !HORA_REGEX.test(hasta || '')) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Las horas deben tener formato HH:MM.',
      });
    }

    if (hasta <= desde) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'La hora de término debe ser mayor a la de inicio.',
      });
    }

    if (modalidad && !MODALIDADES.includes(modalidad)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Modalidad no válida.',
      });
    }

    const comunaLimpia = typeof comuna === 'string' ? comuna.trim() : '';
    const canchaId = cancha_id == null || cancha_id === '' ? null : Number(cancha_id);

    if (canchaId !== null && !Number.isInteger(canchaId)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Cancha no válida.',
      });
    }

    if (comunaLimpia && canchaId !== null) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Elige una comuna o una cancha, no ambas.',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('disponibilidad')
      .insert([
        {
          usuario_id: req.user.id,
          dias: [...new Set(dias)].sort(),
          desde,
          hasta,
          modalidad: modalidad || MODALIDADES[0],
          comuna: comunaLimpia || null,
          cancha_id: canchaId,
        },
      ])
      .select(COLUMNAS)
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        data: null,
        error: error.message,
      });
    }

    return res.status(201).json({
      success: true,
      data: formatear(data),
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

// Elimina un bloque propio.
router.delete('/:id', async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Identificador no válido.',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('disponibilidad')
      .delete()
      .eq('id', req.params.id)
      .eq('usuario_id', req.user.id)
      .select('id');

    if (error) {
      return res.status(500).json({
        success: false,
        data: null,
        error: error.message,
      });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Bloque de disponibilidad no encontrado.',
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
