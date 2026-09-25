import { Router } from 'express';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const router = Router();

// Cliente admin con service_role key: el backend es la única capa
// que escribe en las tablas de matchmaking (disponibilidad y
// solicitudes_partido), por lo que usa bypass de RLS.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ----------------------------------------------------------
// Utilidades
// ----------------------------------------------------------

// Distancia en kilómetros entre dos coordenadas (Haversine).
function distanciaKm(lat1, lon1, lat2, lon2) {
  const RADIO_TIERRA = 6371;
  const aRad = (grados) => (grados * Math.PI) / 180;

  const dLat = aRad(lat2 - lat1);
  const dLon = aRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRad(lat1)) * Math.cos(aRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return 2 * RADIO_TIERRA * Math.asin(Math.sqrt(a));
}

// ¿Se cruzan dos rangos horarios "HH:MM"? (formato 24h con cero a la izquierda).
function rangosSeCruzan(desdeA, hastaA, desdeB, hastaB) {
  if (!desdeA || !hastaA || !desdeB || !hastaB) return false;
  return desdeA < hastaB && desdeB < hastaA;
}

// ¿Comparten al menos un día de la semana?
function diasSeCruzan(diasA, diasB) {
  if (!Array.isArray(diasA) || !Array.isArray(diasB)) return false;
  return diasA.some((dia) => diasB.includes(dia));
}

// Extrae la comuna desde la dirección (última parte tras la coma).
function extraerComuna(direccion) {
  if (!direccion) return null;
  const partes = direccion.split(',');
  const comuna = partes[partes.length - 1]?.trim();
  return comuna || null;
}

// Normaliza un slot de la BD para el frontend.
function normalizarSlot(slot) {
  return {
    id: slot.id,
    dias: Array.isArray(slot.dias) ? slot.dias : [],
    desde: slot.desde,
    hasta: slot.hasta,
    modalidad: slot.modalidad,
    zona: slot.zona || '',
    tipoZona: slot.tipo_zona || '',
    latitud: slot.latitud ?? null,
    longitud: slot.longitud ?? null,
  };
}

// Convierte errores de Supabase en mensajes accionables para el usuario.
function mensajeError(error) {
  const msg = String(error?.message || '');
  if (/could not find the table/i.test(msg)) {
    return 'Falta la tabla de matchmaking en la base de datos. Ejecuta el script backend/scripts/matchmaking_schema.sql en el SQL Editor de Supabase y reinicia el backend.';
  }
  return msg || 'Error interno del servidor.';
}

// ----------------------------------------------------------
// Disponibilidad (compartida entre usuarios)
// ----------------------------------------------------------

