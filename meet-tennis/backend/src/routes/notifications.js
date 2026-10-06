import { Router } from 'express';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/auth.js';
import { partidoDesde } from '../lib/ranking.js';
import { hoyChile, ventanaAsistencia } from '../lib/utils.js';

dotenv.config();

const router = Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Los avisos informativos se muestran durante este plazo.
const DIAS_INFORMATIVOS = 30;
const MAX_INFORMATIVOS = 20;

const JUGADOR = 'id, nombre, apellido, avatar_url';

const nombre = (jugador) =>
  `${jugador?.nombre || ''} ${jugador?.apellido || ''}`.trim() || 'Un jugador';

// "2026-10-12" → "12/10".
const diaMes = (fecha) => fecha?.slice(8, 10) + '/' + fecha?.slice(5, 7);

// 42703: columna inexistente (falta ejecutar scripts/04_avisos.sql o 05_asistencia.sql).
const FALTA_SCRIPT =
  'Faltan scripts en Supabase: ejecuta backend/scripts/04_avisos.sql y 05_asistencia.sql.';

router.use(requireAuth);

// Avisos del usuario autenticado, calculados desde solicitudes y partidos:
// - "accion": requieren una respuesta; desaparecen al responder.
// - "info": novedades; son "nuevas" hasta que el usuario abre la campana.
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const limite = new Date(Date.now() - DIAS_INFORMATIVOS * 86400000);
    const reciente = (fecha) => !!fecha && new Date(fecha) >= limite;

    const [yoRes, solicitudesRes, partidosRes] = await Promise.all([
      supabaseAdmin.from('usuario').select('avisos_vistos_at').eq('id', userId).maybeSingle(),
      supabaseAdmin
        .from('solicitudes_partido')
        .select(
          `id, solicitante_id, receptor_id, fecha, hora_desde, estado, created_at, respondida_at,
          asiste_solicitante, asiste_receptor, asistencia_solicitante_at, asistencia_receptor_at,
          solicitante:usuario!solicitudes_partido_solicitante_id_fkey(${JUGADOR}),
          receptor:usuario!solicitudes_partido_receptor_id_fkey(${JUGADOR})`,
        )
        .or(`solicitante_id.eq.${userId},receptor_id.eq.${userId}`),
      supabaseAdmin
        .from('partidos')
        .select(
          `id, jugador1_id, jugador2_id, ganador_id, categoria_j1, categoria_j2,
          fecha, estado, created_at, respondido_at,
          jugador1:usuario!partidos_jugador1_id_fkey(${JUGADOR}),
          jugador2:usuario!partidos_jugador2_id_fkey(${JUGADOR})`,
        )
        .or(`jugador1_id.eq.${userId},jugador2_id.eq.${userId}`),
    ]);

    const error = yoRes.error || solicitudesRes.error || partidosRes.error;
    if (error) {
      return res.status(500).json({
        success: false,
        data: null,
        error: error.code === '42703' ? FALTA_SCRIPT : error.message,
      });
    }

    const vistosAt = yoRes.data?.avisos_vistos_at || null;
    const avisos = [];

    const hoy = hoyChile();

    for (const s of solicitudesRes.data || []) {
      const soyReceptor = s.receptor_id === userId;
      const rival = soyReceptor ? s.solicitante : s.receptor;
      const miAsistencia = soyReceptor ? s.asiste_receptor : s.asiste_solicitante;
      const suAsistencia = soyReceptor ? s.asiste_solicitante : s.asiste_receptor;
      const suAsistenciaAt = soyReceptor
        ? s.asistencia_solicitante_at
        : s.asistencia_receptor_at;
      // Cancelada porque un jugador avisó que no podía asistir (no es
      // la cancelación de una propuesta pendiente).
      const cancelPorAsistencia =
        s.estado === 'cancelada' &&
        (s.asiste_solicitante === false || s.asiste_receptor === false);

      // Confirmación de asistencia: el día antes y el mismo día.
      const cuando = ventanaAsistencia(s.fecha, hoy);
      if (s.estado === 'aceptada' && miAsistencia == null && cuando) {
        avisos.push({
          id: `asistencia-${s.id}`,
          tipo: 'accion',
          categoria: 'solicitudes',
          jugador: rival,
          texto: `¿Confirmas tu partido de ${cuando} con ${nombre(rival)} a las ${s.hora_desde?.slice(0, 5)}?`,
          fecha: s.respondida_at || s.created_at,
          destino: '/buscar-partido',
          asistencia: s.id,
        });
      }

      if (suAsistencia != null && reciente(suAsistenciaAt)) {
        avisos.push({
          id: `asistencia-${s.id}-${suAsistencia ? 'si' : 'no'}`,
          tipo: 'info',
          jugador: rival,
          texto: suAsistencia
            ? `${nombre(rival)} confirmó que asiste al partido del ${diaMes(s.fecha)}.`
            : `${nombre(rival)} no puede asistir al partido del ${diaMes(s.fecha)}. Se canceló.`,
          positivo: suAsistencia,
          fecha: suAsistenciaAt,
          destino: '/buscar-partido',
        });
      }

      if (cancelPorAsistencia) continue;

      if (s.estado === 'pendiente' && soyReceptor) {
        avisos.push({
          id: `solicitud-${s.id}`,
          tipo: 'accion',
          categoria: 'solicitudes',
          jugador: s.solicitante,
          texto: `${nombre(s.solicitante)} te propone jugar el ${diaMes(s.fecha)}.`,
          fecha: s.created_at,
          destino: '/buscar-partido',
        });
      } else if (reciente(s.respondida_at) && !soyReceptor && s.estado !== 'cancelada') {
        // Respuesta a una solicitud que envié.
        const acepto = s.estado === 'aceptada';
        avisos.push({
          id: `solicitud-${s.id}-${s.estado}`,
          tipo: 'info',
          jugador: s.receptor,
          texto: acepto
            ? `${nombre(s.receptor)} aceptó jugar el ${diaMes(s.fecha)}.`
            : `${nombre(s.receptor)} no puede jugar el ${diaMes(s.fecha)}.`,
          positivo: acepto,
          fecha: s.respondida_at,
          destino: '/buscar-partido',
        });
      } else if (reciente(s.respondida_at) && soyReceptor && s.estado === 'cancelada') {
        avisos.push({
          id: `solicitud-${s.id}-cancelada`,
          tipo: 'info',
          jugador: s.solicitante,
          texto: `${nombre(s.solicitante)} canceló su propuesta para el ${diaMes(s.fecha)}.`,
          positivo: false,
          fecha: s.respondida_at,
          destino: '/buscar-partido',
        });
      }
    }

    for (const p of partidosRes.data || []) {
      const soyJ1 = p.jugador1_id === userId;
      const rival = soyJ1 ? p.jugador2 : p.jugador1;

      if (p.estado === 'pendiente' && !soyJ1) {
        avisos.push({
          id: `partido-${p.id}`,
          tipo: 'accion',
          categoria: 'partidos',
          jugador: rival,
          texto: `${nombre(rival)} registró un partido contigo. Confírmalo.`,
          fecha: p.created_at,
          destino: '/mis-partidos',
        });
      } else if (reciente(p.respondido_at) && soyJ1 && p.estado !== 'pendiente') {
        // Respuesta a un resultado que registré.
        const confirmado = p.estado === 'confirmado';
        const { puntos } = partidoDesde(p, userId);
        avisos.push({
          id: `partido-${p.id}-${p.estado}`,
          tipo: 'info',
          jugador: rival,
          texto: confirmado
            ? `${nombre(rival)} confirmó el partido: ${puntos > 0 ? '+' : ''}${puntos} pts.`
            : `${nombre(rival)} rechazó el resultado que registraste.`,
          positivo: confirmado,
          fecha: p.respondido_at,
          destino: '/mis-partidos',
        });
      }
    }

    const accion = avisos
      .filter((a) => a.tipo === 'accion')
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    const info = avisos
      .filter((a) => a.tipo === 'info')
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, MAX_INFORMATIVOS)
      .map((a) => ({ ...a, nuevo: !vistosAt || new Date(a.fecha) > new Date(vistosAt) }));

    return res.status(200).json({
      success: true,
      data: {
        avisos: [...accion, ...info],
        noLeidos: accion.length + info.filter((a) => a.nuevo).length,
        pendientes: {
          solicitudes: accion.filter((a) => a.categoria === 'solicitudes').length,
          partidos: accion.filter((a) => a.categoria === 'partidos').length,
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

// Marca los avisos informativos como vistos (al abrir la campana).
router.post('/vistos', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('usuario')
      .update({ avisos_vistos_at: new Date().toISOString() })
      .eq('id', req.user.id);

    if (error) {
      return res.status(500).json({
        success: false,
        data: null,
        error: error.code === '42703' ? FALTA_SCRIPT : error.message,
      });
    }

    return res.status(200).json({ success: true, data: null, error: null });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Error interno del servidor.',
    });
  }
});

export default router;
