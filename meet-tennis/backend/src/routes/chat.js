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

const CONTENIDO_MAX = 1000;
const MENSAJES_POR_PAGINA = 100;

const JUGADOR = 'id, nombre, apellido, nivel, avatar_url';
const COLUMNAS_CONV = `id, usuario1_id, usuario2_id, leido_por_1, leido_por_2,
  created_at, updated_at,
  usuario1:usuario!conversaciones_usuario1_id_fkey(${JUGADOR}),
  usuario2:usuario!conversaciones_usuario2_id_fkey(${JUGADOR})`;

// 42703: columna inexistente (falta ejecutar scripts/07_chat.sql).
const FALTA_SCRIPT =
  'Falta ejecutar el script backend/scripts/07_chat.sql en Supabase.';

const mensajeError = (error) => (error.code === '42703' ? FALTA_SCRIPT : error.message);

// Devuelve el otro participante de la conversación desde el punto de
// vista del usuario autenticado.
function otroParticipante(conv, userId) {
  return conv.usuario1_id === userId ? conv.usuario2 : conv.usuario1;
}

router.use(requireAuth);

// ----------------------------------------------------------
// Lista de jugadores para iniciar un nuevo chat. Solo se muestran
// quienes ya tienen un partido ACEPTADO (confirmado para jugar)
// con el usuario autenticado, para coordinar cancha y horario.
// ----------------------------------------------------------
router.get('/players', async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: solicitudes, error: solError } = await supabaseAdmin
      .from('solicitudes_partido')
      .select('solicitante_id, receptor_id')
      .eq('estado', 'aceptada')
      .or(`solicitante_id.eq.${userId},receptor_id.eq.${userId}`);

    if (solError) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(solError),
      });
    }

    // Ids de los jugadores con los que hay un partido aceptado.
    const ids = new Set();
    for (const s of solicitudes || []) {
      if (s.solicitante_id !== userId) ids.add(s.solicitante_id);
      if (s.receptor_id !== userId) ids.add(s.receptor_id);
    }

    if (ids.size === 0) {
      return res.status(200).json({ success: true, data: [], error: null });
    }

    const { data, error } = await supabaseAdmin
      .from('usuario')
      .select('id, nombre, apellido, nivel, avatar_url')
      .in('id', [...ids])
      .order('nombre', { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(error),
      });
    }

    return res.status(200).json({ success: true, data: data || [], error: null });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Error interno del servidor.',
    });
  }
});

// ----------------------------------------------------------
// Lista de conversaciones del usuario autenticado, ordenadas por
// la más reciente, con el otro participante, el último mensaje y
// la cantidad de mensajes no leídos.
// ----------------------------------------------------------
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.user.id;

    const [convRes, mensajesRes] = await Promise.all([
      supabaseAdmin
        .from('conversaciones')
        .select(COLUMNAS_CONV)
        .or(`usuario1_id.eq.${userId},usuario2_id.eq.${userId}`)
        .order('updated_at', { ascending: false }),
      supabaseAdmin
        .from('mensajes')
        .select('id, conversacion_id, remitente_id, contenido, created_at')
        .order('created_at', { ascending: false })
        .limit(1000),
    ]);

    const error = convRes.error || mensajesRes.error;
    if (error) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(error),
      });
    }

    const conversaciones = convRes.data || [];
    const convIds = conversaciones.map((c) => c.id);
    const mensajes = (mensajesRes.data || []).filter((m) => convIds.includes(m.conversacion_id));

    const data = conversaciones.map((conv) => {
      const soyUno = conv.usuario1_id === userId;
      const leidoHasta = soyUno ? conv.leido_por_1 : conv.leido_por_2;
      const delHilo = mensajes.filter((m) => m.conversacion_id === conv.id);
      const ultimo = delHilo[0] || null;
      const noLeidos = delHilo.filter(
        (m) => m.remitente_id !== userId && (!leidoHasta || new Date(m.created_at) > new Date(leidoHasta)),
      ).length;

      return {
        id: conv.id,
        otro: otroParticipante(conv, userId),
        ultimoMensaje: ultimo
          ? { contenido: ultimo.contenido, remitente_id: ultimo.remitente_id, created_at: ultimo.created_at }
          : null,
        noLeidos,
        updated_at: conv.updated_at,
      };
    });

    return res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Error interno del servidor.',
    });
  }
});

