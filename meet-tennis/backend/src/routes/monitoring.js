import { Router } from 'express';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/auth.js';
import { resumen as resumenTecnico } from '../lib/requestMetrics.js';

dotenv.config();

const router = Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Categorías válidas de productos (scripts/08_productos.sql).
const CATEGORIAS_PRODUCTO = [
  'Raquetas',
  'Zapatillas',
  'Cuerdas',
  'Accesorios',
  'Ropa',
];

// Categorías de tenis, de mayor a menor nivel competitivo.
const CATEGORIAS_TENIS = [
  '1ra Categoría',
  '2da Categoría',
  '3ra Categoría',
  '4ta Categoría',
  '5ta Categoría',
];

// Correos admin como respaldo de desarrollo, mientras no se ejecute el
// script scripts/09_admin_rol.sql. Fuente principal: columna 'rol' de
// la tabla usuario.
const ADMINS = (process.env.MONITORING_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const SIN_PERMISO = 'No tienes permisos para ver el panel de monitoreo.';

// ¿El usuario autenticado es administrador?
//  - Si la tabla ya tiene la columna 'rol' (script 09 aplicado), decide
//    solo el rol: 'admin' permite, 'jugador' deniega.
//  - Si aún no existe la columna, se cae al respaldo: MONITORING_EMAILS
//    si está configurado, o acceso abierto solo en desarrollo.
async function usuarioEsAdmin(user) {
  const { data, error } = await supabaseAdmin
    .from('usuario')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle();

  const columnaRol = !error;
  if (columnaRol) return data?.rol === 'admin';

  const email = (user?.email || '').toLowerCase();
  if (ADMINS.length === 0) return true;
  return ADMINS.includes(email);
}

// Fecha (YYYY-MM-DD) de un timestamp en hora de Chile.
function diaChile(iso) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(
    new Date(iso),
  );
}

