import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Eye,
  History,
  Hourglass,
  Loader2,
  MapPin,
  MessageCircle,
  Plus,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import TennisBackground from '../components/TennisBackground.jsx';
import { apiFetch } from '../lib/api.js';
import {
  formatFecha,
  formatPuntos,
  getStoredAuth,
  hoyISO,
  iniciales,
  nombreCompleto,
} from '../lib/formato.js';

const inputBase =
  'w-full rounded-xl border border-slate-700/50 bg-slate-800/70 px-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-emerald-500';
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-400';
const tarjeta =
  'rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4 shadow-2xl backdrop-blur-md';
const tituloSeccion =
  'mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400';

// Acepta marcadores como "6-4", "6-4 6-3" o "6-4, 3-6, 7-5".
const MARCADOR_REGEX =
  /^\d{1,2}\s*-\s*\d{1,2}(\s*[,/]?\s*\d{1,2}\s*-\s*\d{1,2})*$/;

const CATEGORIA_BASE = '5ta Categoría';

function Avatar({ jugador, size = 'h-10 w-10' }) {
  if (jugador?.avatar_url) {
    return (
      <img
        src={jugador.avatar_url}
        alt={`Foto de ${nombreCompleto(jugador)}`}
        className={`${size} shrink-0 rounded-full border-2 border-slate-900 object-cover`}
      />
    );
  }
  return (
    <span
      className={`${size} flex shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-emerald-300`}
    >
      {iniciales(jugador?.nombre, jugador?.apellido)}
    </span>
  );
}

function Aviso({ status }) {
  if (status.type === 'idle') return null;
  const exito = status.type === 'success';
  return (
    <div
      className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${
        exito
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
          : 'border-red-500/40 bg-red-500/10 text-red-300'
      }`}
    >
      {exito ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      {status.message}
    </div>
  );
}

function ResultadoIcono({ partido }) {
  const gano = partido.resultado === 'Ganado';
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
        gano ? 'bg-emerald-600/20 text-emerald-300' : 'bg-red-500/15 text-red-300'
      }`}
    >
      {gano ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
    </span>
  );
}

