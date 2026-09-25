import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  MessageSquare,
  Navigation,
  Plus,
  Send,
  Swords,
  Trophy,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import TennisBackground from '../components/TennisBackground.jsx';

const CATEGORIAS = [
  '1ra Categoría',
  '2da Categoría',
  '3ra Categoría',
  '4ta Categoría',
  '5ta Categoría',
];

const MODALIDADES = ['Todas', 'Disponible para jugar', 'Buscando partido'];

// Horas seleccionables (07:00 a 23:00, cada 30 minutos).
const HORAS = (() => {
  const lista = [];
  for (let hora = 7; hora <= 23; hora += 1) {
    lista.push(`${String(hora).padStart(2, '0')}:00`);
    if (hora < 23) lista.push(`${String(hora).padStart(2, '0')}:30`);
  }
  return lista;
})();

const inputBase =
  'w-full rounded-xl border border-slate-700/50 bg-slate-800/70 px-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-emerald-500';
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-400';

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('meettennis_auth') || 'null');
  } catch {
    return null;
  }
}

function getUserId() {
  const stored = getStoredUser();
  return stored?.user?.id || stored?.profile?.id || '';
}

const AVAILABILITY_KEY = 'meettennis_availability';

function getUserKey() {
  return getUserId() || 'invitado';
}

// Lee la copia local de disponibilidad (misma clave que "Mi Disponibilidad").
function loadLocalSlots() {
  try {
    const raw = JSON.parse(localStorage.getItem(AVAILABILITY_KEY) || '{}');
    const slots = raw[getUserKey()];
    return Array.isArray(slots) ? slots : [];
  } catch {
    return [];
  }
}

function formatZona(slot) {
  if (!slot.zona) return '';
  if (slot.tipoZona === 'comuna') return `Zona: ${slot.zona}`;
  if (slot.tipoZona === 'cancha') return `Cancha: ${slot.zona}`;
  return slot.zona;
}

function hoyISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatFecha(fecha) {
  if (!fecha) return 'Sin fecha';
  const [anio, mes, dia] = String(fecha).split('-');
  if (!anio || !mes || !dia) return fecha;
  return `${dia}/${mes}/${anio}`;
}

function iniciales(nombre, apellido) {
  const primera = (nombre || '').trim().charAt(0);
  const segunda = (apellido || '').trim().charAt(0);
  return `${primera}${segunda}`.toUpperCase() || '?';
}