// Serie de los últimos 7 días (incluido hoy): [{ fecha, total }].
function serieUltimos7(fechas) {
  const hoy = diaChile(new Date().toISOString());
  const dias = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(`${hoy}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    dias.push(d.toISOString().slice(0, 10));
  }

  const conteo = new Map(dias.map((d) => [d, 0]));
  for (const fecha of fechas) {
    if (fecha && conteo.has(fecha)) {
      conteo.set(fecha, conteo.get(fecha) + 1);
    }
  }

  return dias.map((fecha) => ({ fecha, total: conteo.get(fecha) }));
}

// Estado operativo general a partir de la salud y las métricas técnicas.
// Simula la señal de un dashboard real: ok / alerta / crítico.
function calcularSenal(salud, tecnico) {
  if (salud.baseDeDatos !== 'ok') {
    return {
      nivel: 'critico',
      mensaje: 'La base de datos reporta errores: revisa las métricas afectadas.',
    };
  }
  if (tecnico.hora.tasaError >= 10) {
    return {
      nivel: 'critico',
      mensaje: `Tasa de error alta en la última hora (${tecnico.hora.tasaError}%).`,
    };
  }
  if (tecnico.hora.tasaError >= 5) {
    return {
      nivel: 'alerta',
      mensaje: `Tasa de error elevada en la última hora (${tecnico.hora.tasaError}%).`,
    };
  }
  if (tecnico.hora.latenciaPromedioMs > 3000) {
    return {
      nivel: 'alerta',
      mensaje: `Latencia promedio alta (${tecnico.hora.latenciaPromedioMs} ms).`,
    };
  }
  return { nivel: 'ok', mensaje: 'Todo operando con normalidad.' };
}

// Cuenta elementos agrupados por una clave: [{ clave, total }...]
function contarPor(items, claveFn) {
  const mapa = new Map();
  for (const item of items) {
    const clave = claveFn(item);
    if (clave == null) continue;
    mapa.set(clave, (mapa.get(clave) || 0) + 1);
  }
  return [...mapa.entries()]
    .map(([clave, total]) => ({ clave, total }))
    .sort((a, b) => b.total - a.total);
}

// Lista los usuarios de auth (paginado). Se usa porque la tabla
// 'usuario' no siempre guarda created_at; la fecha de registro real
// vive en auth.users.
async function listarAuthUsers() {
  const todos = [];
  try {
    for (let page = 1; ; page += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) break;
      todos.push(...data.users);
      if (data.users.length < 200) break;
    }
  } catch {
    // Si falla, las estadísticas de fechas se muestran como "—".
  }
  return todos;
}

function nombreCompleto(perfil) {
  return `${perfil?.nombre || ''} ${perfil?.apellido || ''}`.trim() || 'Jugador';
}

// Los nombres/FKs de las relaciones las definen Postgres a partir de la
// convención <tabla>_<columna>_fkey.
const RECIENTE_PARTIDOS =
  'id, created_at, estado, fecha, ' +
  'jugador1:usuario!partidos_jugador1_id_fkey(nombre, apellido), ' +
  'jugador2:usuario!partidos_jugador2_id_fkey(nombre, apellido)';
const RECIENTE_SOLICITUDES =
  'id, created_at, estado, ' +
  'solicitante:usuario!solicitudes_partido_solicitante_id_fkey(nombre, apellido), ' +
  'receptor:usuario!solicitudes_partido_receptor_id_fkey(nombre, apellido)';
const RECIENTE_RESENAS =
  'id, created_at, calificacion, ' +
  'autor:usuario!resenas_autor_id_fkey(nombre, apellido)';
const RECIENTE_MENSAJES =
  'id, created_at, contenido, ' +
  'remitente:usuario!mensajes_remitente_id_fkey(nombre, apellido)';

// Consulta ligera: ¿el usuario autenticado puede ver el panel? La usa el
// frontend para mostrar u ocultar el acceso en el dashboard principal.
router.get('/acceso', requireAuth, async (req, res) => {
  try {
    const esAdminU = await usuarioEsAdmin(req.user);
    return res.status(200).json({
      success: true,
      data: { esAdmin: esAdminU },
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

// Panel de monitoreo: resume en una sola respuesta la salud del backend
// y los indicadores principales de la base de datos.
router.get('/', requireAuth, async (req, res) => {
  if (!(await usuarioEsAdmin(req.user))) {
    return res.status(403).json({
      success: false,
      data: null,
      error: SIN_PERMISO,
    });
  }
  const inicio = Date.now();
  const errores = [];

  // Conteos simples con head:true (solo el count).
  const [canchasRes, disponibilidadRes, conversacionesRes, mensajesRes] =
    await Promise.all([
      supabaseAdmin.from('canchas').select('*', { count: 'exact', head: true }),
      supabaseAdmin
        .from('disponibilidad')
        .select('*', { count: 'exact', head: true }),
      supabaseAdmin
        .from('conversaciones')
        .select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('mensajes').select('*', { count: 'exact', head: true }),
    ]);

  if (canchasRes.error) errores.push('canchas');
  if (disponibilidadRes.error) errores.push('disponibilidad');
  if (conversacionesRes.error) errores.push('conversaciones');
  if (mensajesRes.error) errores.push('mensajes');

  // Datos en bruto para agregar.
  const [usuariosRes, partidosRes, solicitudesRes, resenasRes, productosRes, canchasNombresRes] =
    await Promise.all([
      supabaseAdmin.from('usuario').select('id, nombre, apellido, nivel, comuna'),
      supabaseAdmin
        .from('partidos')
        .select('id, estado, fecha, created_at, jugador1_id, jugador2_id, cancha_id'),
      supabaseAdmin.from('solicitudes_partido').select('id, estado, created_at'),
      supabaseAdmin
        .from('resenas')
        .select('calificacion, created_at'),
      supabaseAdmin.from('productos').select('id, categoria'),
      supabaseAdmin.from('canchas').select('id, nombre'),
    ]);

  if (usuariosRes.error) errores.push('usuarios');
  if (partidosRes.error) errores.push('partidos');
  if (solicitudesRes.error) errores.push('solicitudes');
  if (resenasRes.error) errores.push('resenas');
  if (productosRes.error) errores.push('productos');
  if (canchasNombresRes.error) errores.push('canchas');

  // Actividad reciente (alimenta el feed del panel).
  const [recientesRes] = await Promise.all([
    Promise.all([
      supabaseAdmin
        .from('partidos')
        .select(RECIENTE_PARTIDOS)
        .order('created_at', { ascending: false })
        .limit(6),
      supabaseAdmin
        .from('solicitudes_partido')
        .select(RECIENTE_SOLICITUDES)
        .order('created_at', { ascending: false })
        .limit(6),
      supabaseAdmin
        .from('resenas')
        .select(RECIENTE_RESENAS)
        .order('created_at', { ascending: false })
        .limit(6),
      supabaseAdmin
        .from('mensajes')
        .select(RECIENTE_MENSAJES)
        .order('created_at', { ascending: false })
        .limit(6),
    ]).then(([p, s, r, m]) => ({ p, s, r, m, ok: true }))
      .catch(() => ({ ok: false, errores: ['actividad'] })),
  ]);

  // Si el feed de actividad falló, se avisa pero el resto sigue válido.
  if (!recientesRes.ok) {
    errores.push('actividad');
  }

  const usuarios = usuariosRes.data || [];
  const partidos = partidosRes.data || [];
  const solicitudes = solicitudesRes.data || [];
  const resenas = resenasRes.data || [];
  const productos = productosRes.data || [];
  const canchasNombres = new Map((canchasNombresRes.data || []).map((c) => [c.id, c.nombre]));

  // --- Usuarios ------------------------------------------------------
  // La tabla 'usuario' no siempre tiene created_at (error 42703). La
  // fecha de registro real se toma de auth.users.created_at.
  const authUsuarios = await listarAuthUsers();
  const fechasRegistro = new Map(authUsuarios.map((u) => [u.id, u.created_at]));
  const fechasRegistroUsuarios = usuarios
    .map((u) => fechasRegistro.get(u.id))
    .filter(Boolean);
  const conFechas = fechasRegistroUsuarios.length > 0;
  const fechasAlta = conFechas
    ? fechasRegistroUsuarios.map((f) => diaChile(f)).filter(Boolean)
    : [];
  const hoy = new Date();
  const hace7 = new Date(hoy);
  hace7.setDate(hace7.getDate() - 7);
  const hace30 = new Date(hoy);
  hace30.setDate(hace30.getDate() - 30);

  const nuevos7 = conFechas
    ? fechasRegistroUsuarios.filter((f) => new Date(f) >= hace7).length
    : null;
  const nuevos30 = conFechas
    ? fechasRegistroUsuarios.filter((f) => new Date(f) >= hace30).length
    : null;

  const porCategoria = CATEGORIAS_TENIS.map((clave) => ({
    clave,
    total: usuarios.filter((u) => (u.nivel || '5ta Categoría') === clave).length,
  })).filter((c) => c.total > 0);

  const porComuna = contarPor(usuarios, (u) => u.comuna || 'Sin comuna')
    .slice(0, 6);

  // --- Partidos ------------------------------------------------------
  const partidosPorEstado = contarPor(partidos, (p) => p.estado || 'pendiente');
  const partidosPorDia = serieUltimos7(partidos.map((p) => p.fecha));

  // --- Solicitudes ----------------------------------------------------
  const solicitudesPorEstado = contarPor(solicitudes, (s) => s.estado);
  const solicitudesPorDia = serieUltimos7(
    solicitudes.map((s) => diaChile(s.created_at)).filter(Boolean),
  );

  // --- Estadísticas de la app -----------------------------------------
  const nombres = new Map(usuarios.map((u) => [u.id, nombreCompleto(u)]));

  // Jugadores con más partidos confirmados (participan como J1 o J2).
  const porJugador = new Map();
  for (const p of partidos) {
    if (p.estado !== 'confirmado') continue;
    porJugador.set(p.jugador1_id, (porJugador.get(p.jugador1_id) || 0) + 1);
    porJugador.set(p.jugador2_id, (porJugador.get(p.jugador2_id) || 0) + 1);
  }
  const jugadoresActivos = [...porJugador.entries()]
    .map(([id, total]) => ({ clave: nombres.get(id) || 'Jugador', total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Canchas donde se juega más (partidos confirmados).
  const porCancha = new Map();
  for (const p of partidos) {
    if (p.estado !== 'confirmado' || p.cancha_id == null) continue;
    porCancha.set(p.cancha_id, (porCancha.get(p.cancha_id) || 0) + 1);
  }
  const canchasTop = [...porCancha.entries()]
    .map(([id, total]) => ({ clave: canchasNombres.get(id) || `Cancha ${id}`, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Resultados registrados que todavía no confirma el rival (requieren
  // acción para que sumen puntos al ranking).
  const partidosPendientes = partidos
    .filter((p) => p.estado === 'pendiente')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)
    .map((p) => ({
      jugador1: nombres.get(p.jugador1_id) || 'Jugador',
      jugador2: nombres.get(p.jugador2_id) || 'Jugador',
      fecha: p.fecha,
      creadoEn: p.created_at,
    }));

  // --- Reseñas -------------------------------------------------------
  const promedioResenas =
    resenas.length > 0
      ? +(resenas.reduce((suma, r) => suma + r.calificacion, 0) / resenas.length).toFixed(2)
      : null;
  const porEstrella = [1, 2, 3, 4, 5].map((estrellas) => ({
    estrellas,
    total: resenas.filter((r) => r.calificacion === estrellas).length,
  }));

  // --- Productos -----------------------------------------------------
  const productosPorCategoria = CATEGORIAS_PRODUCTO.map((clave) => ({
    clave,
    total: productos.filter((p) => p.categoria === clave).length,
  })).filter((c) => c.total > 0);

  // --- Actividad reciente ---------------------------------------------
  const eventos = [];

  if (recientesRes.ok) {
    for (const p of recientesRes.p?.data || []) {
      eventos.push({
        tipo: 'partido',
        texto: `${nombreCompleto(p.jugador1)} vs ${nombreCompleto(p.jugador2)}`,
        detalle: `Partido ${p.estado}`,
        fecha: p.created_at,
      });
    }
    for (const s of recientesRes.s?.data || []) {
      eventos.push({
        tipo: 'solicitud',
        texto: `${nombreCompleto(s.solicitante)} invitó a ${nombreCompleto(s.receptor)}`,
        detalle: `Solicitud ${s.estado}`,
        fecha: s.created_at,
      });
    }
    for (const r of recientesRes.r?.data || []) {
      eventos.push({
        tipo: 'resena',
        texto: `${nombreCompleto(r.autor)} calificó con ${'★'.repeat(r.calificacion)}`,
        detalle: r.calificacion >= 4 ? 'Muy buena valoración' : 'Valoración recibida',
        fecha: r.created_at,
      });
    }
    for (const m of recientesRes.m?.data || []) {
      const contenido =
        (m.contenido || '').replace(/\s+/g, ' ').trim().slice(0, 80) || '...';
      eventos.push({
        tipo: 'mensaje',
        texto: `${nombreCompleto(m.remitente)}: "${contenido}"`,
        detalle: 'Nuevo mensaje',
        fecha: m.created_at,
      });
    }
    // Registros recientes: la fecha de creación viene de auth.users.
    const recientesRegistros = authUsuarios
      .filter((u) => fechasRegistro.has(u.id))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 6);
    for (const u of recientesRegistros) {
      eventos.push({
        tipo: 'registro',
        texto: `${nombres.get(u.id) || 'Un jugador'} se unió a MeetTennis`,
        detalle: 'Nuevo jugador',
        fecha: u.created_at,
      });
    }
  }

  eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  // --- Respuesta ------------------------------------------------------
  const fechaGeneracion = new Date().toISOString();
  const uptimeSegundos = process.uptime();
  const tecnico = resumenTecnico();
  const senal = calcularSenal(
    { estado: 'ok', baseDeDatos: errores.length === 0 ? 'ok' : 'con_errores' },
    tecnico,
  );

  return res.status(200).json({
    success: true,
    data: {
      generadoEn: fechaGeneracion,
      duracionMs: Date.now() - inicio,
      salud: {
        estado: 'ok',
        uptimeSegundos: Math.floor(uptimeSegundos),
        inicio: new Date(Date.now() - uptimeSegundos * 1000).toISOString(),
        node: process.version,
        baseDeDatos: errores.length === 0 ? 'ok' : 'con_errores',
      },
      errores: errores.length > 0 ? errores : null,
      conteos: {
        usuarios: usuarios.length,
        canchas: canchasRes.count || 0,
        disponibilidad: disponibilidadRes.count || 0,
        partidos: partidos.length,
        solicitudes: solicitudes.length,
        resenas: resenas.length,
        productos: productos.length,
        conversaciones: conversacionesRes.count || 0,
        mensajes: mensajesRes.count || 0,
      },
      usuarios: {
        nuevos7,
        nuevos30,
        porCategoria,
        porComuna,
        registrosPorDia: serieUltimos7(fechasAlta),
      },
      partidos: {
        total: partidos.length,
        porEstado: partidosPorEstado,
        porDia: partidosPorDia,
      },
      solicitudes: {
        total: solicitudes.length,
        porEstado: solicitudesPorEstado,
        porDia: solicitudesPorDia,
      },
      resenas: {
        total: resenas.length,
        promedio: promedioResenas,
        porEstrella,
      },
      productos: {
        total: productos.length,
        porCategoria: productosPorCategoria,
      },
      estadisticasApp: {
        jugadoresActivos,
        canchasTop,
        partidosPendientes,
      },
      tecnico,
      senal,
      actividadReciente: eventos.slice(0, 12),
    },
    error: null,
  });
});

export default router;
