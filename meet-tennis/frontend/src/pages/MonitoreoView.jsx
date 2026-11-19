import LanguageSelector from '../components/LanguageSelector.jsx';
import { getLocale, useLanguage } from '../lib/i18n.js';
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

const fmt = { format: (value) => new Intl.NumberFormat(getLocale()).format(value) };

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
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4 shadow-2xl backdrop-blur-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {t(etiqueta)}
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-100">{t(valor)}</p>
          {sub && <p className="mt-1 truncate text-xs text-emerald-300">{t(sub)}</p>}
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
  const { t } = useLanguage();
  return (
    <section
      className={`rounded-2xl border border-slate-700/50 bg-slate-800/60 p-5 shadow-2xl backdrop-blur-md ${className}`}
    >
      <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-300">
        {Icono && <Icono className="h-4 w-4 text-emerald-400" />}
        {t(titulo)}
      </h2>
      {children}
    </section>
  );
}

// Barras horizontales proporcionales. colorDe permite elegir el color de
// cada barra según su clave (p. ej. por estado).
function Barras({ datos, color = 'bg-emerald-500', colorDe, traducir = false }) {
  const { t } = useLanguage();
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
              <span className="truncate text-slate-300">{traducir ? t(etiqueta) : etiqueta}</span>
              <span className="shrink-0 font-bold text-slate-100">{t(fmt.format(d.total || 0))}</span>
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
        <p className="py-4 text-center text-xs text-slate-500">{t("Sin datos todavía.")}</p>
      )}
    </div>
  );
}

// Barras verticales para una serie de 7 días.
function BarrasDiarias({ datos }) {
  const { t } = useLanguage();
  const max = Math.max(1, ...datos.map((d) => d.total || 0));
  return (
    <div className="flex h-44 flex-col">
      <div className="flex flex-1 items-end gap-1.5">
        {datos.map((d) => (
          <div key={d.fecha} className="flex flex-1 flex-col items-center justify-end">
            <span className="mb-1 text-[11px] font-bold text-slate-100">{t(d.total)}</span>
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
            {t(new Date(`${d.fecha}T00:00:00`).toLocaleDateString(getLocale(), { weekday: 'short' }))}
          </span>
        ))}
      </div>
    </div>
  );
}

// Resultados registrados que los rivales aún no confirman. Al confirmarse
// suman puntos al ranking, así que es la "pendiente" más útil de ver.
function PartidosPendientes({ partidos }) {
  const { t } = useLanguage();
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
              {p.jugador1}{t(" vs ")}{p.jugador2}
            </p>
            <p className="text-[10px] text-slate-500">{t("Jugado el ")}{t(new Date(`${p.fecha}T00:00:00`).toLocaleDateString(getLocale()))} ·{' '}
              {t(hace(p.creadoEn))}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">{t("pendiente")}</span>
        </div>
      ))}
      {partidos.length === 0 && (
        <p className="py-6 text-center text-xs text-slate-500">{t("Todo confirmado: no hay resultados pendientes.")}</p>
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
  const { t } = useLanguage();
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
              <p className="truncate text-sm text-slate-100">{ev.tipo === 'mensaje' ? ev.texto : t(ev.texto)}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                <span className="text-emerald-300">{t(ev.detalle)}</span>
                <span>·</span>
                <span>{t(hace(ev.fecha))}</span>
              </p>
            </div>
          </div>
        );
      })}
      {eventos.length === 0 && (
        <p className="py-6 text-center text-xs text-slate-500">{t("Aún no hay actividad en la plataforma.")}</p>
      )}
    </div>
  );
}