// ----------------------------------------------------------
// Obtiene (o crea) la conversación con otro jugador.
// Body: { usuario_id }
// ----------------------------------------------------------
router.post('/conversations', async (req, res) => {
  try {
    const userId = req.user.id;
    const { usuario_id } = req.body || {};

    if (!esUuid(usuario_id) || usuario_id === userId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Selecciona un jugador válido.',
      });
    }

    const { data: existe, error: existeError } = await supabaseAdmin
      .from('usuario')
      .select('id')
      .eq('id', usuario_id)
      .maybeSingle();

    if (existeError || !existe) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'El jugador no existe.',
      });
    }

    // Orden canónico: usuario1_id < usuario2_id.
    const [a, b] = userId < usuario_id ? [userId, usuario_id] : [usuario_id, userId];

    const { data: conv, error: convError } = await supabaseAdmin
      .from('conversaciones')
      .select(COLUMNAS_CONV)
      .eq('usuario1_id', a)
      .eq('usuario2_id', b)
      .maybeSingle();

    if (convError) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(convError),
      });
    }

    if (conv) {
      return res.status(200).json({ success: true, data: conv, error: null });
    }

    const { data: nueva, error: insertError } = await supabaseAdmin
      .from('conversaciones')
      .insert([{ usuario1_id: a, usuario2_id: b }])
      .select(COLUMNAS_CONV)
      .single();

    if (insertError) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(insertError),
      });
    }

    return res.status(201).json({ success: true, data: nueva, error: null });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Error interno del servidor.',
    });
  }
});

// ----------------------------------------------------------
// Mensajes de una conversación (más recientes primero). Al leerlos
// se marca la conversación como leída por el usuario autenticado.
// ----------------------------------------------------------
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const userId = req.user.id;
    const convId = Number(req.params.id);

    if (!Number.isInteger(convId)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Conversación no válida.',
      });
    }

    const { data: conv, error: convError } = await supabaseAdmin
      .from('conversaciones')
      .select(COLUMNAS_CONV)
      .eq('id', convId)
      .maybeSingle();

    if (convError) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(convError),
      });
    }

    if (!conv || (conv.usuario1_id !== userId && conv.usuario2_id !== userId)) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Conversación no encontrada.',
      });
    }

    const { data: mensajes, error: msgError } = await supabaseAdmin
      .from('mensajes')
      .select('id, conversacion_id, remitente_id, contenido, created_at')
      .eq('conversacion_id', convId)
      .order('created_at', { ascending: false })
      .limit(MENSAJES_POR_PAGINA);

    if (msgError) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(msgError),
      });
    }

    // Marca como leída la conversación para este usuario.
    const soyUno = conv.usuario1_id === userId;
    const columna = soyUno ? 'leido_por_1' : 'leido_por_2';
    await supabaseAdmin
      .from('conversaciones')
      .update({ [columna]: new Date().toISOString() })
      .eq('id', convId);

    return res.status(200).json({
      success: true,
      data: {
        conversacion: {
          id: conv.id,
          otro: otroParticipante(conv, userId),
        },
        mensajes: (mensajes || []).reverse(),
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

// ----------------------------------------------------------
// Envía un mensaje a una conversación.
// Body: { contenido }
// ----------------------------------------------------------
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const userId = req.user.id;
    const convId = Number(req.params.id);
    const contenido = (req.body?.contenido || '').trim();

    if (!Number.isInteger(convId)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Conversación no válida.',
      });
    }

    if (!contenido) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Escribe un mensaje.',
      });
    }

    if (contenido.length > CONTENIDO_MAX) {
      return res.status(400).json({
        success: false,
        data: null,
        error: `El mensaje no puede superar los ${CONTENIDO_MAX} caracteres.`,
      });
    }

    const { data: conv, error: convError } = await supabaseAdmin
      .from('conversaciones')
      .select('id, usuario1_id, usuario2_id')
      .eq('id', convId)
      .maybeSingle();

    if (convError) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(convError),
      });
    }

    if (!conv || (conv.usuario1_id !== userId && conv.usuario2_id !== userId)) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Conversación no encontrada.',
      });
    }

    const { data: mensaje, error: msgError } = await supabaseAdmin
      .from('mensajes')
      .insert([{ conversacion_id: convId, remitente_id: userId, contenido }])
      .select('id, conversacion_id, remitente_id, contenido, created_at')
      .single();

    if (msgError) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(msgError),
      });
    }

    // Actualiza el orden de la lista de conversaciones.
    await supabaseAdmin
      .from('conversaciones')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', convId);

    return res.status(201).json({ success: true, data: mensaje, error: null });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Error interno del servidor.',
    });
  }
});

export default router;