// Obtiene los bloques de disponibilidad publicados por un usuario.
router.get('/availability/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Falta el identificador del usuario.',
      });
    }

    const { data, error } = await supabase
      .from('disponibilidad')
      .select('*')
      .eq('usuario_id', userId)
      .order('desde', { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(error),
      });
    }

    return res.status(200).json({
      success: true,
      data: (data || []).map(normalizarSlot),
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

// Reemplaza TODA la disponibilidad de un usuario por los bloques enviados.
// El frontend envía la lista completa; así se mantiene simple la
// sincronización (sin conflictos de edición por bloque).
router.put('/availability', async (req, res) => {
  try {
    const { userId, slots } = req.body || {};

    if (!userId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Falta el identificador del usuario.',
      });
    }

    if (!Array.isArray(slots)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'La disponibilidad debe ser una lista de bloques.',
      });
    }

    const bloquesValidos = slots.filter(
      (slot) =>
        slot &&
        Array.isArray(slot.dias) &&
        slot.dias.length > 0 &&
        slot.desde &&
        slot.hasta &&
        slot.desde < slot.hasta,
    );

    // 1) Eliminar los bloques anteriores del usuario.
    const { error: deleteError } = await supabase
      .from('disponibilidad')
      .delete()
      .eq('usuario_id', userId);

    if (deleteError) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(deleteError),
      });
    }

    // 2) Insertar los bloques nuevos (si hay).
    if (bloquesValidos.length > 0) {
      const filas = bloquesValidos.map((slot) => ({
        usuario_id: userId,
        dias: slot.dias,
        desde: slot.desde,
        hasta: slot.hasta,
        modalidad: slot.modalidad || 'Disponible para jugar',
        zona: slot.zona || null,
        tipo_zona: slot.tipoZona || '',
        latitud: slot.latitud ?? null,
        longitud: slot.longitud ?? null,
      }));

      const { data, error: insertError } = await supabase
        .from('disponibilidad')
        .insert(filas)
        .select();

      if (insertError) {
        return res.status(500).json({
          success: false,
          data: null,
          error: mensajeError(insertError),
        });
      }

      return res.status(200).json({
        success: true,
        data: (data || []).map(normalizarSlot),
        error: null,
      });
    }

    return res.status(200).json({
      success: true,
      data: [],
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
// Búsqueda de rivales
// ----------------------------------------------------------

// Lista los rivales potenciales: usuarios con disponibilidad
// publicada que se cruza con la del usuario actual.
// Filtros opcionales: nivel (categoría) y modalidad.
router.get('/rivals', async (req, res) => {
  try {
    const { userId, nivel, modalidad } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Falta el identificador del usuario.',
      });
    }

    // a) Disponibilidad del usuario actual.
    const { data: misSlotsRaw, error: errorMisSlots } = await supabase
      .from('disponibilidad')
      .select('*')
      .eq('usuario_id', userId);

    if (errorMisSlots) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(errorMisSlots),
      });
    }

    const misSlots = (misSlotsRaw || []).map(normalizarSlot);

    if (misSlots.length === 0) {
      return res.status(200).json({
        success: true,
        data: { rivales: [], total: 0, sinDisponibilidad: true },
        error: null,
      });
    }

    // b) Todos los usuarios excepto el actual.
    const { data: usuarios, error: errorUsuarios } = await supabase
      .from('usuario')
      .select('id, nombre, apellido, nivel, avatar_url')
      .neq('id', userId);

    if (errorUsuarios) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(errorUsuarios),
      });
    }

    // c) Toda la disponibilidad publicada.
    const { data: slotsRaw, error: errorSlots } = await supabase
      .from('disponibilidad')
      .select('*');

    if (errorSlots) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(errorSlots),
      });
    }

    const slotsPorUsuario = {};
    for (const slot of slotsRaw || []) {
      if (!slotsPorUsuario[slot.usuario_id]) {
        slotsPorUsuario[slot.usuario_id] = [];
      }
      slotsPorUsuario[slot.usuario_id].push(normalizarSlot(slot));
    }

    // d) Calcular coincidencias por rival.
    //    Se muestran TODOS los usuarios con disponibilidad publicada
    //    (filtrados por categoría/modalidad si se indican), para que
    //    cada jugador elija contra quién proponer un partido. Las
    //    coincidencias de horario son informativas, no un requisito.
    const rivales = [];

    for (const usuario of usuarios || []) {
      const slotsRival = slotsPorUsuario[usuario.id] || [];
      if (slotsRival.length === 0) continue;

      // Filtro por categoría.
      if (nivel && usuario.nivel !== nivel) continue;

      // Filtro por modalidad (se aplica a los bloques del rival).
      const slotsFiltrados = modalidad
        ? slotsRival.filter((slot) => slot.modalidad === modalidad)
        : slotsRival;

      if (slotsFiltrados.length === 0) continue;

      // Coincidencias: pares (mi bloque, bloque del rival) que se cruzan
      // en día y horario. Puede ser 0: igual se muestra al rival.
      const coincidencias = [];
      for (const miSlot of misSlots) {
        for (const rivalSlot of slotsFiltrados) {
          if (
            diasSeCruzan(miSlot.dias, rivalSlot.dias) &&
            rangosSeCruzan(miSlot.desde, miSlot.hasta, rivalSlot.desde, rivalSlot.hasta)
          ) {
            coincidencias.push({ miSlot, rivalSlot });
          }
        }
      }

      rivales.push({
        id: usuario.id,
        nombre: usuario.nombre || '',
        apellido: usuario.apellido || '',
        nivel: usuario.nivel || 'Sin nivel',
        avatar_url: usuario.avatar_url || null,
        slots: slotsFiltrados,
        coincidencias,
      });
    }

    // Ordenar: primero los que más coincidencias tienen, luego por nombre.
    rivales.sort(
      (a, b) =>
        b.coincidencias.length - a.coincidencias.length ||
        `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`, 'es'),
    );

    return res.status(200).json({
      success: true,
      data: { rivales, total: rivales.length, sinDisponibilidad: false },
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
// Cancha recomendada
// ----------------------------------------------------------

// Recomienda la cancha más cercana entre dos jugadores.
// Usa la ubicación de cada uno (geolocalización enviada por el
// frontend o la guardada en su disponibilidad) y calcula la
// cancha que minimiza el viaje total de ambos.
router.get('/recommend-court', async (req, res) => {
  try {
    const { userId, rivalId, lat, lng } = req.query;

    if (!userId || !rivalId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Faltan los identificadores de los jugadores.',
      });
    }

    // a) Ubicación del usuario actual.
    let ubicacionYo = null;
    let origenYo = null;
    let misSlots = [];

    if (lat && lng && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng))) {
      ubicacionYo = { lat: Number(lat), lng: Number(lng) };
      origenYo = 'geolocalizacion';
    } else {
      const { data: slots, error: errorMis } = await supabase
        .from('disponibilidad')
        .select('*')
        .eq('usuario_id', userId);

      if (errorMis) {
        return res.status(500).json({
          success: false,
          data: null,
          error: mensajeError(errorMis),
        });
      }

      misSlots = slots || [];

      const conUbicacion = misSlots.find(
        (slot) => slot.latitud != null && slot.longitud != null,
      );

      if (conUbicacion) {
        ubicacionYo = { lat: conUbicacion.latitud, lng: conUbicacion.longitud };
        origenYo = 'disponibilidad';
      }
    }

    // b) Ubicación del rival (desde su disponibilidad).
    const { data: rivalSlots, error: errorRival } = await supabase
      .from('disponibilidad')
      .select('*')
      .eq('usuario_id', rivalId);

    if (errorRival) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(errorRival),
      });
    }

    const rivalConUbicacion = (rivalSlots || []).find(
      (slot) => slot.latitud != null && slot.longitud != null,
    );

    const ubicacionRival = rivalConUbicacion
      ? { lat: rivalConUbicacion.latitud, lng: rivalConUbicacion.longitud }
      : null;

    const origenRival = rivalConUbicacion ? 'disponibilidad' : null;

    // c) Canchas disponibles.
    const { data: canchas, error: errorCanchas } = await supabase
      .from('canchas')
      .select('id, nombre, direccion, latitud, longitud');

    if (errorCanchas) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(errorCanchas),
      });
    }

    const listaCanchas = canchas || [];

    // d) Caso ideal: ambos tienen coordenadas → punto medio + distancias.
    if (ubicacionYo && ubicacionRival) {
      const puntoMedio = {
        lat: (ubicacionYo.lat + ubicacionRival.lat) / 2,
        lng: (ubicacionYo.lng + ubicacionRival.lng) / 2,
      };

      const conDistancias = listaCanchas
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
            comuna: extraerComuna(cancha.direccion),
            distanciaYo,
            distanciaRival,
            distanciaTotal: distanciaYo + distanciaRival,
            distanciaPuntoMedio: distanciaKm(
              puntoMedio.lat,
              puntoMedio.lng,
              cancha.latitud,
              cancha.longitud,
            ),
          };
        })
        .sort(
          (a, b) =>
            a.distanciaTotal - b.distanciaTotal ||
            a.distanciaPuntoMedio - b.distanciaPuntoMedio,
        );

      const [recomendada, ...alternativas] = conDistancias;

      return res.status(200).json({
        success: true,
        data: {
          recomendada: recomendada || null,
          alternativas: alternativas.slice(0, 5),
          puntoMedio,
          ubicacionYo: { ...ubicacionYo, origen: origenYo },
          ubicacionRival: { ...ubicacionRival, origen: origenRival },
          modo: 'coordenadas',
        },
        error: null,
      });
    }

    // e) Fallback: ambos eligieron una comuna en su disponibilidad.
    //    Se recomiendan canchas de las comunas elegidas.
    const comunasYo = new Set(
      (misSlots || [])
        .filter((slot) => slot.tipo_zona === 'comuna' && slot.zona)
        .map((slot) => slot.zona),
    );
    const comunasRival = new Set(
      (rivalSlots || [])
        .filter((slot) => slot.tipo_zona === 'comuna' && slot.zona)
        .map((slot) => slot.zona),
    );

    const comunasCompartidas = [...comunasYo].filter((comuna) =>
      comunasRival.has(comuna),
    );

    const canchasPorComuna = listaCanchas
      .filter((cancha) => {
        const comuna = extraerComuna(cancha.direccion);
        return comunasCompartidas.includes(comuna);
      })
      .map((cancha) => ({ ...cancha, comuna: extraerComuna(cancha.direccion) }));

    if (canchasPorComuna.length > 0) {
      const [recomendada, ...alternativas] = canchasPorComuna;

      return res.status(200).json({
        success: true,
        data: {
          recomendada: recomendada || null,
          alternativas: alternativas.slice(0, 5),
          puntoMedio: null,
          ubicacionYo: { lat: null, lng: null, origen: origenYo },
          ubicacionRival: { lat: null, lng: null, origen: origenRival },
          modo: 'comuna',
          comunasCompartidas,
        },
        error: null,
      });
    }

    // f) Sin información suficiente.
    return res.status(200).json({
      success: true,
      data: {
        recomendada: null,
        alternativas: [],
        puntoMedio: null,
        ubicacionYo: { lat: null, lng: null, origen: origenYo },
        ubicacionRival: { lat: null, lng: null, origen: origenRival },
        modo: 'sin-ubicacion',
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
// Solicitudes de partido
// ----------------------------------------------------------

// Envía una solicitud de partido a un rival.
router.post('/request', async (req, res) => {
  try {
    const {
      solicitanteId,
      receptorId,
      canchaId,
      canchaNombre,
      fechaSugerida,
      horaDesde,
      horaHasta,
      mensaje,
    } = req.body || {};

    if (!solicitanteId || !receptorId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Faltan los identificadores de los jugadores.',
      });
    }

    if (solicitanteId === receptorId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'No puedes enviarte una solicitud a ti mismo.',
      });
    }

    const { data, error } = await supabase
      .from('solicitudes_partido')
      .insert([
        {
          solicitante_id: solicitanteId,
          receptor_id: receptorId,
          cancha_id: canchaId || null,
          cancha_nombre: canchaNombre || null,
          fecha_sugerida: fechaSugerida || null,
          hora_desde: horaDesde || null,
          hora_hasta: horaHasta || null,
          mensaje: mensaje || null,
          estado: 'pendiente',
        },
      ])
      .select();

    if (error) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(error),
      });
    }

    return res.status(201).json({
      success: true,
      data: data?.[0] || null,
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

// Lista las solicitudes de un usuario: las recibidas (pendientes)
// y las enviadas, con los datos del otro jugador.
router.get('/requests', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Falta el identificador del usuario.',
      });
    }

    const { data: recibidas, error: errorRecibidas } = await supabase
      .from('solicitudes_partido')
      .select('*, solicitante:usuario!solicitudes_partido_solicitante_id_fkey(id, nombre, apellido, nivel, avatar_url)')
      .eq('receptor_id', userId)
      .order('created_at', { ascending: false });

    if (errorRecibidas) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(errorRecibidas),
      });
    }

    const { data: enviadas, error: errorEnviadas } = await supabase
      .from('solicitudes_partido')
      .select('*, receptor:usuario!solicitudes_partido_receptor_id_fkey(id, nombre, apellido, nivel, avatar_url)')
      .eq('solicitante_id', userId)
      .order('created_at', { ascending: false });

    if (errorEnviadas) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(errorEnviadas),
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        recibidas: recibidas || [],
        enviadas: enviadas || [],
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

// Acepta o rechaza una solicitud recibida.
router.patch('/requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, userId } = req.body || {};

    if (!id || !userId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Faltan datos para actualizar la solicitud.',
      });
    }

    if (!['aceptada', 'rechazada', 'cancelada'].includes(estado)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Estado de solicitud no válido.',
      });
    }

    const { data, error } = await supabase
      .from('solicitudes_partido')
      .update({ estado })
      .eq('id', id)
      .eq('receptor_id', userId)
      .select();

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
        error: 'Solicitud no encontrada o no autorizada.',
      });
    }

    return res.status(200).json({
      success: true,
      data: data[0],
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