function MatchmakingView() {
  const userId = getUserId();

  const [miDisponibilidad, setMiDisponibilidad] = useState([]);
  const [rivales, setRivales] = useState([]);
  const [loadingRivales, setLoadingRivales] = useState(true);
  const [errorRivales, setErrorRivales] = useState('');

  const [filtroNivel, setFiltroNivel] = useState('');
  const [filtroModalidad, setFiltroModalidad] = useState('');

  const [ubicacion, setUbicacion] = useState(null);
  const [geoStatus, setGeoStatus] = useState('idle');

  const [canchasRecomendadas, setCanchasRecomendadas] = useState({});
  const [cargandoCancha, setCargandoCancha] = useState(null);
  const [errorCancha, setErrorCancha] = useState('');

  const [solicitudAbierta, setSolicitudAbierta] = useState(null);
  const [formSolicitud, setFormSolicitud] = useState({
    fecha: hoyISO(),
    desde: '',
    hasta: '',
    mensaje: '',
  });
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  const [statusSolicitud, setStatusSolicitud] = useState({
    type: 'idle',
    message: '',
  });

  const [solicitudes, setSolicitudes] = useState({ recibidas: [], enviadas: [] });
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(true);
  const [recargarSolicitudes, setRecargarSolicitudes] = useState(0);

  // Carga inicial: disponibilidad propia y geolocalización opcional.
  useEffect(() => {
    let activo = true;

    const cargarDisponibilidad = async () => {
      if (!userId) return;

      let datosBackend = null;

      try {
        const response = await fetch(`/api/matches/availability/${userId}`);
        const result = await response.json();

        if (activo && response.ok && result.success && Array.isArray(result.data)) {
          datosBackend = result.data;
        }
      } catch {
        // Silencioso: se usa la copia local como respaldo.
      }

      if (!activo) return;

      if (datosBackend && datosBackend.length > 0) {
        setMiDisponibilidad(datosBackend);
        return;
      }

      // Respaldo: si el backend no responde o no tiene datos, usa la
      // disponibilidad guardada localmente (misma lógica que "Mi Disponibilidad")
      // y reintenta la sincronización para que otros jugadores puedan encontrarte.
      const locales = loadLocalSlots();
      if (locales.length > 0) {
        setMiDisponibilidad(locales);
        fetch('/api/matches/availability', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, slots: locales }),
        }).catch(() => {});
      }
    };

    const solicitarUbicacion = () => {
      if (!('geolocation' in navigator)) return;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!activo) return;
          setUbicacion({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setGeoStatus('success');
        },
        () => {
          if (activo) setGeoStatus('error');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    };

    cargarDisponibilidad();
    solicitarUbicacion();

    return () => {
      activo = false;
    };
  }, [userId]);

  // Rivales: se recarga al cambiar los filtros.
  useEffect(() => {
    if (!userId) return;

    let activo = true;

    const cargar = async () => {
      try {
        const params = new URLSearchParams({ userId });
        if (filtroNivel) params.set('nivel', filtroNivel);
        if (filtroModalidad && filtroModalidad !== 'Todas') {
          params.set('modalidad', filtroModalidad);
        }

        const response = await fetch(`/api/matches/rivals?${params.toString()}`);
        const result = await response.json();

        if (!activo) return;

        if (response.ok && result.success) {
          setRivales(result.data?.rivales || []);
          setErrorRivales('');
        } else {
          setErrorRivales(result.error || 'No se pudieron cargar los rivales.');
        }
      } catch {
        if (activo) setErrorRivales('No se pudo conectar con el servidor.');
      } finally {
        if (activo) setLoadingRivales(false);
      }
    };

    cargar();

    return () => {
      activo = false;
    };
  }, [userId, filtroNivel, filtroModalidad]);

  // Solicitudes: se recarga al montar y tras enviar/responder.
  useEffect(() => {
    if (!userId) return;

    let activo = true;

    const cargar = async () => {
      try {
        const response = await fetch(`/api/matches/requests?userId=${userId}`);
        const result = await response.json();

        if (!activo) return;

        if (response.ok && result.success) {
          setSolicitudes(result.data || { recibidas: [], enviadas: [] });
        }
      } catch {
        // Silencioso: la sección se muestra vacía.
      } finally {
        if (activo) setLoadingSolicitudes(false);
      }
    };

    cargar();

    return () => {
      activo = false;
    };
  }, [userId, recargarSolicitudes]);

  const verCanchaRecomendada = async (rivalId) => {
    if (cargandoCancha) return;

    setCargandoCancha(rivalId);
    setErrorCancha('');

    try {
      const params = new URLSearchParams({ userId, rivalId });
      if (ubicacion) {
        params.set('lat', String(ubicacion.lat));
        params.set('lng', String(ubicacion.lng));
      }

      const response = await fetch(
        `/api/matches/recommend-court?${params.toString()}`,
      );
      const result = await response.json();

      if (response.ok && result.success) {
        setCanchasRecomendadas((prev) => ({ ...prev, [rivalId]: result.data }));
      } else {
        setErrorCancha(result.error || 'No se pudo recomendar una cancha.');
      }
    } catch {
      setErrorCancha('No se pudo conectar con el servidor.');
    } finally {
      setCargandoCancha(null);
    }
  };

  const abrirSolicitud = (rivalId) => {
    setSolicitudAbierta((prev) => (prev === rivalId ? null : rivalId));
    setStatusSolicitud({ type: 'idle', message: '' });
  };

  const enviarSolicitud = async (rivalId) => {
    if (enviandoSolicitud) return;

    if (!formSolicitud.desde || !formSolicitud.hasta) {
      setStatusSolicitud({
        type: 'error',
        message: 'Indica el horario propuesto para el partido.',
      });
      return;
    }

    if (formSolicitud.hasta <= formSolicitud.desde) {
      setStatusSolicitud({
        type: 'error',
        message: 'La hora de término debe ser mayor a la de inicio.',
      });
      return;
    }

    const recomendada = canchasRecomendadas[rivalId]?.recomendada;

    setEnviandoSolicitud(true);
    setStatusSolicitud({ type: 'idle', message: '' });

    try {
      const response = await fetch('/api/matches/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          solicitanteId: userId,
          receptorId: rivalId,
          canchaId: recomendada?.id || null,
          canchaNombre: recomendada?.nombre || null,
          fechaSugerida: formSolicitud.fecha,
          horaDesde: formSolicitud.desde,
          horaHasta: formSolicitud.hasta,
          mensaje: formSolicitud.mensaje.trim() || null,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setStatusSolicitud({
          type: 'success',
          message: 'Solicitud enviada. ¡A esperar la respuesta del rival!',
        });
        setSolicitudAbierta(null);
        setFormSolicitud({
          fecha: hoyISO(),
          desde: '',
          hasta: '',
          mensaje: '',
        });
        setRecargarSolicitudes((n) => n + 1);
      } else {
        setStatusSolicitud({
          type: 'error',
          message: result.error || 'No se pudo enviar la solicitud.',
        });
      }
    } catch {
      setStatusSolicitud({
        type: 'error',
        message: 'No se pudo conectar con el servidor.',
      });
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  const responderSolicitud = async (id, estado) => {
    try {
      const response = await fetch(`/api/matches/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, userId }),
      });

      if (response.ok) {
        setRecargarSolicitudes((n) => n + 1);
      }
    } catch {
      // Silencioso.
    }
  };

  const sinDisponibilidad = miDisponibilidad.length === 0;

  const resumenRivales = useMemo(() => {
    if (loadingRivales) return 'Buscando rivales...';
    if (rivales.length === 0) return 'Sin rivales por ahora';
    return `${rivales.length} ${rivales.length === 1 ? 'rival encontrado' : 'rivales encontrados'}`;
  }, [loadingRivales, rivales.length]);

  const renderAvatar = (rival) => {
    if (rival.avatar_url) {
      return (
        <img
          src={rival.avatar_url}
          alt={`Foto de ${rival.nombre} ${rival.apellido}`}
          className="h-11 w-11 rounded-full border-2 border-slate-900 object-cover"
        />
      );
    }
    return (
      <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-slate-900 bg-slate-800 text-sm font-bold text-emerald-300">
        {iniciales(rival.nombre, rival.apellido)}
      </span>
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900 px-4 py-8">
      <TennisBackground />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col">
        <header className="flex items-start justify-between gap-4">
          <div>
            <BrandLogo className="mb-4 h-16 sm:h-20" />
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600/15 text-emerald-400">
                <Swords className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-2xl font-bold leading-tight text-slate-100">
                  Buscar Partido
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  Encuentra un rival y coordina la cancha
                </p>
              </div>
            </div>
          </div>

          <Link
            to="/"
            aria-label="Volver al inicio"
            className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-2.5 text-slate-400 shadow-2xl backdrop-blur-md transition-colors hover:border-emerald-500/50 hover:text-emerald-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </header>

        {/* Mi disponibilidad */}
        <section className="mt-8 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-400">
                <CalendarClock className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Mi disponibilidad
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  {sinDisponibilidad
                    ? 'Aún no has publicado bloques'
                    : `${miDisponibilidad.length} ${
                        miDisponibilidad.length === 1 ? 'bloque publicado' : 'bloques publicados'
                      }`}
                </p>
              </div>
            </div>

            <Link
              to="/disponibilidad"
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
            >
              <Plus className="h-3.5 w-3.5" />
              Publicar
            </Link>
          </div>

          {sinDisponibilidad && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Publica tu disponibilidad para que el sistema pueda encontrar
              rivales con horarios compatibles.
            </p>
          )}
        </section>

        {/* Filtros */}
        <section className="mt-6 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-md">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            <Users className="h-4 w-4" />
            Filtros de búsqueda
          </h2>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} htmlFor="filtro-nivel">
                Categoría
              </label>
              <select
                id="filtro-nivel"
                name="filtro-nivel"
                value={filtroNivel}
                onChange={(event) => {
                  setFiltroNivel(event.target.value);
                  setLoadingRivales(true);
                }}
                className={`${inputBase} appearance-none`}
              >
                <option value="" className="bg-slate-800 text-slate-100">
                  Todas
                </option>
                {CATEGORIAS.map((categoria) => (
                  <option
                    key={categoria}
                    value={categoria}
                    className="bg-slate-800 text-slate-100"
                  >
                    {categoria}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass} htmlFor="filtro-modalidad">
                Modalidad
              </label>
              <select
                id="filtro-modalidad"
                name="filtro-modalidad"
                value={filtroModalidad}
                onChange={(event) => {
                  setFiltroModalidad(event.target.value);
                  setLoadingRivales(true);
                }}
                className={`${inputBase} appearance-none`}
              >
                {MODALIDADES.map((modalidad) => (
                  <option
                    key={modalidad}
                    value={modalidad}
                    className="bg-slate-800 text-slate-100"
                  >
                    {modalidad}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {geoStatus === 'success' && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-300">
              <Navigation className="h-3.5 w-3.5" />
              Usando tu ubicación para recomendar la cancha más cercana.
            </p>
          )}
        </section>

        {/* Rivales */}
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            {resumenRivales}
          </h2>

          {loadingRivales ? (
            <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/40 p-5 text-center text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando rivales compatibles...
            </p>
          ) : errorRivales ? (
            <p className="flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {errorRivales}
            </p>
          ) : rivales.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/40 p-5 text-center text-sm text-slate-500">
              {sinDisponibilidad
                ? 'Publica tu disponibilidad para encontrar rivales.'
                : 'No hay rivales con disponibilidad publicada. Prueba ampliar los filtros.'}
            </p>
          ) : (
            <ul className="grid gap-4">
              {rivales.map((rival) => {
                const recomendada = canchasRecomendadas[rival.id];
                const cargando = cargandoCancha === rival.id;
                const solicitudAbiertaRival = solicitudAbierta === rival.id;

                return (
                  <li
                    key={rival.id}
                    className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4 shadow-2xl backdrop-blur-md"
                  >
                    <div className="flex items-start gap-3">
                      <span className="relative inline-flex shrink-0 rounded-full bg-gradient-to-tr from-emerald-500 via-emerald-400 to-lime-300 p-[2px]">
                        {renderAvatar(rival)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-slate-100">
                          {rival.nombre} {rival.apellido}
                        </h3>
                        <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                          <Trophy className="h-3 w-3" />
                          {rival.nivel}
                        </span>
                      </div>

                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-600/50 bg-slate-900/60 px-2.5 py-1 text-xs font-semibold text-slate-300">
                        <Clock className="h-3 w-3" />
                        {rival.coincidencias.length === 0
                          ? 'Sin coincidencias'
                          : `${rival.coincidencias.length} ${
                              rival.coincidencias.length === 1
                                ? 'coincidencia'
                                : 'coincidencias'
                            }`}
                      </span>
                    </div>

                    {/* Coincidencias de horario */}
                    <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                        Horarios compatibles
                      </p>
                      {rival.coincidencias.length === 0 ? (
                        <p className="mt-2 text-xs text-slate-400">
                          Sin horarios compatibles por ahora. Puedes proponerle un
                          partido igualmente.
                        </p>
                      ) : (
                        <ul className="mt-2 grid gap-1.5">
                          {rival.coincidencias.slice(0, 3).map((coincidencia, index) => (
                            <li
                              key={`${coincidencia.rivalSlot.id}-${index}`}
                              className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-300"
                            >
                              <span className="font-semibold text-slate-100">
                                {coincidencia.rivalSlot.dias.join(', ')}
                              </span>
                              <span className="text-emerald-300">
                                {coincidencia.rivalSlot.desde} -{' '}
                                {coincidencia.rivalSlot.hasta}
                              </span>
                              {coincidencia.rivalSlot.zona && (
                                <span className="text-slate-500">
                                  · {formatZona(coincidencia.rivalSlot)}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Cancha recomendada */}
                    {recomendada ? (
                      <div className="mt-3 rounded-xl border border-slate-600/50 bg-slate-900/60 p-3">
                        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-400">
                          <MapPin className="h-3.5 w-3.5" />
                          Cancha recomendada
                        </p>

                        {recomendada.recomendada ? (
                          <>
                            <h4 className="mt-2 text-sm font-semibold text-slate-100">
                              {recomendada.recomendada.nombre}
                            </h4>
                            <p className="mt-0.5 text-xs text-slate-400">
                              {recomendada.recomendada.direccion}
                            </p>

                            {recomendada.modo === 'coordenadas' && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1 rounded-full border border-slate-600/50 bg-slate-800/70 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
                                  <Navigation className="h-3 w-3" />
                                  Tú: a{' '}
                                  {recomendada.recomendada.distanciaYo.toFixed(1)} km
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full border border-slate-600/50 bg-slate-800/70 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
                                  <Navigation className="h-3 w-3" />
                                  Rival: a{' '}
                                  {recomendada.recomendada.distanciaRival.toFixed(1)} km
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                                  Viaje total: {recomendada.recomendada.distanciaTotal.toFixed(1)} km
                                </span>
                              </div>
                            )}

                            {recomendada.modo === 'comuna' && (
                              <p className="mt-2 text-xs text-slate-400">
                                Cancha en la comuna compartida:{' '}
                                {recomendada.comunasCompartidas?.join(', ')}
                              </p>
                            )}

                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${recomendada.recomendada.latitud},${recomendada.recomendada.longitud}`}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/70 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-300"
                            >
                              <Navigation className="h-3.5 w-3.5" />
                              Ver en el mapa
                            </a>
                          </>
                        ) : (
                          <p className="mt-2 text-xs text-slate-400">
                            {recomendada.modo === 'sin-ubicacion'
                              ? 'No hay suficiente información de ubicación. Publica tu zona o cancha preferida en tu disponibilidad.'
                              : 'No se encontró una cancha recomendada.'}
                          </p>
                        )}
                      </div>
                    ) : null}

                    {errorCancha && cargandoCancha === rival.id && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        {errorCancha}
                      </p>
                    )}

                    {/* Solicitud */}
                    {solicitudAbiertaRival && (
                      <div className="mt-3 rounded-xl border border-slate-600/50 bg-slate-900/60 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Proponer partido
                        </p>

                        <div className="mt-3">
                          <label className={labelClass} htmlFor={`fecha-${rival.id}`}>
                            Fecha sugerida
                          </label>
                          <div className="relative">
                            <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <input
                              id={`fecha-${rival.id}`}
                              name="fecha"
                              type="date"
                              min={hoyISO()}
                              value={formSolicitud.fecha}
                              onChange={(event) =>
                                setFormSolicitud((prev) => ({
                                  ...prev,
                                  fecha: event.target.value,
                                }))
                              }
                              className={`${inputBase} pl-11`}
                            />
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelClass} htmlFor={`desde-${rival.id}`}>
                              Desde
                            </label>
                            <select
                              id={`desde-${rival.id}`}
                              name="desde"
                              value={formSolicitud.desde}
                              onChange={(event) =>
                                setFormSolicitud((prev) => ({
                                  ...prev,
                                  desde: event.target.value,
                                }))
                              }
                              className={`${inputBase} appearance-none`}
                            >
                              <option value="" className="bg-slate-800 text-slate-100">
                                --:--
                              </option>
                              {HORAS.map((hora) => (
                                <option
                                  key={hora}
                                  value={hora}
                                  className="bg-slate-800 text-slate-100"
                                >
                                  {hora}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className={labelClass} htmlFor={`hasta-${rival.id}`}>
                              Hasta
                            </label>
                            <select
                              id={`hasta-${rival.id}`}
                              name="hasta"
                              value={formSolicitud.hasta}
                              onChange={(event) =>
                                setFormSolicitud((prev) => ({
                                  ...prev,
                                  hasta: event.target.value,
                                }))
                              }
                              className={`${inputBase} appearance-none`}
                            >
                              <option value="" className="bg-slate-800 text-slate-100">
                                --:--
                              </option>
                              {HORAS.map((hora) => (
                                <option
                                  key={hora}
                                  value={hora}
                                  className="bg-slate-800 text-slate-100"
                                >
                                  {hora}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="mt-3">
                          <label className={labelClass} htmlFor={`mensaje-${rival.id}`}>
                            Mensaje (opcional)
                          </label>
                          <div className="relative">
                            <MessageSquare className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                            <textarea
                              id={`mensaje-${rival.id}`}
                              name="mensaje"
                              rows={2}
                              maxLength={200}
                              value={formSolicitud.mensaje}
                              onChange={(event) =>
                                setFormSolicitud((prev) => ({
                                  ...prev,
                                  mensaje: event.target.value,
                                }))
                              }
                              placeholder="Ej: ¿Te acomoda jugar dos sets?"
                              className={`${inputBase} resize-none pl-11`}
                            />
                          </div>
                        </div>

                        {statusSolicitud.type === 'success' && (
                          <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            {statusSolicitud.message}
                          </p>
                        )}
                        {statusSolicitud.type === 'error' && (
                          <p className="mt-3 flex items-center gap-1.5 text-xs text-red-400">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            {statusSolicitud.message}
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={() => enviarSolicitud(rival.id)}
                          disabled={enviandoSolicitud}
                          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {enviandoSolicitud ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4" />
                              Enviar solicitud
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Acciones */}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => verCanchaRecomendada(rival.id)}
                        disabled={cargandoCancha !== null}
                        className="flex items-center justify-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/70 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-emerald-500/50 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {cargando ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MapPin className="h-4 w-4" />
                        )}
                        {recomendada ? 'Ver cancha' : 'Cancha recomendada'}
                      </button>

                      <button
                        type="button"
                        onClick={() => abrirSolicitud(rival.id)}
                        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-emerald-700"
                      >
                        <Send className="h-4 w-4" />
                        {solicitudAbiertaRival ? 'Cerrar' : 'Proponer partido'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Solicitudes recibidas */}
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Solicitudes recibidas
          </h2>

          {loadingSolicitudes ? (
            <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/40 p-5 text-center text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando solicitudes...
            </p>
          ) : solicitudes.recibidas.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/40 p-5 text-center text-sm text-slate-500">
              No tienes solicitudes pendientes.
            </p>
          ) : (
            <ul className="grid gap-3">
              {solicitudes.recibidas.map((solicitud) => (
                <li
                  key={solicitud.id}
                  className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4 shadow-2xl backdrop-blur-md"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-emerald-300">
                      {iniciales(
                        solicitud.solicitante?.nombre,
                        solicitud.solicitante?.apellido,
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-slate-100">
                        {solicitud.solicitante?.nombre}{' '}
                        {solicitud.solicitante?.apellido}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {solicitud.solicitante?.nivel || 'Sin nivel'}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        solicitud.estado === 'pendiente'
                          ? 'border border-amber-500/40 bg-amber-500/10 text-amber-300'
                          : solicitud.estado === 'aceptada'
                            ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                            : 'border border-red-500/40 bg-red-500/10 text-red-300'
                      }`}
                    >
                      {solicitud.estado}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-1.5 text-xs text-slate-300">
                    {solicitud.fecha_sugerida && (
                      <p className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-500" />
                        {formatFecha(solicitud.fecha_sugerida)}
                        {solicitud.hora_desde &&
                          ` · ${solicitud.hora_desde} - ${solicitud.hora_hasta}`}
                      </p>
                    )}
                    {solicitud.cancha_nombre && (
                      <p className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-500" />
                        {solicitud.cancha_nombre}
                      </p>
                    )}
                    {solicitud.mensaje && (
                      <p className="mt-1 rounded-lg bg-slate-900/60 p-2 text-slate-400">
                        “{solicitud.mensaje}”
                      </p>
                    )}
                  </div>

                  {solicitud.estado === 'pendiente' && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => responderSolicitud(solicitud.id, 'aceptada')}
                        className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Aceptar
                      </button>
                      <button
                        type="button"
                        onClick={() => responderSolicitud(solicitud.id, 'rechazada')}
                        className="flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/20"
                      >
                        <XCircle className="h-4 w-4" />
                        Rechazar
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Solicitudes enviadas */}
        {solicitudes.enviadas.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Solicitudes enviadas
            </h2>

            <ul className="grid gap-3">
              {solicitudes.enviadas.map((solicitud) => (
                <li
                  key={solicitud.id}
                  className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4 shadow-2xl backdrop-blur-md"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-emerald-300">
                        {iniciales(
                          solicitud.receptor?.nombre,
                          solicitud.receptor?.apellido,
                        )}
                      </span>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-100">
                          {solicitud.receptor?.nombre}{' '}
                          {solicitud.receptor?.apellido}
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {solicitud.fecha_sugerida
                            ? formatFecha(solicitud.fecha_sugerida)
                            : 'Sin fecha'}{' '}
                          {solicitud.hora_desde &&
                            `· ${solicitud.hora_desde} - ${solicitud.hora_hasta}`}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        solicitud.estado === 'pendiente'
                          ? 'border border-amber-500/40 bg-amber-500/10 text-amber-300'
                          : solicitud.estado === 'aceptada'
                            ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                            : 'border border-red-500/40 bg-red-500/10 text-red-300'
                      }`}
                    >
                      {solicitud.estado}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-auto pt-10 text-center text-xs text-slate-500">
          <User className="mr-1 inline h-3.5 w-3.5" />
          Los rivales se ordenan por la cantidad de horarios compatibles.
        </p>
      </div>
    </div>
  );
}

export default MatchmakingView;