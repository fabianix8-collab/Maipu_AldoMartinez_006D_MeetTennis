import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Loader2,
  MapPin,
  MessageSquare,
  Navigation,
  Plus,
  Send,
  Star,
  Swords,
  Trophy,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import TennisBackground from '../components/TennisBackground.jsx';
import MapEmbed from '../components/MapEmbed.jsx';
import { apiFetch } from '../lib/api.js';
import { formatFecha, haceCuanto, hoyISO, iniciales } from '../lib/formato.js';

const CATEGORIAS = [
  '1ra Categoría',
  '2da Categoría',
  '3ra Categoría',
  '4ta Categoría',
  '5ta Categoría',
];

const MODALIDADES = ['Todas', 'Disponible para jugar', 'Buscando partido'];

const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const MENSAJE_MAX = 300;

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

const ESTILO_ESTADO = {
  pendiente: 'border border-amber-500/40 bg-amber-500/10 text-amber-300',
  aceptada: 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  rechazada: 'border border-red-500/40 bg-red-500/10 text-red-300',
  cancelada: 'border border-slate-600/50 bg-slate-800/70 text-slate-400',
};

// La API guarda los días como números: 1 = Lunes ... 7 = Domingo.
function nombresDias(dias) {
  return (dias || []).map((numero) => DIAS_CORTOS[numero - 1]).filter(Boolean);
}

function formatZona(slot) {
  if (slot.cancha?.nombre) return `Cancha: ${slot.cancha.nombre}`;
  if (slot.comuna) return `Zona: ${slot.comuna}`;
  return '';
}

// En una solicitud aceptada: si el partido ya se jugó, lleva a registrar
// el resultado con rival, fecha y cancha precargados.
function RegistrarResultado({ solicitud, rivalId }) {
  if (solicitud.fecha > hoyISO()) {
    return (
      <p className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 py-2 text-xs font-semibold text-emerald-300">
        <Calendar className="h-3.5 w-3.5" />
        Partido programado para el {formatFecha(solicitud.fecha)}
      </p>
    );
  }

  const params = new URLSearchParams({ rival: rivalId, fecha: solicitud.fecha });
  if (solicitud.cancha?.id) params.set('cancha', String(solicitud.cancha.id));

  return (
    <Link
      to={`/mis-partidos?${params.toString()}`}
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-emerald-700"
    >
      <ClipboardCheck className="h-4 w-4" />
      Registrar resultado
    </Link>
  );
}

