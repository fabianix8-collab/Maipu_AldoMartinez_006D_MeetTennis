import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardCheck,
  History,
  Hourglass,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
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
        const [partidosRes, rankingRes, canchasRes] = await Promise.all([
          apiFetch('/api/matches'),
          apiFetch('/api/ranking'),
          fetch('/api/courts'),
        ]);
        const [partidosData, rankingData, canchasData] = await Promise.all([
          partidosRes.json(),
          rankingRes.json(),
          canchasRes.json(),
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

  const porConfirmar = partidos.filter((p) => p.puedoConfirmar);
  const esperando = partidos.filter((p) => p.registradoPorMi && p.estado === 'pendiente');
  const historial = partidos.filter((p) => p.estado !== 'pendiente');

  const rival = jugadores.find((jugador) => jugador.id === rivalId) || null;

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
          onSubmit={handleSubmit}
          noValidate
          className="mt-8 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-md"
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
                Al confirmarse: {formatPuntos(preview.puntos)} en {miCategoria}.{' '}
                {preview.valida
                  ? '¡Cuenta como victoria válida para ascender!'
                  : preview.relacion === 'inferior' && resultado === 'Ganado'
                    ? 'Ganarle a una categoría inferior no cuenta como victoria válida.'
                    : ''}
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
    </div>
  );
}

export default MisPartidosView;
