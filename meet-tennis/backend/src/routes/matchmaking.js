import { Router } from 'express';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/auth.js';
import { distanciaKm, esUuid, extraerComuna, hoyChile } from '../lib/utils.js';

dotenv.config();

const router = Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const MODALIDADES = ['Disponible para jugar', 'Buscando partido'];
const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MENSAJE_MAX = 300;

const JUGADOR = 'id, nombre, apellido, nivel, avatar_url';
const COLUMNAS_SLOT =
  'id, usuario_id, dias, desde, hasta, modalidad, comuna, cancha:canchas(id, nombre)';
const COLUMNAS_SOLICITUD = `id, solicitante_id, receptor_id, fecha, hora_desde, hora_hasta,
  mensaje, estado, created_at, respondida_at,
  asiste_solicitante, asiste_receptor, asistencia_solicitante_at, asistencia_receptor_at,
  cancha:canchas(id, nombre, direccion),
  solicitante:usuario!solicitudes_partido_solicitante_id_fkey(${JUGADOR}),
  receptor:usuario!solicitudes_partido_receptor_id_fkey(${JUGADOR})`;

// Transiciones permitidas: quién puede hacer cada acción sobre
// una solicitud pendiente y a qué estado la lleva.
const ACCIONES = {
  aceptar: { estado: 'aceptada', rol: 'receptor_id' },
  rechazar: { estado: 'rechazada', rol: 'receptor_id' },
  cancelar: { estado: 'cancelada', rol: 'solicitante_id' },
};

// 42703: columna inexistente (falta ejecutar scripts/05_asistencia.sql).
const FALTA_SCRIPT =
  'Falta ejecutar el script backend/scripts/05_asistencia.sql en Supabase.';

const mensajeError = (error) => (error.code === '42703' ? FALTA_SCRIPT : error.message);

// Postgres devuelve "HH:MM:SS"; el frontend trabaja con "HH:MM".
const hhmm = (hora) => hora?.slice(0, 5) ?? null;

function formatearSlot(slot) {
  return {
    id: slot.id,
    dias: slot.dias,
    desde: hhmm(slot.desde),
    hasta: hhmm(slot.hasta),
    modalidad: slot.modalidad,
    comuna: slot.comuna,
    cancha: slot.cancha,
  };
}

function formatearSolicitud(solicitud) {
  return {
    ...solicitud,
    hora_desde: hhmm(solicitud.hora_desde),
    hora_hasta: hhmm(solicitud.hora_hasta),
  };
}

function seCruzan(a, b) {
  return (
    a.dias.some((dia) => b.dias.includes(dia)) && a.desde < b.hasta && b.desde < a.hasta
  );
}

// Punto de referencia de un jugador según las zonas de su disponibilidad:
// la cancha elegida o el centro de las canchas de la comuna elegida.
// Así nunca se usa ni se guarda la ubicación real (GPS) de otro jugador.
function ubicacionDesdeSlots(slots, canchas) {
  const puntos = [];

  for (const slot of slots) {
    if (slot.cancha_id != null) {
      const cancha = canchas.find((c) => c.id === slot.cancha_id);
      if (cancha) puntos.push(cancha);
    } else if (slot.comuna) {
      puntos.push(...canchas.filter((c) => c.comuna === slot.comuna));
    }
  }

  if (puntos.length === 0) return null;

  return {
    lat: puntos.reduce((suma, p) => suma + p.latitud, 0) / puntos.length,
    lng: puntos.reduce((suma, p) => suma + p.longitud, 0) / puntos.length,
  };
}

function coordenadaValida(valor, limite) {
  const numero = Number(valor);
  return valor !== undefined && valor !== '' && Number.isFinite(numero) &&
    Math.abs(numero) <= limite
    ? numero
    : null;
}

function errorInterno(res) {
  return res.status(500).json({
    success: false,
    data: null,
    error: 'Error interno del servidor.',
  });
}

router.use(requireAuth);

// ----------------------------------------------------------
// Búsqueda de rivales
// ----------------------------------------------------------

