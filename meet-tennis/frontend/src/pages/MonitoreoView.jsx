import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  CalendarClock,
  MapPin,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldCheck,
  ShoppingBag,
  Star,
  Swords,
  UserPlus,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import TennisBackground from '../components/TennisBackground.jsx';
import { apiFetch } from '../lib/api.js';

const fmt = new Intl.NumberFormat('es-CL');

// Color de cada estado en barras y etiquetas.
const COLOR_ESTADO = {
  pendiente: 'bg-amber-400',
  aceptada: 'bg-emerald-400',
  confirmado: 'bg-emerald-400',
  rechazada: 'bg-rose-400',
  rechazado: 'bg-rose-400',
  cancelada: 'bg-slate-400',
};

const ETIQUETA_ESTADO = {
  pendiente: 'Pendiente',
  aceptada: 'Aceptada',
  confirmado: 'Confirmado',
  rechazada: 'Rechazada',
  rechazado: 'Rechazado',
  cancelada: 'Cancelada',
};

function hace(fechaIso) {
  if (!fechaIso) return '';
  const segundos = Math.floor((Date.now() - new Date(fechaIso).getTime()) / 1000);
  if (segundos < 60) return 'hace un momento';
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} d`;
}

// Tarjeta resumen (KPI) con ícono, valor y subtítulo.
function TarjetaKpi({ etiqueta, valor, icono: Icono, sub, color = 'from-emerald-500/25 to-lime-400/10 text-emerald-300' }) {
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4 shadow-2xl backdrop-blur-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {etiqueta}
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-100">{valor}</p>
          {sub && <p className="mt-1 truncate text-xs text-emerald-300">{sub}</p>}
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${color}`}>
          <Icono className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

// Tarjeta genérica con título e ícono.
function Panel({ titulo, icono: Icono, children, className = '' }) {
  return (
    <section
      className={`rounded-2xl border border-slate-700/50 bg-slate-800/60 p-5 shadow-2xl backdrop-blur-md ${className}`}
    >
      <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-300">
        {Icono && <Icono className="h-4 w-4 text-emerald-400" />}
        {titulo}
      </h2>
      {children}
    </section>
  );
}