function MonitoreoView() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [recargar, setRecargar] = useState(0);

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

    cargar();
    const intervalo = setInterval(cargar, 30000);

    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [recargar]);

  if (cargando && !datos) {
    return (
      <div className="relative min-h-dvh overflow-x-hidden bg-slate-900 px-4 py-5">
        <TennisBackground />
      <LanguageSelector className="absolute right-4 top-4 z-20" />
        <div className="relative mx-auto max-w-6xl">
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
              <p className="text-sm">{t("Cargando métricas…")}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !datos) {
    return (
      <div className="relative min-h-dvh overflow-x-hidden bg-slate-900 px-4 py-5">
        <TennisBackground />
      <LanguageSelector className="absolute right-4 top-4 z-20" />
        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <ShieldCheck className="h-10 w-10 text-rose-400" />
            <div>
              <h1 className="text-lg font-bold text-slate-100">{t("No se pudo cargar el panel")}</h1>
              <p className="mt-1 text-sm text-slate-400">{t(error)}</p>
              {error === 'No tienes permisos para ver el panel de monitoreo.' && (
                <p className="mx-auto mt-3 max-w-md text-xs text-slate-500">{t("Este panel es exclusivo de administradores. Pide al administrador del proyecto promocionar tu cuenta con el script")}{' '}
                  <code>{t("backend/scripts/09_admin_rol.sql")}</code>.
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-xl border border-slate-700/50 bg-slate-800/60 px-4 py-2 text-sm font-semibold text-slate-200 shadow-xl backdrop-blur-md transition-colors hover:border-emerald-500/50 hover:text-emerald-300"
              >{t("Volver al inicio")}</button>
              <button
                type="button"
                onClick={() => {
                  setCargando(true);
                  setRecargar((n) => n + 1);
                }}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-xl transition-colors hover:bg-emerald-500"
              >{t("Reintentar")}</button>
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
    <div className="relative min-h-dvh overflow-x-hidden bg-slate-900 px-4 py-5">
      <TennisBackground />

      <div className="relative mx-auto max-w-6xl">
        {/* Encabezado */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/')}
              aria-label={t("Volver al inicio")}
              className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-2.5 text-slate-400 shadow-2xl backdrop-blur-md transition-colors hover:border-emerald-500/50 hover:text-emerald-300"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <BrandLogo className="h-10 sm:h-12" />
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-slate-400 sm:block">{t("Actualización automática cada 30 s")}</span>
              <button
                type="button"
                onClick={() => {
                  setCargando(true);
                  setRecargar((n) => n + 1);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-600/15 px-4 py-2 text-sm font-semibold text-emerald-300 shadow-xl backdrop-blur-md transition-colors hover:bg-emerald-600/25"
              >
                <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />{t("Actualizar")}</button>
            </div>
            <LanguageSelector />
          </div>
        </header>

        <div className="mt-6">
          <h1 className="text-2xl font-bold text-slate-100">{t("Panel de monitoreo")}</h1>
          <p className="mt-1 text-sm text-slate-400">{t("Indicadores en tiempo real de MeetTennis: usuarios, partidos, mensajería y contenido.")}</p>
        </div>

        {/* KPIs */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <TarjetaKpi key={kpi.etiqueta} {...kpi} />
          ))}
        </div>

        {/* Estadísticas de la app */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel titulo={t("Jugadores más activos")} icono={Users}>
            <Barras datos={estadisticasApp.jugadoresActivos || []} color="bg-emerald-400" />
          </Panel>
          <Panel titulo={t("Canchas más usadas")} icono={MapPin}>
            <Barras datos={estadisticasApp.canchasTop || []} color="bg-sky-400" />
          </Panel>
        </div>

        <div className="mt-4">
          <Panel titulo={t("Partidos por confirmar")} icono={Swords}>
            <PartidosPendientes partidos={estadisticasApp.partidosPendientes || []} />
          </Panel>
        </div>

        {/* Tendencias de los últimos 7 días */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Panel titulo={t("Registros de usuarios")} icono={UserPlus}>
            <BarrasDiarias datos={usuarios.registrosPorDia || []} />
          </Panel>
          <Panel titulo={t("Partidos registrados")} icono={Swords}>
            <BarrasDiarias datos={partidos.porDia || []} />
          </Panel>
          <Panel titulo={t("Solicitudes de partido")} icono={Send}>
            <BarrasDiarias datos={solicitudes.porDia || []} />
          </Panel>
        </div>

        {/* Distribuciones */}
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Panel titulo={t("Partidos por estado")} icono={Swords}>
            <Barras
              traducir
              datos={(partidos.porEstado || []).map((p) => ({
                clave: p.clave,
                etiqueta: ETIQUETA_ESTADO[p.clave] || p.clave,
                total: p.total,
              }))}
              colorDe={(clave) => COLOR_ESTADO[clave] || 'bg-emerald-500'}
            />
          </Panel>

          <Panel titulo={t("Solicitudes por estado")} icono={Send}>
            <Barras
              traducir
              datos={(solicitudes.porEstado || []).map((s) => ({
                clave: s.clave,
                etiqueta: ETIQUETA_ESTADO[s.clave] || s.clave,
                total: s.total,
              }))}
              colorDe={(clave) => COLOR_ESTADO[clave] || 'bg-emerald-500'}
            />
          </Panel>

          <Panel titulo={t("Usuarios por categoría")} icono={Users}>
            <Barras traducir datos={usuarios.porCategoria || []} color="bg-lime-400" />
          </Panel>

          <Panel titulo={t("Calificaciones por estrellas")} icono={Star}>
            <Barras
              traducir
              datos={(resenas.porEstrella || []).map((r) => ({
                clave: `${r.estrellas} ${r.estrellas === 1 ? 'estrella' : 'estrellas'}`,
                total: r.total,
              }))}
              color="bg-amber-400"
            />
          </Panel>

          <Panel titulo={t("Productos por categoría")} icono={ShoppingBag}>
            <Barras traducir datos={productos.porCategoria || []} color="bg-violet-400" />
          </Panel>

          <Panel titulo={t("Usuarios por comuna")} icono={MapPin}>
            <Barras datos={usuarios.porComuna || []} color="bg-rose-400" />
          </Panel>
        </div>

        {/* Actividad reciente */}
        <div className="mt-4">
          <Panel titulo={t("Actividad reciente")} icono={Activity}>
            <ActividadReciente eventos={actividadReciente} />
          </Panel>
        </div>

        <footer className="mt-8 pb-4 text-center text-[11px] text-slate-500">{t("MeetTennis · Panel de monitoreo de la app")}{generadoEn ? t(" · Actualizado {0}", { 0: t(new Date(generadoEn).toLocaleString(getLocale())) }) : ''}
        </footer>
      </div>
    </div>
  );
}

export default MonitoreoView;