function MisPartidosView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const miId = getStoredAuth()?.user?.id;

  const [partidos, setPartidos] = useState([]);
  const [miCategoria, setMiCategoria] = useState(CATEGORIA_BASE);
  const [jugadores, setJugadores] = useState([]);
  const [reglas, setReglas] = useState(null);
  const [canchas, setCanchas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [recargar, setRecargar] = useState(0);

  const [solicitudes, setSolicitudes] = useState({ recibidas: [], enviadas: [] });
  const [errorSolicitudes, setErrorSolicitudes] = useState('');
  const [procesandoSolicitud, setProcesandoSolicitud] = useState(null);

  // Perfil del contrincante abierto en modal.
  const [perfilAbierto, setPerfilAbierto] = useState(null);
  const [perfilDatos, setPerfilDatos] = useState(null);
  const [perfilResenas, setPerfilResenas] = useState(null);
  const [perfilCargando, setPerfilCargando] = useState(false);
  const [perfilError, setPerfilError] = useState('');

  // El formulario se puede precargar desde una solicitud aceptada
  // (Buscar Partido → "Registrar resultado").
  const [rivalId, setRivalId] = useState(searchParams.get('rival') || '');
  const [resultado, setResultado] = useState('Ganado');
  const [marcador, setMarcador] = useState('');
  const [fecha, setFecha] = useState(() => {
    const desdeSolicitud = searchParams.get('fecha');
    return desdeSolicitud && desdeSolicitud <= hoyISO() ? desdeSolicitud : hoyISO();
  });
  const [canchaId, setCanchaId] = useState(searchParams.get('cancha') || '');
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [statusForm, setStatusForm] = useState({ type: 'idle', message: '' });
  const [statusLista, setStatusLista] = useState({ type: 'idle', message: '' });
  const [procesando, setProcesando] = useState(null);

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      try {
        const [partidosRes, rankingRes, canchasRes, solicitudesRes] = await Promise.all([
          apiFetch('/api/matches'),
          apiFetch('/api/ranking'),
          fetch('/api/courts'),
          apiFetch('/api/matchmaking/requests'),
        ]);
        const [partidosData, rankingData, canchasData, solicitudesData] =
          await Promise.all([
            partidosRes.json(),
            rankingRes.json(),
            canchasRes.json(),
            solicitudesRes.json(),
          ]);

        if (!activo) return;

        if (!partidosRes.ok || !partidosData.success) {
          throw new Error(partidosData.error || 'No se pudieron cargar tus partidos.');
        }

        setPartidos(partidosData.data.partidos || []);
        setMiCategoria(partidosData.data.miCategoria || CATEGORIA_BASE);

        if (rankingRes.ok && rankingData.success) {
          const todos = Object.values(rankingData.data.ranking || {})
            .flat()
            .filter((jugador) => jugador.id !== miId)
            .sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'));
          setJugadores(todos);
          setReglas(rankingData.data.reglas);
        }

        if (canchasRes.ok && canchasData.success) {
          setCanchas(canchasData.data?.canchas || []);
        }

        if (solicitudesRes.ok && solicitudesData.success) {
          setSolicitudes(solicitudesData.data || { recibidas: [], enviadas: [] });
          setErrorSolicitudes('');
        } else {
          setErrorSolicitudes(
            solicitudesData.error || 'No se pudieron cargar las solicitudes.',
          );
        }

        setErrorCarga('');
      } catch (err) {
        if (activo) setErrorCarga(err.message || 'No se pudo conectar con el servidor.');
      } finally {
        if (activo) setCargando(false);
      }
    };

    cargar();

    return () => {
      activo = false;
    };
  }, [miId, recargar]);

  // Si se llega desde el banner del Dashboard con #partidos-pendientes,
  // hace scroll suave hasta esa sección una vez montada la vista.
  useEffect(() => {
    if (window.location.hash === '#partidos-pendientes') {
      requestAnimationFrame(() => {
        document
          .getElementById('partidos-pendientes')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, []);

  const porConfirmar = partidos.filter((p) => p.puedoConfirmar);
  const esperando = partidos.filter((p) => p.registradoPorMi && p.estado === 'pendiente');
  const historial = partidos.filter((p) => p.estado !== 'pendiente');

  const rival = jugadores.find((jugador) => jugador.id === rivalId) || null;

  // Devuelve el contrincante de una solicitud desde el punto de vista del usuario.
  const contrincanteDe = (solicitud) =>
    solicitud.solicitante_id === miId ? solicitud.receptor : solicitud.solicitante;

  const solicitudesAceptadas = [...solicitudes.recibidas, ...solicitudes.enviadas].filter(
    (s) => s.estado === 'aceptada',
  );
  const recibidasPendientes = solicitudes.recibidas.filter((s) => s.estado === 'pendiente');
  const enviadasPendientes = solicitudes.enviadas.filter((s) => s.estado === 'pendiente');

  // accion: "aceptar" | "rechazar" (recibidas) o "cancelar" (enviadas).
  const responderSolicitud = async (id, accion) => {
    setProcesandoSolicitud(id);
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
      setRecargar((n) => n + 1);
    } catch {
      setErrorSolicitudes('No se pudo conectar con el servidor.');
    } finally {
      setProcesandoSolicitud(null);
    }
  };

  // Abre el modal con el perfil público del contrincante.
  const verPerfil = async (jugador) => {
    if (!jugador?.id) return;
    setPerfilAbierto(jugador);
    setPerfilDatos(null);
    setPerfilResenas(null);
    setPerfilError('');
    setPerfilCargando(true);

    try {
      const [perfilRes, resenasRes] = await Promise.all([
        apiFetch(`/api/profile/${jugador.id}`),
        apiFetch(`/api/reviews/player/${jugador.id}`),
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

  // Prellena el formulario de registrar resultado y hace scroll suave.
  const prellenarResultado = (solicitud) => {
    const contrincante = contrincanteDe(solicitud);
    setRivalId(contrincante?.id || '');
    setFecha(solicitud.fecha <= hoyISO() ? solicitud.fecha : hoyISO());
    setCanchaId(solicitud.cancha?.id ? String(solicitud.cancha.id) : '');
    setTocado(false);
    setStatusForm({ type: 'idle', message: '' });

    requestAnimationFrame(() => {
      document
        .getElementById('registrar-resultado')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  // Vista previa de los puntos con las reglas que entrega el servidor.
  const preview = useMemo(() => {
    if (!rival || !reglas) return null;
    const orden = Object.fromEntries(reglas.categorias.map((c) => [c.nombre, c.orden]));
    const rivalCategoria = orden[rival.nivel] ? rival.nivel : CATEGORIA_BASE;
    const mio = orden[miCategoria];
    const suyo = orden[rivalCategoria];
    const relacion = suyo === mio ? 'igual' : suyo < mio ? 'superior' : 'inferior';
    return {
      relacion,
      puntos: reglas.puntosResultado[resultado][relacion],
      valida: resultado === 'Ganado' && relacion !== 'inferior',
    };
  }, [rival, reglas, miCategoria, resultado]);

  const errors = useMemo(() => {
    const list = {};
    if (!rivalId) list.rival = 'Selecciona a tu rival.';
    if (!fecha) list.fecha = 'Selecciona la fecha.';
    else if (fecha > hoyISO()) list.fecha = 'La fecha no puede ser futura.';
    if (marcador.trim() && !MARCADOR_REGEX.test(marcador.trim())) {
      list.marcador = 'Usa un formato como 6-4 6-3.';
    }
    return list;
  }, [rivalId, fecha, marcador]);

  const renderError = (name) => {
    if (!tocado || !errors[name]) return null;
    return (
      <p className="mt-1.5 flex items-center gap-1 text-xs text-red-400">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        {errors[name]}
      </p>
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setTocado(true);
    if (Object.keys(errors).length > 0 || enviando) return;

    setEnviando(true);
    setStatusForm({ type: 'idle', message: '' });

    try {
      const response = await apiFetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rival_id: rivalId,
          resultado,
          marcador: marcador.trim() || null,
          fecha,
          cancha_id: canchaId ? Number(canchaId) : null,
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'No se pudo registrar el partido.');
      }

      setRivalId('');
      setResultado('Ganado');
      setMarcador('');
      setFecha(hoyISO());
      setCanchaId('');
      setTocado(false);
      setStatusForm({
        type: 'success',
        message: `Partido registrado. Sumará puntos cuando ${nombreCompleto(result.data.rival)} lo confirme.`,
      });
      setRecargar((n) => n + 1);
    } catch (err) {
      setStatusForm({ type: 'error', message: err.message });
    } finally {
      setEnviando(false);
    }
  };

  // accion: "confirmar" | "rechazar" (rival) o "eliminar" (quien lo registró).
  const actualizarPartido = async (id, accion) => {
    setProcesando(id);
    setStatusLista({ type: 'idle', message: '' });

    try {
      const response = await apiFetch(`/api/matches/${id}`, {
        method: accion === 'eliminar' ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: accion === 'eliminar' ? undefined : JSON.stringify({ accion }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'No se pudo actualizar el partido.');
      }

      const mensajes = {
        confirmar: 'Partido confirmado. Los puntos ya se reflejan en el ranking.',
        rechazar: 'Partido rechazado. No suma ni resta puntos.',
        eliminar: 'Partido eliminado.',
      };
      setStatusLista({ type: 'success', message: mensajes[accion] });
      setRecargar((n) => n + 1);
    } catch (err) {
      setStatusLista({ type: 'error', message: err.message });
    } finally {
      setProcesando(null);
    }
  };

  const detallePartido = (partido) => (
    <p className="mt-1 text-xs text-slate-400">
      <span
        className={`font-semibold ${
          partido.resultado === 'Ganado' ? 'text-emerald-300' : 'text-red-300'
        }`}
      >
        {partido.resultado}
      </span>
      {partido.marcador ? ` · ${partido.marcador}` : ''} · {formatFecha(partido.fecha)}
      {partido.cancha?.nombre ? ` · ${partido.cancha.nombre}` : ''}
    </p>
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
                <ClipboardCheck className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-2xl font-bold leading-tight text-slate-100">
                  Mis Partidos
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  Registra y confirma resultados
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

        {errorCarga && (
          <p className="mt-6 flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {errorCarga}
          </p>
        )}

        {errorSolicitudes && (
          <p className="mt-6 flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {errorSolicitudes}
          </p>
        )}

        {/* Sección 1: Partidos Pendientes */}
        <section id="partidos-pendientes" className="mt-8 scroll-mt-6">
          <h2 className={tituloSeccion}>
            <ClipboardCheck className="h-4 w-4 text-emerald-300" />
            Partidos Pendientes ({solicitudesAceptadas.length})
          </h2>

          {solicitudesAceptadas.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/40 p-5 text-center text-sm text-slate-500">
              No tienes partidos pendientes por jugar.
            </p>
          ) : (
            <ul className="grid gap-3">
              {solicitudesAceptadas.map((solicitud) => {
                const contrincante = contrincanteDe(solicitud);
                return (
                  <li
                    key={solicitud.id}
                    className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4 shadow-2xl backdrop-blur-md"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar jugador={contrincante} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-100">
                          {nombreCompleto(contrincante)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {contrincante?.nivel || 'Sin nivel'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-1.5 text-xs text-slate-300">
                      <p className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-500" />
                        {formatFecha(solicitud.fecha)}
                        {solicitud.hora_desde && (
                          <>
                            <Clock className="ml-1 h-3.5 w-3.5 text-slate-500" />
                            {solicitud.hora_desde} - {solicitud.hora_hasta}
                          </>
                        )}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-500" />
                        {solicitud.cancha?.nombre
                          ? `${solicitud.cancha.nombre}${solicitud.cancha.direccion ? ` · ${solicitud.cancha.direccion}` : ''}`
                          : 'Cancha por definir'}
                      </p>
                      {solicitud.mensaje && (
                        <p className="mt-1 rounded-lg bg-slate-900/60 p-2 text-slate-400">
                          “{solicitud.mensaje}”
                        </p>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => verPerfil(contrincante)}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700/50 bg-slate-800/70 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:border-emerald-500/50 hover:text-emerald-300"
                      >
                        <Eye className="h-4 w-4" />
                        Ver perfil
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/chat?usuario=${contrincante?.id}`)}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700/50 bg-slate-800/70 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:border-emerald-500/50 hover:text-emerald-300"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Abrir chat
                      </button>
                      <button
                        type="button"
                        onClick={() => prellenarResultado(solicitud)}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-slate-100 transition-colors hover:bg-emerald-700"
                      >
                        <ClipboardCheck className="h-4 w-4" />
                        Registrar
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Sección 2: Solicitudes Recibidas y Enviadas */}
        <section className="mt-8">
          <h2 className={tituloSeccion}>
            <Hourglass className="h-4 w-4 text-amber-300" />
            Solicitudes Recibidas y Enviadas
          </h2>

          {recibidasPendientes.length === 0 && enviadasPendientes.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/40 p-5 text-center text-sm text-slate-500">
              No tienes solicitudes pendientes.
            </p>
          ) : (
            <div className="grid gap-6">
              {recibidasPendientes.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-300">
                    Recibidas pendientes ({recibidasPendientes.length})
                  </h3>
                  <ul className="grid gap-3">
                    {recibidasPendientes.map((solicitud) => {
                      const contrincante = contrincanteDe(solicitud);
                      return (
                        <li
                          key={solicitud.id}
                          className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 shadow-2xl backdrop-blur-md"
                        >
                          <div className="flex items-start gap-3">
                            <Avatar jugador={contrincante} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-100">
                                {nombreCompleto(contrincante)}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-400">
                                {formatFecha(solicitud.fecha)}
                                {solicitud.hora_desde &&
                                  ` · ${solicitud.hora_desde} - ${solicitud.hora_hasta}`}
                              </p>
                              {solicitud.cancha?.nombre && (
                                <p className="mt-0.5 text-xs text-slate-400">
                                  {solicitud.cancha.nombre}
                                </p>
                              )}
                              {solicitud.mensaje && (
                                <p className="mt-1 rounded-lg bg-slate-900/60 p-2 text-xs text-slate-400">
                                  “{solicitud.mensaje}”
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => responderSolicitud(solicitud.id, 'aceptar')}
                              disabled={procesandoSolicitud === solicitud.id}
                              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-emerald-700 disabled:opacity-60"
                            >
                              <Check className="h-4 w-4" />
                              Aceptar
                            </button>
                            <button
                              type="button"
                              onClick={() => responderSolicitud(solicitud.id, 'rechazar')}
                              disabled={procesandoSolicitud === solicitud.id}
                              className="flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-60"
                            >
                              <X className="h-4 w-4" />
                              Rechazar
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {enviadasPendientes.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Enviadas pendientes ({enviadasPendientes.length})
                  </h3>
                  <ul className="grid gap-3">
                    {enviadasPendientes.map((solicitud) => {
                      const contrincante = contrincanteDe(solicitud);
                      return (
                        <li
                          key={solicitud.id}
                          className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4 shadow-2xl backdrop-blur-md"
                        >
                          <div className="flex items-start gap-3">
                            <Avatar jugador={contrincante} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-100">
                                {nombreCompleto(contrincante)}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-400">
                                {formatFecha(solicitud.fecha)}
                                {solicitud.hora_desde &&
                                  ` · ${solicitud.hora_desde} - ${solicitud.hora_hasta}`}
                              </p>
                              {solicitud.cancha?.nombre && (
                                <p className="mt-0.5 text-xs text-slate-400">
                                  {solicitud.cancha.nombre}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => responderSolicitud(solicitud.id, 'cancelar')}
                            disabled={procesandoSolicitud === solicitud.id}
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/70 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-red-500/50 hover:text-red-300 disabled:opacity-60"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Cancelar solicitud
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Partidos que el rival registró y debo confirmar */}
        {porConfirmar.length > 0 && (
          <section className="mt-8">
            <h2 className={tituloSeccion}>
              <Hourglass className="h-4 w-4 text-amber-300" />
              Por confirmar ({porConfirmar.length})
            </h2>
            <ul className="grid gap-3">
              {porConfirmar.map((partido) => (
                <li
                  key={partido.id}
                  className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 shadow-2xl backdrop-blur-md"
                >
                  <div className="flex items-start gap-3">
                    <Avatar jugador={partido.rival} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-300">
                        <span className="font-semibold text-slate-100">
                          {nombreCompleto(partido.rival)}
                        </span>{' '}
                        registró este partido:
                      </p>
                      {detallePartido(partido)}
                      <p className="mt-1 text-xs text-slate-500">
                        Si lo confirmas: {formatPuntos(partido.puntos)} para ti.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => actualizarPartido(partido.id, 'confirmar')}
                      disabled={procesando === partido.id}
                      className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <Check className="h-4 w-4" />
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => actualizarPartido(partido.id, 'rechazar')}
                      disabled={procesando === partido.id}
                      className="flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-60"
                    >
                      <X className="h-4 w-4" />
                      No es correcto
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Aviso status={statusLista} />

        {/* Registrar resultado */}
        <form
          id="registrar-resultado"
          onSubmit={handleSubmit}
          noValidate
          className="mt-8 scroll-mt-6 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-md"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Registrar resultado
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Tu rival debe confirmarlo para que sume puntos a ambos. Así nadie
            puede inflar su ranking.
          </p>

          <div className="mt-4">
            <label className={labelClass} htmlFor="rival">
              Rival
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                id="rival"
                value={rivalId}
                onChange={(event) => setRivalId(event.target.value)}
                disabled={cargando}
                className={`${inputBase} appearance-none pl-11 disabled:opacity-60`}
              >
                <option value="" className="bg-slate-800">
                  {cargando ? 'Cargando jugadores...' : 'Selecciona a tu rival'}
                </option>
                {jugadores.map((jugador) => (
                  <option key={jugador.id} value={jugador.id} className="bg-slate-800">
                    {nombreCompleto(jugador)} · {jugador.nivel}
                  </option>
                ))}
              </select>
            </div>
            {renderError('rival')}
          </div>

          <div className="mt-5">
            <span className={labelClass}>Resultado</span>
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-700/50 bg-slate-800/50 p-1">
              {['Ganado', 'Perdido'].map((opcion) => {
                const activo = resultado === opcion;
                return (
                  <button
                    type="button"
                    key={opcion}
                    onClick={() => setResultado(opcion)}
                    aria-pressed={activo}
                    className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      activo
                        ? opcion === 'Ganado'
                          ? 'bg-emerald-600 text-slate-100'
                          : 'bg-red-600 text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opcion === 'Ganado' ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    {opcion === 'Ganado' ? 'Gané' : 'Perdí'}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} htmlFor="marcador">
                Marcador (opcional)
              </label>
              <input
                id="marcador"
                type="text"
                value={marcador}
                onChange={(event) => setMarcador(event.target.value)}
                placeholder={resultado === 'Ganado' ? '6-4 6-3' : '4-6 3-6'}
                className={inputBase}
              />
              {renderError('marcador')}
            </div>

            <div>
              <label className={labelClass} htmlFor="fecha">
                Fecha
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="fecha"
                  type="date"
                  max={hoyISO()}
                  value={fecha}
                  onChange={(event) => setFecha(event.target.value)}
                  className={`${inputBase} pl-11`}
                />
              </div>
              {renderError('fecha')}
            </div>
          </div>

          <div className="mt-5">
            <label className={labelClass} htmlFor="cancha">
              Cancha (opcional)
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                id="cancha"
                value={canchaId}
                onChange={(event) => setCanchaId(event.target.value)}
                className={`${inputBase} appearance-none pl-11`}
              >
                <option value="" className="bg-slate-800">
                  Sin especificar
                </option>
                {canchas.map((cancha) => (
                  <option key={cancha.id} value={cancha.id} className="bg-slate-800">
                    {cancha.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {preview && (
            <div
              className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${
                preview.puntos >= 0
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-red-500/40 bg-red-500/10 text-red-300'
              }`}
            >
              {preview.puntos >= 0 ? (
                <TrendingUp className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <TrendingDown className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>
                Al confirmarse: {formatPuntos(preview.puntos)} en {miCategoria}.
              </span>
            </div>
          )}

          <Aviso status={statusForm} />

          <button
            type="submit"
            disabled={enviando}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-slate-100 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            {enviando ? 'Registrando...' : 'Registrar partido'}
          </button>
        </form>

        {/* Registrados por mí, esperando al rival */}
        {esperando.length > 0 && (
          <section className="mt-8">
            <h2 className={tituloSeccion}>
              <Hourglass className="h-4 w-4" />
              Esperando confirmación ({esperando.length})
            </h2>
            <ul className="grid gap-3">
              {esperando.map((partido) => (
                <li key={partido.id} className={`${tarjeta} flex items-start gap-3`}>
                  <ResultadoIcono partido={partido} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-100">
                      vs {nombreCompleto(partido.rival)}
                    </p>
                    {detallePartido(partido)}
                  </div>
                  <button
                    type="button"
                    onClick={() => actualizarPartido(partido.id, 'eliminar')}
                    disabled={procesando === partido.id}
                    aria-label="Eliminar partido"
                    className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-2 text-slate-400 transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Historial */}
        <section className="mt-8">
          <h2 className={tituloSeccion}>
            <History className="h-4 w-4" />
            Historial
          </h2>

          {cargando ? (
            <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/40 p-5 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando partidos...
            </p>
          ) : historial.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/40 p-5 text-center text-sm text-slate-500">
              Aún no tienes partidos confirmados.
            </p>
          ) : (
            <ul className="grid max-h-96 gap-3 overflow-y-auto overscroll-contain pr-1">
              {historial.map((partido) => {
                const confirmado = partido.estado === 'confirmado';
                const suma = confirmado && partido.miCategoria === miCategoria;
                return (
                  <li
                    key={partido.id}
                    className={`${tarjeta} flex items-start gap-3 ${confirmado ? '' : 'opacity-60'}`}
                  >
                    <ResultadoIcono partido={partido} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        vs {nombreCompleto(partido.rival)}
                      </p>
                      {detallePartido(partido)}
                      {confirmado && !suma && (
                        <p className="mt-1 text-[11px] text-slate-500">
                          Jugado en {partido.miCategoria}: ya no suma en tu categoría actual.
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        !confirmado
                          ? 'bg-slate-700/60 text-slate-400'
                          : partido.puntos >= 0
                            ? 'bg-emerald-500/10 text-emerald-300'
                            : 'bg-red-500/10 text-red-300'
                      }`}
                    >
                      {confirmado ? formatPuntos(partido.puntos) : 'Rechazado'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className="mt-auto pt-10 text-center text-xs text-slate-500">
          ¿Buscas rival?{' '}
          <Link to="/buscar-partido" className="font-semibold text-emerald-400 hover:text-emerald-300">
            Encuentra uno en Buscar Partido
          </Link>
        </p>
      </div>

      {/* Modal con el perfil público del contrincante */}
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
                        alt={`Foto de ${nombreCompleto(perfilDatos)}`}
                        className="h-24 w-24 rounded-full border-2 border-slate-900 object-cover"
                      />
                    ) : (
                      <span className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-slate-900 bg-slate-800 text-slate-400">
                        <User className="h-10 w-10" />
                      </span>
                    )}
                  </span>
                  <h2 className="text-xl font-bold text-slate-100">
                    {nombreCompleto(perfilDatos)}
                  </h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
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

export default MisPartidosView;