// Lista a los jugadores con disponibilidad publicada, ordenados por
// cuántos horarios comparten con el usuario autenticado.
// Query opcional: nivel (categoría) y modalidad.
router.get('/rivals', async (req, res) => {
  try {
    const userId = req.user.id;
    const { nivel, modalidad } = req.query;

    if (modalidad && !MODALIDADES.includes(modalidad)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Modalidad no válida.',
      });
    }

    const { data: slots, error } = await supabaseAdmin
      .from('disponibilidad')
      .select(`${COLUMNAS_SLOT}, jugador:usuario(${JUGADOR})`);

    if (error) {
      return res.status(500).json({ success: false, data: null, error: error.message });
    }

    const misSlots = [];
    const rivalesPorId = new Map();

    for (const slot of slots || []) {
      if (slot.usuario_id === userId) {
        misSlots.push(formatearSlot(slot));
        continue;
      }
      if (!slot.jugador) continue;
      if (nivel && slot.jugador.nivel !== nivel) continue;
      if (modalidad && slot.modalidad !== modalidad) continue;

      if (!rivalesPorId.has(slot.usuario_id)) {
        rivalesPorId.set(slot.usuario_id, { ...slot.jugador, slots: [] });
      }
      rivalesPorId.get(slot.usuario_id).slots.push(formatearSlot(slot));
    }

    // Coincidencias: pares (mi bloque, bloque del rival) que comparten
    // día y horario. Son informativas: un rival sin coincidencias
    // también se muestra, para poder proponerle otro horario.
    const rivales = [...rivalesPorId.values()].map((rival) => ({
      ...rival,
      nivel: rival.nivel || 'Sin nivel',
      coincidencias: misSlots.flatMap((miSlot) =>
        rival.slots
          .filter((rivalSlot) => seCruzan(miSlot, rivalSlot))
          .map((rivalSlot) => ({ miSlot, rivalSlot })),
      ),
    }));

    rivales.sort(
      (a, b) =>
        b.coincidencias.length - a.coincidencias.length ||
        `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`, 'es'),
    );

    return res.status(200).json({
      success: true,
      data: {
        rivales,
        total: rivales.length,
        sinDisponibilidad: misSlots.length === 0,
      },
      error: null,
    });
  } catch (err) {
    return errorInterno(res);
  }
});

// ----------------------------------------------------------
// Cancha recomendada
// ----------------------------------------------------------

// Recomienda la cancha que minimiza el viaje total de ambos jugadores.
// Query: rivalId (obligatorio), lat/lng (opcional: ubicación actual del
// usuario autenticado, que solo se usa para este cálculo y no se guarda).
router.get('/recommend-court', async (req, res) => {
  try {
    const userId = req.user.id;
    const { rivalId } = req.query;

    if (!esUuid(rivalId) || rivalId === userId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Rival no válido.',
      });
    }

    const [canchasRes, slotsRes] = await Promise.all([
      supabaseAdmin.from('canchas').select('id, nombre, direccion, latitud, longitud'),
      supabaseAdmin
        .from('disponibilidad')
        .select('usuario_id, comuna, cancha_id')
        .in('usuario_id', [userId, rivalId]),
    ]);

    const error = canchasRes.error || slotsRes.error;
    if (error) {
      return res.status(500).json({ success: false, data: null, error: error.message });
    }

    const canchas = (canchasRes.data || [])
      .map((c) => ({
        ...c,
        latitud: Number(c.latitud),
        longitud: Number(c.longitud),
        comuna: extraerComuna(c.direccion),
      }))
      .filter((c) => Number.isFinite(c.latitud) && Number.isFinite(c.longitud));

    const slots = slotsRes.data || [];
    const lat = coordenadaValida(req.query.lat, 90);
    const lng = coordenadaValida(req.query.lng, 180);

    const ubicacionYo =
      lat !== null && lng !== null
        ? { lat, lng }
        : ubicacionDesdeSlots(
            slots.filter((s) => s.usuario_id === userId),
            canchas,
          );
    const ubicacionRival = ubicacionDesdeSlots(
      slots.filter((s) => s.usuario_id === rivalId),
      canchas,
    );

    if (!ubicacionYo || !ubicacionRival || canchas.length === 0) {
      return res.status(200).json({
        success: true,
        data: { recomendada: null, alternativas: [], modo: 'sin-ubicacion' },
        error: null,
      });
    }

    const ordenadas = canchas
      .map((cancha) => {
        const distanciaYo = distanciaKm(
          ubicacionYo.lat,
          ubicacionYo.lng,
          cancha.latitud,
          cancha.longitud,
        );
        const distanciaRival = distanciaKm(
          ubicacionRival.lat,
          ubicacionRival.lng,
          cancha.latitud,
          cancha.longitud,
        );
        return {
          ...cancha,
          distanciaYo,
          distanciaRival,
          distanciaTotal: distanciaYo + distanciaRival,
        };
      })
      .sort((a, b) => a.distanciaTotal - b.distanciaTotal);

    const [recomendada, ...alternativas] = ordenadas;

    return res.status(200).json({
      success: true,
      data: {
        recomendada,
        alternativas: alternativas.slice(0, 5),
        modo: 'coordenadas',
      },
      error: null,
    });
  } catch (err) {
    return errorInterno(res);
  }
});

// ----------------------------------------------------------
// Solicitudes de partido
// ----------------------------------------------------------