// Barras horizontales proporcionales. colorDe permite elegir el color de
// cada barra según su clave (p. ej. por estado).
function Barras({ datos, color = 'bg-emerald-500', colorDe }) {
  const max = Math.max(1, ...datos.map((d) => d.total || 0));
  return (
    <div className="flex flex-col gap-3">
      {datos.map((d) => {
        const pct = max > 0 ? Math.max(4, Math.round(((d.total || 0) / max) * 100)) : 0;
        const etiqueta = d.etiqueta || d.clave;
        const claseBarra = colorDe ? colorDe(d.clave) : color;
        return (
          <div key={d.clave}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-slate-300">{etiqueta}</span>
              <span className="shrink-0 font-bold text-slate-100">{fmt.format(d.total || 0)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-900/70">
              <div
                className={`h-full rounded-full ${claseBarra} transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
      {datos.length === 0 && (
        <p className="py-4 text-center text-xs text-slate-500">Sin datos todavía.</p>
      )}
    </div>
  );
}

// Barras verticales para una serie de 7 días.
function BarrasDiarias({ datos }) {
  const max = Math.max(1, ...datos.map((d) => d.total || 0));
  return (
    <div className="flex h-44 flex-col">
      <div className="flex flex-1 items-end gap-1.5">
        {datos.map((d) => (
          <div key={d.fecha} className="flex flex-1 flex-col items-center justify-end">
            <span className="mb-1 text-[11px] font-bold text-slate-100">{d.total}</span>
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-emerald-600 to-lime-400 transition-all duration-500"
              style={{
                height: d.total > 0 ? `${Math.max(8, (d.total / max) * 100)}%` : '3px',
                opacity: d.total > 0 ? 1 : 0.35,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        {datos.map((d) => (
          <span key={d.fecha} className="flex-1 text-center text-[10px] text-slate-400">
            {new Date(`${d.fecha}T00:00:00`).toLocaleDateString('es-CL', { weekday: 'short' })}
          </span>
        ))}
      </div>
    </div>
  );
}

// Resultados registrados que los rivales aún no confirman. Al confirmarse
// suman puntos al ranking, así que es la "pendiente" más útil de ver.
function PartidosPendientes({ partidos }) {
  return (
    <div className="flex flex-col gap-2.5">
      {partidos.map((p, i) => (
        <div
          key={`${p.jugador1}-${p.jugador2}-${i}`}
          className="flex items-center gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
            <Swords className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-100">
              {p.jugador1} vs {p.jugador2}
            </p>
            <p className="text-[10px] text-slate-500">
              Jugado el {new Date(`${p.fecha}T00:00:00`).toLocaleDateString('es-CL')} ·{' '}
              {hace(p.creadoEn)}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
            pendiente
          </span>
        </div>
      ))}
      {partidos.length === 0 && (
        <p className="py-6 text-center text-xs text-slate-500">
          Todo confirmado: no hay resultados pendientes.
        </p>
      )}
    </div>
  );
}

// Feed de actividad reciente.
const ACTIVIDAD_ESTILO = {
  partido: { Icono: Swords, color: 'text-emerald-300 bg-emerald-500/15' },
  solicitud: { Icono: Send, color: 'text-sky-300 bg-sky-500/15' },
  resena: { Icono: Star, color: 'text-amber-300 bg-amber-500/15' },
  mensaje: { Icono: MessageSquare, color: 'text-violet-300 bg-violet-500/15' },
  registro: { Icono: UserPlus, color: 'text-lime-300 bg-lime-500/15' },
};

function ActividadReciente({ eventos }) {
  return (
    <div className="flex flex-col gap-2.5">
      {eventos.map((ev, i) => {
        const estilo = ACTIVIDAD_ESTILO[ev.tipo] || ACTIVIDAD_ESTILO.registro;
        return (
          <div key={`${ev.tipo}-${i}-${ev.fecha}`} className="flex items-start gap-3">
            <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${estilo.color}`}>
              <estilo.Icono className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-slate-100">{ev.texto}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                <span className="text-emerald-300">{ev.detalle}</span>
                <span>·</span>
                <span>{hace(ev.fecha)}</span>
              </p>
            </div>
          </div>
        );
      })}
      {eventos.length === 0 && (
        <p className="py-6 text-center text-xs text-slate-500">
          Aún no hay actividad en la plataforma.
        </p>
      )}
    </div>
  );
}

// Formato corto de una fecha ISO a "12 mar 2026" (o '—' si no hay).
function fechaCorta(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Tabla de administración de usuarios: lista, rol y acciones.
function AdminUsuarios({ usuarios, yoId, cargando, error, onCambiarRol }) {
  if (cargando && usuarios.length === 0) {
    return <p className="py-6 text-center text-xs text-slate-500">Cargando usuarios…</p>;
  }

  return (
    <div className="overflow-x-auto">
      {error && (
        <p className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          {error}
        </p>
      )}

      <div className="min-w-[640px]">
        {/* Encabezado */}
        <div className="grid grid-cols-[minmax(0,2fr)_0.8fr_0.9fr_0.9fr_0.6fr_auto] gap-2 border-b border-slate-700/50 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <span>Jugador</span>
          <span>Comuna</span>
          <span>Categoría</span>
          <span>Registrado</span>
          <span>Rol</span>
          <span>Acción</span>
        </div>

        {/* Filas */}
        <div className="flex flex-col divide-y divide-slate-700/40">
          {usuarios.map((u) => (
            <div
              key={u.id}
              className="grid grid-cols-[minmax(0,2fr)_0.8fr_0.9fr_0.9fr_0.6fr_auto] items-center gap-2 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-100">
                  {u.nombre} {u.apellido}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {u.email || (
                    <span className="text-amber-400/80">(sin cuenta de acceso)</span>
                  )}
                </p>
              </div>
              <span className="truncate text-xs text-slate-300">{u.comuna || '—'}</span>
              <span className="truncate text-xs text-slate-300">{u.nivel}</span>
              <span className="truncate text-xs text-slate-300">{fechaCorta(u.registrado)}</span>
              <span>
                {u.rol === 'admin' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    <ShieldCheck className="h-3 w-3" /> admin
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                    jugador
                  </span>
                )}
              </span>
              <span>
                {u.id === yoId ? (
                  <span className="text-[11px] text-slate-500">Eres tú</span>
                ) : u.rol === 'admin' ? (
                  <button
                    type="button"
                    onClick={() => onCambiarRol(u.id, 'jugador')}
                    className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 transition-colors hover:bg-rose-500/20"
                  >
                    Quitar admin
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onCambiarRol(u.id, 'admin')}
                    className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
                  >
                    Hacer admin
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>

        {usuarios.length === 0 && (
          <p className="py-6 text-center text-xs text-slate-500">No hay usuarios registrados.</p>
        )}
      </div>
    </div>
  );
}

function MonitoreoView() {
  const navigate = useNavigate();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [recargar, setRecargar] = useState(0);

  // Lista de usuarios para la administración (solo admin).
  const [usuariosAdmin, setUsuariosAdmin] = useState([]);
  const [yoId, setYoId] = useState(null);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(true);
  const [errorAdmin, setErrorAdmin] = useState(null);

  // Consulta las métricas al montar, con polling ligero (30 s) y a
  // petición cuando se pulsa el botón "Actualizar" (recargar cambia).
  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      try {
        const response = await apiFetch('/api/monitoring');
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'No se pudo cargar el monitoreo.');
        }
        if (activo) {
          setDatos(result.data);
          setError(null);
        }
      } catch (err) {
        if (activo) {
          setError(err.message || 'No se pudo conectar con el servidor.');
        }
      } finally {
        if (activo) setCargando(false);
      }
    };

    // Lista de usuarios para administrar (se refresca al recargar).
    const cargarUsuarios = async () => {
      try {
        const response = await apiFetch('/api/monitoring/usuarios');
        const result = await response.json();
        if (response.ok && result.success) {
          if (activo) {
            setUsuariosAdmin(result.data?.usuarios || []);
            setYoId(result.data?.yoId || null);
            setErrorAdmin(null);
          }
        } else if (activo) {
          setErrorAdmin(result.error || 'No se pudo cargar la lista de usuarios.');
        }
      } catch (err) {
        if (activo) setErrorAdmin(err.message || 'Sin conexión con el servidor.');
      } finally {
        if (activo) setCargandoUsuarios(false);
      }
    };

    cargar();
    cargarUsuarios();
    const intervalo = setInterval(cargar, 30000);

    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [recargar]);

  // Promueve o revoca el rol admin de un usuario.
  const cambiarRol = async (id, rol) => {
    try {
      const response = await apiFetch(`/api/monitoring/usuarios/${id}/rol`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'No se pudo cambiar el rol.');
      }
      setUsuariosAdmin((prev) =>
        prev
          .map((u) => (u.id === id ? { ...u, rol } : u))
          .sort((a, b) => {
            if (a.rol !== b.rol) return a.rol === 'admin' ? -1 : 1;
            return `${a.nombre} ${a.apellido}`.localeCompare(
              `${b.nombre} ${b.apellido}`,
              'es',
            );
          }),
      );
      setErrorAdmin(null);
    } catch (err) {
      setErrorAdmin(err.message || 'No se pudo cambiar el rol.');
    }
  };

  if (cargando && !datos) {
    return (
      <div className="relative min-h-screen overflow-x-hidden bg-slate-900 px-4 py-5">
        <TennisBackground />
        <div className="relative mx-auto max-w-6xl">
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
              <p className="text-sm">Cargando métricas…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !datos) {
    return (
      <div className="relative min-h-screen overflow-x-hidden bg-slate-900 px-4 py-5">
        <TennisBackground />
        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <ShieldCheck className="h-10 w-10 text-rose-400" />
            <div>
              <h1 className="text-lg font-bold text-slate-100">No se pudo cargar el panel</h1>
              <p className="mt-1 text-sm text-slate-400">{error}</p>
              {error === 'No tienes permisos para ver el panel de monitoreo.' && (
                <p className="mx-auto mt-3 max-w-md text-xs text-slate-500">
                  Este panel es exclusivo de administradores. Pide al administrador del
                  proyecto promocionar tu cuenta con el script{' '}
                  <code>backend/scripts/09_admin_rol.sql</code>.
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-xl border border-slate-700/50 bg-slate-800/60 px-4 py-2 text-sm font-semibold text-slate-200 shadow-xl backdrop-blur-md transition-colors hover:border-emerald-500/50 hover:text-emerald-300"
              >
                Volver al inicio
              </button>
              <button
                type="button"
                onClick={() => {
                  setCargando(true);
                  setRecargar((n) => n + 1);
                }}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-xl transition-colors hover:bg-emerald-500"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { conteos = {}, usuarios = {}, partidos = {}, solicitudes = {}, resenas = {}, productos = {}, actividadReciente = [], estadisticasApp = {}, generadoEn } =
    datos || {};

  const partidosConfirmados =
    partidos.porEstado?.find((p) => p.clave === 'confirmado')?.total || 0;
  const solicitudesPendientes =
    solicitudes.porEstado?.find((s) => s.clave === 'pendiente')?.total || 0;

  const kpis = [
    {
      etiqueta: 'Usuarios',
      valor: fmt.format(conteos.usuarios || 0),
      icono: Users,
      sub:
        usuarios.nuevos7 != null
          ? `+${fmt.format(usuarios.nuevos7)} en 7 días · +${fmt.format(usuarios.nuevos30 ?? 0)} en 30`
          : null,
      color: 'from-emerald-500/25 to-lime-400/10 text-emerald-300',
    },
    {
      etiqueta: 'Partidos',
      valor: fmt.format(conteos.partidos || 0),
      icono: Swords,
      sub: `${fmt.format(partidosConfirmados)} confirmados`,
      color: 'from-amber-500/25 to-orange-400/10 text-amber-300',
    },
    {
      etiqueta: 'Solicitudes',
      valor: fmt.format(conteos.solicitudes || 0),
      icono: Send,
      sub: `${fmt.format(solicitudesPendientes)} pendientes`,
      color: 'from-sky-500/25 to-cyan-400/10 text-sky-300',
    },
    {
      etiqueta: 'Canchas',
      valor: fmt.format(conteos.canchas || 0),
      icono: MapPin,
      sub: `${fmt.format(conteos.disponibilidad || 0)} bloques de disponibilidad`,
      color: 'from-rose-500/25 to-pink-400/10 text-rose-300',
    },
    {
      etiqueta: 'Conversaciones',
      valor: fmt.format(conteos.conversaciones || 0),
      icono: MessageCircle,
      sub: `${fmt.format(conteos.mensajes || 0)} mensajes enviados`,
      color: 'from-violet-500/25 to-purple-400/10 text-violet-300',
    },
    {
      etiqueta: 'Reseñas',
      valor: fmt.format(conteos.resenas || 0),
      icono: Star,
      sub:
        resenas.promedio != null
          ? `Promedio ${resenas.promedio} de 5`
          : 'Sin calificaciones',
      color: 'from-amber-500/25 to-yellow-400/10 text-amber-300',
    },
    {
      etiqueta: 'Productos',
      valor: fmt.format(conteos.productos || 0),
      icono: ShoppingBag,
      sub: `${fmt.format(productos.porCategoria?.length || 0)} categorías en el catálogo`,
      color: 'from-lime-500/25 to-green-400/10 text-lime-300',
    },
    {
      etiqueta: 'Disponibilidad',
      valor: fmt.format(conteos.disponibilidad || 0),
      icono: CalendarClock,
      sub: 'Bloques horarios publicados',
      color: 'from-cyan-500/25 to-teal-400/10 text-cyan-300',
    },
  ];

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-900 px-4 py-5">
      <TennisBackground />

      <div className="relative mx-auto max-w-6xl">
        {/* Encabezado */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/')}
              aria-label="Volver al inicio"
              className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-2.5 text-slate-400 shadow-2xl backdrop-blur-md transition-colors hover:border-emerald-500/50 hover:text-emerald-300"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <BrandLogo className="h-10 sm:h-12" />
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-400 sm:block">
              Actualización automática cada 30 s
            </span>
            <button
              type="button"
              onClick={() => {
                setCargando(true);
                setRecargar((n) => n + 1);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-600/15 px-4 py-2 text-sm font-semibold text-emerald-300 shadow-xl backdrop-blur-md transition-colors hover:bg-emerald-600/25"
            >
              <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </header>

        <div className="mt-6">
          <h1 className="text-2xl font-bold text-slate-100">Panel de monitoreo</h1>
          <p className="mt-1 text-sm text-slate-400">
            Indicadores en tiempo real de MeetTennis: usuarios, partidos, mensajería y contenido.
          </p>
        </div>

        {/* KPIs */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <TarjetaKpi key={kpi.etiqueta} {...kpi} />
          ))}
        </div>

        {/* Estadísticas de la app */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel titulo="Jugadores más activos" icono={Users}>
            <Barras datos={estadisticasApp.jugadoresActivos || []} color="bg-emerald-400" />
          </Panel>
          <Panel titulo="Canchas más usadas" icono={MapPin}>
            <Barras datos={estadisticasApp.canchasTop || []} color="bg-sky-400" />
          </Panel>
        </div>

        <div className="mt-4">
          <Panel titulo="Partidos por confirmar" icono={Swords}>
            <PartidosPendientes partidos={estadisticasApp.partidosPendientes || []} />
          </Panel>
        </div>

        {/* Administración de usuarios */}
        <div className="mt-4">
          <Panel titulo="Administración de usuarios" icono={ShieldCheck}>
            <AdminUsuarios
              usuarios={usuariosAdmin}
              yoId={yoId}
              cargando={cargandoUsuarios}
              error={errorAdmin}
              onCambiarRol={cambiarRol}
            />
          </Panel>
        </div>

        {/* Tendencias de los últimos 7 días */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Panel titulo="Registros de usuarios" icono={UserPlus}>
            <BarrasDiarias datos={usuarios.registrosPorDia || []} />
          </Panel>
          <Panel titulo="Partidos registrados" icono={Swords}>
            <BarrasDiarias datos={partidos.porDia || []} />
          </Panel>
          <Panel titulo="Solicitudes de partido" icono={Send}>
            <BarrasDiarias datos={solicitudes.porDia || []} />
          </Panel>
        </div>

        {/* Distribuciones */}
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Panel titulo="Partidos por estado" icono={Swords}>
            <Barras
              datos={(partidos.porEstado || []).map((p) => ({
                clave: p.clave,
                etiqueta: ETIQUETA_ESTADO[p.clave] || p.clave,
                total: p.total,
              }))}
              colorDe={(clave) => COLOR_ESTADO[clave] || 'bg-emerald-500'}
            />
          </Panel>

          <Panel titulo="Solicitudes por estado" icono={Send}>
            <Barras
              datos={(solicitudes.porEstado || []).map((s) => ({
                clave: s.clave,
                etiqueta: ETIQUETA_ESTADO[s.clave] || s.clave,
                total: s.total,
              }))}
              colorDe={(clave) => COLOR_ESTADO[clave] || 'bg-emerald-500'}
            />
          </Panel>

          <Panel titulo="Usuarios por categoría" icono={Users}>
            <Barras datos={usuarios.porCategoria || []} color="bg-lime-400" />
          </Panel>

          <Panel titulo="Calificaciones por estrellas" icono={Star}>
            <Barras
              datos={(resenas.porEstrella || []).map((r) => ({
                clave: `${r.estrellas} ${r.estrellas === 1 ? 'estrella' : 'estrellas'}`,
                total: r.total,
              }))}
              color="bg-amber-400"
            />
          </Panel>

          <Panel titulo="Productos por categoría" icono={ShoppingBag}>
            <Barras datos={productos.porCategoria || []} color="bg-violet-400" />
          </Panel>

          <Panel titulo="Usuarios por comuna" icono={MapPin}>
            <Barras datos={usuarios.porComuna || []} color="bg-rose-400" />
          </Panel>
        </div>

        {/* Actividad reciente */}
        <div className="mt-4">
          <Panel titulo="Actividad reciente" icono={Activity}>
            <ActividadReciente eventos={actividadReciente} />
          </Panel>
        </div>

        <footer className="mt-8 pb-4 text-center text-[11px] text-slate-500">
          MeetTennis · Panel de monitoreo de la app
          {generadoEn ? ` · Actualizado ${new Date(generadoEn).toLocaleString('es-CL')}` : ''}
        </footer>
      </div>
    </div>
  );
}

export default MonitoreoView;
