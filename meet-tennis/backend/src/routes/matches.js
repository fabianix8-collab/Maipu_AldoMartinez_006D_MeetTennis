import { Router } from 'express';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/auth.js';
import { CATEGORIAS } from './ranking.js';
import { hoyChile } from '../lib/utils.js';

dotenv.config();

const router = Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const NOMBRES_CATEGORIAS = new Set(CATEGORIAS.map((c) => c.nombre));
// Los jugadores sin categoría compiten en la más baja.
const CATEGORIA_BASE = '5ta Categoría';

// Acepta marcadores como "6-4", "6-4 6-3" o "6-4, 3-6, 7-5".
const MARCADOR_REGEX =
  /^\d{1,2}\s*-\s*\d{1,2}(\s*[,/]?\s*\d{1,2}\s*-\s*\d{1,2})*$/;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const JUGADOR = 'id, nombre, apellido, nivel, avatar_url';
const COLUMNAS = `id, jugador1_id, jugador2_id, ganador_id, categoria_j1, categoria_j2,
  marcador, fecha, estado, created_at, confirmado_at, cancha_id,
  jugador1:usuario!partidos_jugador1_id_fkey(${JUGADOR}),
  jugador2:usuario!partidos_jugador2_id_fkey(${JUGADOR}),
  cancha:canchas(id, nombre)`;

function categoriaEfectiva(nivel) {
  return NOMBRES_CATEGORIAS.has(nivel) ? nivel : CATEGORIA_BASE;
}

// Presenta el partido desde el punto de vista del usuario autenticado.
function vistaPara(partido, userId) {
  const soyJ1 = partido.jugador1_id === userId;
  return {
    id: partido.id,
    rival: soyJ1 ? partido.jugador2 : partido.jugador1,
    miCategoria: soyJ1 ? partido.categoria_j1 : partido.categoria_j2,
    rivalCategoria: soyJ1 ? partido.categoria_j2 : partido.categoria_j1,
    resultado: partido.ganador_id === userId ? 'Ganado' : 'Perdido',
    marcador: partido.marcador,
    fecha: partido.fecha,
    cancha: partido.cancha,
    estado: partido.estado,
    registradoPorMi: soyJ1,
    // El rival (jugador2) es quien debe confirmar.
    puedoConfirmar: !soyJ1 && partido.estado === 'pendiente',
    created_at: partido.created_at,
    confirmado_at: partido.confirmado_at,
  };
}

function idValido(id) {
  return /^\d+$/.test(id);
}

router.use(requireAuth);

// Lista los partidos del usuario autenticado (como jugador1 o jugador2),
// del más reciente al más antiguo.
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabaseAdmin
      .from('partidos')
      .select(COLUMNAS)
      .or(`jugador1_id.eq.${userId},jugador2_id.eq.${userId}`)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        data: null,
        error: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      data: (data || []).map((p) => vistaPara(p, userId)),
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

// Registra el resultado de un partido contra otro jugador registrado.
// Queda "pendiente" hasta que el rival lo confirme.
// Body: { rival_id, resultado: "Ganado" | "Perdido", marcador?, fecha, cancha_id? }
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { rival_id, resultado, marcador, fecha, cancha_id } = req.body || {};

    if (!rival_id || rival_id === userId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Selecciona un rival válido.',
      });
    }

    if (!['Ganado', 'Perdido'].includes(resultado)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'El resultado debe ser Ganado o Perdido.',
      });
    }

    if (!FECHA_REGEX.test(fecha || '') || fecha > hoyChile()) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'La fecha es obligatoria y no puede ser futura.',
      });
    }

    const marcadorLimpio = typeof marcador === 'string' ? marcador.trim() : '';
    if (marcadorLimpio && !MARCADOR_REGEX.test(marcadorLimpio)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Usa un formato de marcador como 6-4 6-3.',
      });
    }

    const canchaId = cancha_id == null || cancha_id === '' ? null : Number(cancha_id);
    if (canchaId !== null && !Number.isInteger(canchaId)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Cancha no válida.',
      });
    }

    const { data: jugadores, error: jugadoresError } = await supabaseAdmin
      .from('usuario')
      .select('id, nivel')
      .in('id', [userId, rival_id]);

    if (jugadoresError) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Rival no válido.',
      });
    }

    const yo = jugadores?.find((j) => j.id === userId);
    const rival = jugadores?.find((j) => j.id === rival_id);

    if (!yo || !rival) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'El rival no existe.',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('partidos')
      .insert([
        {
          jugador1_id: userId,
          jugador2_id: rival_id,
          ganador_id: resultado === 'Ganado' ? userId : rival_id,
          categoria_j1: categoriaEfectiva(yo.nivel),
          categoria_j2: categoriaEfectiva(rival.nivel),
          marcador: marcadorLimpio || null,
          fecha,
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
      data: vistaPara(data, userId),
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

// El rival confirma o rechaza un partido pendiente.
// Body: { accion: "confirmar" | "rechazar" }
router.patch('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { accion } = req.body || {};

    if (!idValido(req.params.id)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Identificador no válido.',
      });
    }

    if (!['confirmar', 'rechazar'].includes(accion)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'La acción debe ser confirmar o rechazar.',
      });
    }

    const cambios =
      accion === 'confirmar'
        ? { estado: 'confirmado', confirmado_at: new Date().toISOString() }
        : { estado: 'rechazado' };

    // Solo el rival (jugador2) puede resolver, y solo si sigue pendiente.
    const { data, error } = await supabaseAdmin
      .from('partidos')
      .update(cambios)
      .eq('id', req.params.id)
      .eq('jugador2_id', userId)
      .eq('estado', 'pendiente')
      .select(COLUMNAS);

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
        error: 'No hay un partido pendiente tuyo con ese identificador.',
      });
    }

    return res.status(200).json({
      success: true,
      data: vistaPara(data[0], userId),
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

// Quien registró el partido puede borrarlo mientras siga pendiente.
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
      .from('partidos')
      .delete()
      .eq('id', req.params.id)
      .eq('jugador1_id', req.user.id)
      .eq('estado', 'pendiente')
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
        error: 'Solo puedes borrar partidos pendientes que registraste tú.',
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