// Lista las solicitudes recibidas y enviadas por el usuario autenticado.
router.get('/requests', async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabaseAdmin
      .from('solicitudes_partido')
      .select(COLUMNAS_SOLICITUD)
      .or(`solicitante_id.eq.${userId},receptor_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, data: null, error: mensajeError(error) });
    }

    const solicitudes = (data || []).map(formatearSolicitud);

    return res.status(200).json({
      success: true,
      data: {
        recibidas: solicitudes.filter((s) => s.receptor_id === userId),
        enviadas: solicitudes.filter((s) => s.solicitante_id === userId),
      },
      error: null,
    });
  } catch (err) {
    return errorInterno(res);
  }
});

// Envía una solicitud de partido a otro jugador.
// Body: { receptor_id, fecha: "YYYY-MM-DD", hora_desde: "HH:MM",
//         hora_hasta: "HH:MM", cancha_id?, mensaje? }
router.post('/requests', async (req, res) => {
  try {
    const userId = req.user.id;
    const { receptor_id, fecha, hora_desde, hora_hasta, cancha_id, mensaje } =
      req.body || {};

    if (!esUuid(receptor_id) || receptor_id === userId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Selecciona un rival válido.',
      });
    }

    if (!FECHA_REGEX.test(fecha || '') || fecha < hoyChile()) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'La fecha es obligatoria y no puede ser pasada.',
      });
    }

    if (!HORA_REGEX.test(hora_desde || '') || !HORA_REGEX.test(hora_hasta || '')) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Indica el horario propuesto (HH:MM).',
      });
    }

    if (hora_hasta <= hora_desde) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'La hora de término debe ser mayor a la de inicio.',
      });
    }

    const mensajeLimpio = typeof mensaje === 'string' ? mensaje.trim() : '';
    if (mensajeLimpio.length > MENSAJE_MAX) {
      return res.status(400).json({
        success: false,
        data: null,
        error: `El mensaje no puede superar los ${MENSAJE_MAX} caracteres.`,
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

    const { data: receptor } = await supabaseAdmin
      .from('usuario')
      .select('id')
      .eq('id', receptor_id)
      .maybeSingle();

    if (!receptor) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'El rival no existe.',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('solicitudes_partido')
      .insert([
        {
          solicitante_id: userId,
          receptor_id,
          cancha_id: canchaId,
          fecha,
          hora_desde,
          hora_hasta,
          mensaje: mensajeLimpio || null,
        },
      ])
      .select(COLUMNAS_SOLICITUD)
      .single();

    if (error) {
      // 23505: ya existe una solicitud pendiente para este rival.
      const duplicada = error.code === '23505';
      return res.status(duplicada ? 409 : 400).json({
        success: false,
        data: null,
        error: duplicada
          ? 'Ya tienes una solicitud pendiente con este jugador.'
          : error.message,
      });
    }

    return res.status(201).json({
      success: true,
      data: formatearSolicitud(data),
      error: null,
    });
  } catch (err) {
    return errorInterno(res);
  }
});

// Responde una solicitud pendiente.
// Body: { accion: "aceptar" | "rechazar" (receptor) | "cancelar" (solicitante) }
router.patch('/requests/:id', async (req, res) => {
  try {
    const accion = ACCIONES[req.body?.accion];

    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Identificador no válido.',
      });
    }

    if (!accion) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'La acción debe ser aceptar, rechazar o cancelar.',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('solicitudes_partido')
      .update({ estado: accion.estado, respondida_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq(accion.rol, req.user.id)
      .eq('estado', 'pendiente')
      .select(COLUMNAS_SOLICITUD);

    if (error) {
      return res.status(500).json({ success: false, data: null, error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'No hay una solicitud pendiente tuya con ese identificador.',
      });
    }

    return res.status(200).json({
      success: true,
      data: formatearSolicitud(data[0]),
      error: null,
    });
  } catch (err) {
    return errorInterno(res);
  }
});

// Confirma o anula la asistencia a un partido aceptado que aún no se juega.
// Body: { asiste: true | false }. "false" (no puedo) cancela el partido
// y el rival recibe el aviso.
router.patch('/requests/:id/asistencia', async (req, res) => {
  try {
    const userId = req.user.id;
    const { asiste } = req.body || {};

    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Identificador no válido.',
      });
    }

    if (typeof asiste !== 'boolean') {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Indica si asistes (true) o no (false).',
      });
    }

    const { data: solicitud, error: errorLectura } = await supabaseAdmin
      .from('solicitudes_partido')
      .select('id, solicitante_id, receptor_id, fecha, estado')
      .eq('id', req.params.id)
      .or(`solicitante_id.eq.${userId},receptor_id.eq.${userId}`)
      .maybeSingle();

    if (errorLectura) {
      return res.status(500).json({ success: false, data: null, error: errorLectura.message });
    }

    if (!solicitud || solicitud.estado !== 'aceptada' || solicitud.fecha < hoyChile()) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'No tienes un partido próximo con ese identificador.',
      });
    }

    const rol = solicitud.solicitante_id === userId ? 'solicitante' : 'receptor';
    const cambios = {
      [`asiste_${rol}`]: asiste,
      [`asistencia_${rol}_at`]: new Date().toISOString(),
      ...(asiste ? {} : { estado: 'cancelada' }),
    };

    const { data, error } = await supabaseAdmin
      .from('solicitudes_partido')
      .update(cambios)
      .eq('id', solicitud.id)
      .eq('estado', 'aceptada')
      .select(COLUMNAS_SOLICITUD);

    if (error) {
      return res.status(500).json({ success: false, data: null, error: mensajeError(error) });
    }

    if (!data || data.length === 0) {
      return res.status(409).json({
        success: false,
        data: null,
        error: 'El partido cambió mientras respondías. Recarga la página.',
      });
    }

    return res.status(200).json({
      success: true,
      data: formatearSolicitud(data[0]),
      error: null,
    });
  } catch (err) {
    return errorInterno(res);
  }
});

export default router;