// Asistencia a un partido aceptado que aún no se juega: muestra quién
// confirmó y permite confirmar o avisar que no se puede ir.
function Asistencia({ solicitud, soySolicitante, onResponder }) {
  const [seguro, setSeguro] = useState(false);

  if (solicitud.fecha < hoyISO()) return null;

  const mia = soySolicitante ? solicitud.asiste_solicitante : solicitud.asiste_receptor;
  const suya = soySolicitante ? solicitud.asiste_receptor : solicitud.asiste_solicitante;
  const estado = (valor) =>
    valor ? (
      <span className="font-semibold text-emerald-300">confirmó</span>
    ) : (
      <span className="text-slate-500">sin confirmar</span>
    );

  return (
    <div className="mt-3 rounded-xl border border-slate-700/50 bg-slate-900/40 p-3 text-xs">
      <p className="text-slate-400">
        Tú: {estado(mia)} · Rival: {estado(suya)}
      </p>

      {seguro ? (
        <div className="mt-2">
          <p className="text-red-300">Se cancelará el partido y avisaremos a tu rival.</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onResponder(solicitud.id, false)}
              className="rounded-lg bg-red-600 py-2 font-semibold text-slate-100 transition-colors hover:bg-red-700"
            >
              Sí, cancelar
            </button>
            <button
              type="button"
              onClick={() => setSeguro(false)}
              className="rounded-lg border border-slate-700/50 bg-slate-800/70 py-2 font-semibold text-slate-300 transition-colors hover:text-slate-100"
            >
              Volver
            </button>
          </div>
        </div>
      ) : (
        <div className={`mt-2 grid gap-2 ${mia ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {!mia && (
            <button
              type="button"
              onClick={() => onResponder(solicitud.id, true)}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 font-semibold text-slate-100 transition-colors hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Confirmo
            </button>
          )}
          <button
            type="button"
            onClick={() => setSeguro(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 py-2 font-semibold text-red-300 transition-colors hover:bg-red-500/20"
          >
            <XCircle className="h-3.5 w-3.5" />
            {mia ? 'Ya no puedo ir' : 'No puedo'}
          </button>
        </div>
      )}
    </div>
  );
}

// Nota en una solicitud cancelada porque alguien avisó que no podía ir.
function CanceladaPorAsistencia({ solicitud, soySolicitante }) {
  const yo = soySolicitante ? solicitud.asiste_solicitante : solicitud.asiste_receptor;
  const rival = soySolicitante ? solicitud.asiste_receptor : solicitud.asiste_solicitante;
  if (yo !== false && rival !== false) return null;

  return (
    <p className="mt-3 text-xs text-slate-400">
      {yo === false
        ? 'Avisaste que no podías asistir.'
        : 'Tu rival avisó que no podía asistir.'}
    </p>
  );
}

function MatchmakingView() {
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

  // Rivales con el mapa de la cancha recomendada abierto (por id de rival).
  const [mapaAbierto, setMapaAbierto] = useState({});

  // Perfil de un rival abierto en modal (foto clickeable).
  const [perfilAbierto, setPerfilAbierto] = useState(null);
  const [perfilDatos, setPerfilDatos] = useState(null);
  const [perfilResenas, setPerfilResenas] = useState(null);
  const [perfilCargando, setPerfilCargando] = useState(false);
  const [perfilError, setPerfilError] = useState('');

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
  const [errorSolicitudes, setErrorSolicitudes] = useState('');
  const [recargarSolicitudes, setRecargarSolicitudes] = useState(0);

  // Carga inicial: disponibilidad propia y geolocalización opcional.
  // La ubicación solo se usa para calcular la cancha recomendada;
  // no se guarda ni se comparte con otros jugadores.
  useEffect(() => {
    let activo = true;

    const cargarDisponibilidad = async () => {
      try {
        const response = await apiFetch('/api/availability');
        const result = await response.json();

        if (activo && response.ok && result.success && Array.isArray(result.data)) {
          setMiDisponibilidad(result.data);
        }
      } catch {
        // Silencioso: la sección muestra que no hay bloques.
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
  }, []);

  // Rivales: se recarga al cambiar los filtros.
  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      try {
        const params = new URLSearchParams();
        if (filtroNivel) params.set('nivel', filtroNivel);
        if (filtroModalidad && filtroModalidad !== 'Todas') {
          params.set('modalidad', filtroModalidad);
        }

        const response = await apiFetch(`/api/matchmaking/rivals?${params.toString()}`);
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
  }, [filtroNivel, filtroModalidad]);

  // Solicitudes: se recarga al montar y tras enviar/responder.
  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      try {
        const response = await apiFetch('/api/matchmaking/requests');
        const result = await response.json();

        if (!activo) return;

        if (response.ok && result.success) {
          setSolicitudes(result.data || { recibidas: [], enviadas: [] });
        } else {
          setErrorSolicitudes(result.error || 'No se pudieron cargar las solicitudes.');
        }
      } catch {
        if (activo) setErrorSolicitudes('No se pudo conectar con el servidor.');
      }
    };

    cargar();

    return () => {
      activo = false;
    };
  }, [recargarSolicitudes]);

  const verCanchaRecomendada = async (rivalId) => {
    if (cargandoCancha) return;

    setCargandoCancha(rivalId);
    setErrorCancha('');

    try {
      const params = new URLSearchParams({ rivalId });
      if (ubicacion) {
        params.set('lat', String(ubicacion.lat));
        params.set('lng', String(ubicacion.lng));
      }

      const response = await apiFetch(
        `/api/matchmaking/recommend-court?${params.toString()}`,
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
      const response = await apiFetch('/api/matchmaking/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receptor_id: rivalId,
          cancha_id: recomendada?.id ?? null,
          fecha: formSolicitud.fecha,
          hora_desde: formSolicitud.desde,
          hora_hasta: formSolicitud.hasta,
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

  // accion: "aceptar" | "rechazar" (recibidas) o "cancelar" (enviadas).
  const responderSolicitud = async (id, accion) => {
    setErrorSolicitudes('');

    try {
      const response = await apiFetch(`/api/matchmaking/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        setErrorSolicitudes(result.error || 'No se pudo actualizar la solicitud.');
      }
      setRecargarSolicitudes((n) => n + 1);
    } catch {
      setErrorSolicitudes('No se pudo conectar con el servidor.');
    }
  };

  const responderAsistencia = async (id, asiste) => {
    setErrorSolicitudes('');

    try {
      const response = await apiFetch(`/api/matchmaking/requests/${id}/asistencia`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asiste }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        setErrorSolicitudes(result.error || 'No se pudo guardar tu asistencia.');
      }
      setRecargarSolicitudes((n) => n + 1);
    } catch {
      setErrorSolicitudes('No se pudo conectar con el servidor.');
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

  // Abre el modal con el perfil público del rival (foto clickeable),
  // incluyendo su calificación y reseñas anónimas.
  const verPerfil = async (rival) => {
    setPerfilAbierto(rival);
    setPerfilDatos(null);
    setPerfilResenas(null);
    setPerfilError('');
    setPerfilCargando(true);

    try {
      const [perfilRes, resenasRes] = await Promise.all([
        apiFetch(`/api/profile/${rival.id}`),
        apiFetch(`/api/reviews/player/${rival.id}`),
      ]);
      const perfil = await perfilRes.json();
      const resenas = await resenasRes.json();

      if (perfilRes.ok && perfil.success) {
        setPerfilDatos(perfil.data);
      } else {
        setPerfilError(perfil.error || 'No se pudo cargar el perfil.');
      }

      if (resenasRes.ok && resenas.success) {
        setPerfilResenas(resenas.data);
      }
    } catch {
      setPerfilError('No se pudo conectar con el servidor.');
    } finally {
      setPerfilCargando(false);
    }
  };

  const recibidasPendientes = solicitudes.recibidas.filter((s) => s.estado === 'pendiente');
  const recibidasRespondidas = solicitudes.recibidas.filter((s) => s.estado !== 'pendiente');

  // Tarjeta de una solicitud recibida (pendiente o ya respondida).
  const renderRecibida = (solicitud) => (
    <li
      key={solicitud.id}
      className={`rounded-2xl border p-4 shadow-2xl backdrop-blur-md ${
        solicitud.estado === 'pendiente'
          ? 'border-amber-500/40 bg-amber-500/5'
          : 'border-slate-700/50 bg-slate-800/60'
      }`}
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
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTILO_ESTADO[solicitud.estado]}`}
        >
          {solicitud.estado}
        </span>
      </div>

      <div className="mt-3 grid gap-1.5 text-xs text-slate-300">
        {solicitud.fecha && (
          <p className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            {formatFecha(solicitud.fecha)}
            {solicitud.hora_desde &&
              ` · ${solicitud.hora_desde} - ${solicitud.hora_hasta}`}
          </p>
        )}
        {solicitud.cancha?.nombre && (
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-slate-500" />
            {solicitud.cancha?.nombre}
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
            onClick={() => responderSolicitud(solicitud.id, 'aceptar')}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-emerald-700"
          >
            <CheckCircle2 className="h-4 w-4" />
            Aceptar
          </button>
          <button
            type="button"
            onClick={() => responderSolicitud(solicitud.id, 'rechazar')}
            className="flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/20"
          >
            <XCircle className="h-4 w-4" />
            Rechazar
          </button>
        </div>
      )}

      {solicitud.estado === 'aceptada' && (
        <>
          <Asistencia
            solicitud={solicitud}
            soySolicitante={false}
            onResponder={responderAsistencia}
          />
          <RegistrarResultado
            solicitud={solicitud}
            rivalId={solicitud.solicitante_id}
          />
        </>
      )}

      {solicitud.estado === 'cancelada' && (
        <CanceladaPorAsistencia solicitud={solicitud} soySolicitante={false} />
      )}
    </li>
  );

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

        {errorSolicitudes && (
          <p className="mt-6 flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {errorSolicitudes}
          </p>
        )}

        {/* Solicitudes por responder: lo más urgente va primero */}
        {recibidasPendientes.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-amber-300">
              <Bell className="h-4 w-4" />
              Por responder ({recibidasPendientes.length})
            </h2>
            <ul className="grid gap-3">{recibidasPendientes.map(renderRecibida)}</ul>
          </section>
        )}

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
                      <button
                        type="button"
                        onClick={() => verPerfil(rival)}
                        aria-label={`Ver perfil de ${rival.nombre} ${rival.apellido}`}
                        title="Ver perfil"
                        className="relative inline-flex shrink-0 cursor-pointer rounded-full bg-gradient-to-tr from-emerald-500 via-emerald-400 to-lime-300 p-[2px] transition-transform hover:scale-105"
                      >
                        {renderAvatar(rival)}
                      </button>

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
                                {nombresDias(coincidencia.rivalSlot.dias).join(', ')}
                              </span>
                              <span className="text-emerald-300">
                                {coincidencia.rivalSlot.desde} -{' '}
                                {coincidencia.rivalSlot.hasta}
                              </span>
                              {formatZona(coincidencia.rivalSlot) && (
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

                            <button
                              type="button"
                              onClick={() =>
                                setMapaAbierto((prev) => ({
                                  ...prev,
                                  [rival.id]: !prev[rival.id],
                                }))
                              }
                              aria-expanded={mapaAbierto[rival.id] ? 'true' : 'false'}
                              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/70 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-300"
                            >
                              <Navigation className="h-3.5 w-3.5" />
                              {mapaAbierto[rival.id] ? 'Ocultar mapa' : 'Ver en el mapa'}
                            </button>

                            {mapaAbierto[rival.id] && (
                              <MapEmbed
                                latitud={recomendada.recomendada.latitud}
                                longitud={recomendada.recomendada.longitud}
                                titulo={`Mapa de ${recomendada.recomendada.nombre}`}
                                className="mt-3 h-64 w-full rounded-xl border border-slate-700/50"
                              />
                            )}
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
                              maxLength={MENSAJE_MAX}
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

        {/* Solicitudes recibidas ya respondidas */}
        {recibidasRespondidas.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Solicitudes recibidas
            </h2>
            <ul className="grid gap-3">{recibidasRespondidas.map(renderRecibida)}</ul>
          </section>
        )}

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
                          {solicitud.fecha
                            ? formatFecha(solicitud.fecha)
                            : 'Sin fecha'}{' '}
                          {solicitud.hora_desde &&
                            `· ${solicitud.hora_desde} - ${solicitud.hora_hasta}`}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTILO_ESTADO[solicitud.estado]}`}
                    >
                      {solicitud.estado}
                    </span>
                  </div>

                  {solicitud.estado === 'pendiente' && (
                    <button
                      type="button"
                      onClick={() => responderSolicitud(solicitud.id, 'cancelar')}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/70 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-red-500/50 hover:text-red-300"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Cancelar solicitud
                    </button>
                  )}

                  {solicitud.estado === 'aceptada' && (
                    <>
                      <Asistencia
                        solicitud={solicitud}
                        soySolicitante
                        onResponder={responderAsistencia}
                      />
                      <RegistrarResultado
                        solicitud={solicitud}
                        rivalId={solicitud.receptor_id}
                      />
                    </>
                  )}

                  {solicitud.estado === 'cancelada' && (
                    <CanceladaPorAsistencia solicitud={solicitud} soySolicitante />
                  )}
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

      {/* Modal con el perfil público del rival (se abre al tocar su foto) */}
      {perfilAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm"
          onClick={() => setPerfilAbierto(null)}
        >
          <div
            className="relative mx-auto w-full max-w-sm rounded-2xl border border-slate-700/50 bg-slate-900/95 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPerfilAbierto(null)}
              aria-label="Cerrar perfil"
              className="absolute right-3 top-3 rounded-xl border border-slate-700/50 bg-slate-800/60 p-2 text-slate-400 transition-colors hover:border-red-500/50 hover:text-red-400"
            >
              <XCircle className="h-4 w-4" />
            </button>

            {perfilCargando ? (
              <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                Cargando perfil...
              </p>
            ) : perfilError ? (
              <p className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {perfilError}
              </p>
            ) : perfilDatos ? (
              <>
                <div className="flex flex-col items-center gap-3">
                  <span className="relative inline-flex shrink-0 rounded-full bg-gradient-to-tr from-emerald-500 via-emerald-400 to-lime-300 p-[3px] shadow-lg">
                    {perfilDatos.avatar_url ? (
                      <img
                        src={perfilDatos.avatar_url}
                        alt={`Foto de ${perfilDatos.nombre} ${perfilDatos.apellido}`}
                        className="h-24 w-24 rounded-full border-2 border-slate-900 object-cover"
                      />
                    ) : (
                      <span className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-slate-900 bg-slate-800 text-slate-400">
                        <User className="h-10 w-10" />
                      </span>
                    )}
                  </span>
                  <h2 className="text-xl font-bold text-slate-100">
                    {perfilDatos.nombre} {perfilDatos.apellido}
                  </h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                    <Trophy className="h-3.5 w-3.5" />
                    {perfilDatos.nivel || 'Sin nivel'}
                  </span>
                </div>

                <dl className="mt-5 grid gap-3">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Comuna
                    </dt>
                    <dd className="mt-0.5 flex items-center gap-2 text-sm text-slate-100">
                      <MapPin className="h-4 w-4 shrink-0 text-slate-500" />
                      {perfilDatos.comuna || 'No especificada'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Sobre mí
                    </dt>
                    <dd className="mt-0.5 text-sm text-slate-300">
                      {perfilDatos.bio || 'Sin descripción.'}
                    </dd>
                  </div>
                </dl>

                {perfilResenas && (
                  <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Calificación de otros jugadores
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`h-5 w-5 ${
                              n <= Math.round(perfilResenas.promedio || 0)
                                ? 'fill-amber-400 text-amber-400'
                                : 'fill-slate-700 text-slate-600'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-semibold text-slate-100">
                        {perfilResenas.promedio
                          ? `${perfilResenas.promedio} de 5`
                          : 'Sin reseñas'}
                      </span>
                    </div>
                    {perfilResenas.promedio && (
                      <p className="mt-1.5 text-xs text-slate-400">
                        {perfilResenas.promedio >= 4.5
                          ? 'Excelente jugador, muy confiable.'
                          : perfilResenas.promedio >= 3.5
                            ? 'Buen jugador, confiable.'
                            : perfilResenas.promedio >= 2.5
                              ? 'Jugador regular, con opiniones mixtas.'
                              : perfilResenas.promedio >= 1.5
                                ? 'Jugador poco confiable según otros.'
                                : 'Jugador no recomendado según otros.'}
                      </p>
                    )}
                  </div>
                )}

                {perfilResenas && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Reseñas
                    </p>
                    {perfilResenas.recibidas.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Aún no tiene reseñas. Juega con él para conocerlo mejor.
                      </p>
                    ) : (
                      <ul className="mt-2 grid max-h-44 gap-2 overflow-y-auto overscroll-contain pr-1">
                        {perfilResenas.recibidas.map((r) => (
                          <li
                            key={r.id}
                            className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-3"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-slate-400">
                                Jugador anónimo
                              </span>
                              <span className="text-xs text-slate-600">·</span>
                              <span className="text-xs text-slate-500">
                                {haceCuanto(r.created_at)}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <Star
                                  key={n}
                                  className={`h-3 w-3 ${
                                    n <= r.calificacion
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'fill-slate-700 text-slate-600'
                                  }`}
                                />
                              ))}
                            </div>
                            {r.comentario && (
                              <p className="mt-1 text-xs text-slate-300">
                                {r.comentario}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default MatchmakingView;