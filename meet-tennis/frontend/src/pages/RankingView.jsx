import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  Calendar,
  CheckCircle2,
  Crown,
  Flame,
  Info,
  ListOrdered,
  Loader2,
  Percent,
  Plus,
  Swords,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  User,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import TennisBackground from '../components/TennisBackground.jsx';

const inputBase =
  'w-full rounded-xl border border-slate-700/50 bg-slate-800/70 px-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-emerald-500';
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-400';

// Puntaje base según la categoría (mismo criterio que el backend).
const PUNTOS_POR_NIVEL = {
  '1ra Categoría': 1600,
  '2da Categoría': 1400,
  '3ra Categoría': 1200,
  '4ta Categoría': 1000,
  '5ta Categoría': 800,
};
const PUNTOS_DEFECTO = 1000;

// Variación de puntaje al registrar un resultado.
const DELTA_VICTORIA = 25;
const DELTA_DERROTA = -20;

// Hitos de puntaje usados para la barra de progreso.
const NIVELES_META = [
  { nombre: '5ta Categoría', puntos: 800 },
  { nombre: '4ta Categoría', puntos: 1000 },
  { nombre: '3ra Categoría', puntos: 1200 },
  { nombre: '2da Categoría', puntos: 1400 },
  { nombre: '1ra Categoría', puntos: 1600 },
  { nombre: 'Élite', puntos: 1800 },
];

// Acepta marcadores como "6-4", "6-4 6-3" o "6-4, 3-6, 7-5".
const MARCADOR_REGEX =
  /^\d{1,2}\s*-\s*\d{1,2}(\s*[,/]?\s*\d{1,2}\s*-\s*\d{1,2})*$/;

const RANKING_KEY = 'meettennis_ranking';

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('meettennis_auth') || 'null');
  } catch {
    return null;
  }
}

function getUserKey() {
  const stored = getStoredUser();
  return stored?.user?.id || stored?.profile?.id || 'invitado';
}

function loadPartidos() {
  try {
    const raw = JSON.parse(localStorage.getItem(RANKING_KEY) || '{}');
    const partidos = raw[getUserKey()];
    return Array.isArray(partidos) ? partidos : [];
  } catch {
    return [];
  }
}

function persistPartidos(partidos) {
  try {
    const raw = JSON.parse(localStorage.getItem(RANKING_KEY) || '{}');
    raw[getUserKey()] = partidos;
    localStorage.setItem(RANKING_KEY, JSON.stringify(raw));
  } catch {
    // Silencioso: si el almacenamiento no está disponible, la sesión sigue funcionando.
  }
}

// Fecha de hoy en formato YYYY-MM-DD respetando la zona horaria local.
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

function puntosBaseDe(nivel) {
  return PUNTOS_POR_NIVEL[nivel] ?? PUNTOS_DEFECTO;
}

// Recorre los partidos (del más reciente al más antiguo) y suma los deltas.
function calcularPuntos(nivel, partidos) {
  const base = puntosBaseDe(nivel);
  return partidos.reduce(
    (total, partido) =>
      total + (partido.resultado === 'Ganado' ? DELTA_VICTORIA : DELTA_DERROTA),
    base,
  );
}

// Racha actual a partir del partido más reciente.
function calcularRacha(partidos) {
  if (partidos.length === 0) return null;

  const { resultado } = partidos[0];
  let cantidad = 0;
  for (const partido of partidos) {
    if (partido.resultado !== resultado) break;
    cantidad += 1;
  }

  return { resultado, cantidad };
}

function iniciales(nombre, apellido) {
  const primera = (nombre || '').trim().charAt(0);
  const segunda = (apellido || '').trim().charAt(0);
  return `${primera}${segunda}`.toUpperCase() || '?';
}

function RankingView() {
  const storedUser = getStoredUser();
  const profile = storedUser?.profile || {};
  const userId = storedUser?.user?.id || profile.id || '';

  const miNombre = profile.nombre || 'Deportista';
  const miApellido = profile.apellido || '';
  const miNivel = profile.nivel || 'Sin nivel';
  const miAvatar = profile.avatar_url || null;

  const [partidos, setPartidos] = useState(loadPartidos);

  const [rival, setRival] = useState('');
  const [resultado, setResultado] = useState('Ganado');
  const [marcador, setMarcador] = useState('');
  const [fecha, setFecha] = useState(hoyISO);
  const [tocado, setTocado] = useState(false);
  const [status, setStatus] = useState({ type: 'idle', message: '' });

  const [ranking, setRanking] = useState([]);
  const [loadingRanking, setLoadingRanking] = useState(true);
  const [rankingError, setRankingError] = useState('');

  useEffect(() => {
    let activo = true;

    const cargarRanking = async () => {
      try {
        const response = await fetch('/api/ranking');
        const result = await response.json();

        if (!activo) return;

        if (response.ok && result.success && result.data) {
          setRanking(
            Array.isArray(result.data.ranking) ? result.data.ranking : [],
          );
        } else {
          setRankingError('No se pudo cargar la tabla de posiciones.');
        }
      } catch {
        if (activo) setRankingError('No se pudo conectar con el servidor.');
      } finally {
        if (activo) setLoadingRanking(false);
      }
    };

    cargarRanking();

    return () => {
      activo = false;
    };
  }, []);

  const puntos = useMemo(
    () => calcularPuntos(miNivel, partidos),
    [miNivel, partidos],
  );

  const estadisticas = useMemo(() => {
    const jugados = partidos.length;
    const ganados = partidos.filter((p) => p.resultado === 'Ganado').length;
    const perdidos = jugados - ganados;
    const efectividad = jugados > 0 ? Math.round((ganados / jugados) * 100) : 0;
    const racha = calcularRacha(partidos);

    return { jugados, ganados, perdidos, efectividad, racha };
  }, [partidos]);

  // Combina el ranking del servidor con los puntos reales del jugador actual.
  const rankingFusionado = useMemo(() => {
    const lista = ranking.map((jugador) =>
      jugador.id === userId
        ? {
            ...jugador,
            nombre: miNombre,
            apellido: miApellido,
            nivel: miNivel,
            avatar_url: miAvatar,
            puntos,
            esYo: true,
          }
        : { ...jugador, esYo: false },
    );

    if (userId && !lista.some((jugador) => jugador.id === userId)) {
      lista.push({
        id: userId,
        nombre: miNombre,
        apellido: miApellido,
        nivel: miNivel,
        avatar_url: miAvatar,
        puntos,
        esYo: true,
      });
    }

    lista.sort((a, b) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      return `${a.nombre} ${a.apellido}`.localeCompare(
        `${b.nombre} ${b.apellido}`,
        'es',
      );
    });

    return lista.map((jugador, index) => ({
      ...jugador,
      posicion: index + 1,
    }));
  }, [ranking, userId, miNombre, miApellido, miNivel, miAvatar, puntos]);

  const miPosicion =
    rankingFusionado.find((jugador) => jugador.esYo)?.posicion || null;
  const totalJugadores = rankingFusionado.length;

  const rivalesSugeridos = useMemo(
    () =>
      ranking
        .filter((jugador) => jugador.id !== userId && jugador.nombre)
        .map((jugador) =>
          `${jugador.nombre} ${jugador.apellido}`.trim(),
        ),
    [ranking, userId],
  );

  const metaSiguiente = NIVELES_META.find((meta) => meta.puntos > puntos) || null;
  const metaBase =
    [...NIVELES_META].reverse().find((meta) => meta.puntos <= puntos) ||
    { nombre: 'Base', puntos: 0 };
  const progreso = metaSiguiente
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            ((puntos - metaBase.puntos) /
              (metaSiguiente.puntos - metaBase.puntos)) *
              100,
          ),
        ),
      )
    : 100;

  const errors = useMemo(() => {
    const list = {};

    if (!rival.trim()) {
      list.rival = 'Indica el nombre del rival.';
    }

    if (!fecha) {
      list.fecha = 'Selecciona la fecha.';
    } else if (fecha > hoyISO()) {
      list.fecha = 'La fecha no puede ser futura.';
    }

    if (marcador.trim() && !MARCADOR_REGEX.test(marcador.trim())) {
      list.marcador = 'Usa un formato como 6-4 6-3.';
    }

    return list;
  }, [rival, fecha, marcador]);

  const isValid = Object.keys(errors).length === 0;

  const handleSubmit = (event) => {
    event.preventDefault();
    setTocado(true);

    if (!isValid) return;

    const nuevoPartido = {
      id: `${Date.now()}`,
      rival: rival.trim(),
      resultado,
      marcador: marcador.trim(),
      fecha,
    };

    const siguientes = [nuevoPartido, ...partidos];
    setPartidos(siguientes);
    persistPartidos(siguientes);

    setRival('');
    setResultado('Ganado');
    setMarcador('');
    setFecha(hoyISO());
    setTocado(false);
    setStatus({
      type: 'success',
      message: 'Resultado registrado. Tu ranking se actualizó.',
    });
  };

  const removePartido = (id) => {
    const siguientes = partidos.filter((partido) => partido.id !== id);
    setPartidos(siguientes);
    persistPartidos(siguientes);
    setStatus({ type: 'idle', message: '' });
  };

  const renderError = (name) => {
    if (!tocado || !errors[name]) return null;
    return (
      <p className="mt-1.5 flex items-center gap-1 text-xs text-red-400">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        {errors[name]}
      </p>
    );
  };

  const borderFor = (name) => {
    if (!tocado) return 'border-slate-700/50';
    return errors[name] ? 'border-red-500' : 'border-emerald-500';
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
                <Trophy className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-2xl font-bold leading-tight text-slate-100">
                  Mi Ranking
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  Tu nivel y posición competitiva
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

        {/* Tarjeta principal: puntos, categoría y posición */}
        <section className="mt-8 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-4">
            <span className="relative inline-flex shrink-0 rounded-full bg-gradient-to-tr from-emerald-500 via-emerald-400 to-lime-300 p-[2px] shadow-lg">
              {miAvatar ? (
                <img
                  src={miAvatar}
                  alt={`Foto de perfil de ${miNombre}`}
                  className="h-16 w-16 rounded-full border-2 border-slate-900 object-cover"
                />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-slate-900 bg-slate-800 text-slate-400">
                  <User className="h-7 w-7" />
                </span>
              )}
            </span>

            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-slate-100">
                {`${miNombre} ${miApellido}`.trim()}
              </h2>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <Trophy className="h-3.5 w-3.5" />
                {miNivel}
              </span>
            </div>
          </div>

          <div className="mt-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Puntaje de ranking
              </p>
              <p className="mt-1 text-4xl font-bold text-slate-100">
                {puntos}
                <span className="ml-1 text-sm font-medium text-slate-500">
                  pts
                </span>
              </p>
            </div>

            <span className="inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-300">
              <Crown className="h-4 w-4" />
              {miPosicion ? `#${miPosicion} de ${totalJugadores}` : 'Sin posición'}
            </span>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{metaBase.nombre}</span>
              <span>
                {metaSiguiente
                  ? `${metaSiguiente.nombre} · ${metaSiguiente.puntos} pts`
                  : 'Nivel máximo'}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-300 transition-all duration-500"
                style={{ width: `${progreso}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {metaSiguiente
                ? `Te faltan ${
                    metaSiguiente.puntos - puntos
                  } pts para alcanzar ${metaSiguiente.nombre}.`
                : '¡Alcanzaste el puntaje más alto de MeetTennis!'}
            </p>
          </div>
        </section>

        {/* Resumen de estadísticas */}
        <section className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4 shadow-2xl backdrop-blur-md">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-400">
              <Swords className="h-5 w-5" />
            </span>
            <p className="mt-3 text-2xl font-bold text-slate-100">
              {estadisticas.jugados}
            </p>
            <p className="text-xs text-slate-400">Partidos jugados</p>
          </div>

          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4 shadow-2xl backdrop-blur-md">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-400">
              <Percent className="h-5 w-5" />
            </span>
            <p className="mt-3 text-2xl font-bold text-slate-100">
              {estadisticas.efectividad}%
            </p>
            <p className="text-xs text-slate-400">Efectividad</p>
          </div>

          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4 shadow-2xl backdrop-blur-md">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </span>
            <p className="mt-3 text-2xl font-bold text-slate-100">
              {estadisticas.ganados}
            </p>
            <p className="text-xs text-slate-400">Partidos ganados</p>
          </div>

          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4 shadow-2xl backdrop-blur-md">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
              <TrendingDown className="h-5 w-5" />
            </span>
            <p className="mt-3 text-2xl font-bold text-slate-100">
              {estadisticas.perdidos}
            </p>
            <p className="text-xs text-slate-400">Partidos perdidos</p>
          </div>
        </section>

        {/* Racha actual */}
        {estadisticas.racha && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4 shadow-2xl backdrop-blur-md">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                estadisticas.racha.resultado === 'Ganado'
                  ? 'bg-emerald-600/15 text-emerald-400'
                  : 'bg-red-500/15 text-red-400'
              }`}
            >
              <Flame className="h-5 w-5" />
            </span>
            <p className="text-sm text-slate-300">
              Racha actual:{' '}
              <span
                className={`font-semibold ${
                  estadisticas.racha.resultado === 'Ganado'
                    ? 'text-emerald-300'
                    : 'text-red-300'
                }`}
              >
                {estadisticas.racha.cantidad}{' '}
                {estadisticas.racha.cantidad === 1 ? 'partido' : 'partidos'}{' '}
                {estadisticas.racha.resultado === 'Ganado'
                  ? 'ganado'
                  : 'perdido'}
                {estadisticas.racha.cantidad === 1 ? '' : 's'}
              </span>
            </p>
          </div>
        )}

        {/* Registrar resultado */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-6 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-md"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Registrar resultado
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Suma puntos con cada victoria y sigue tu progreso.
          </p>

          <div className="mt-4">
            <label className={labelClass} htmlFor="rival">
              Rival
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                id="rival"
                name="rival"
                type="text"
                list="rivales-sugeridos"
                value={rival}
                onChange={(event) => {
                  setRival(event.target.value);
                  setStatus({ type: 'idle', message: '' });
                }}
                placeholder="Nombre del rival"
                className={`${inputBase} pl-11 ${borderFor('rival')}`}
              />
              <datalist id="rivales-sugeridos">
                {rivalesSugeridos.map((nombre) => (
                  <option key={nombre} value={nombre} />
                ))}
              </datalist>
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
                    onClick={() => {
                      setResultado(opcion);
                      setStatus({ type: 'idle', message: '' });
                    }}
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
                    {opcion}
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
                name="marcador"
                type="text"
                value={marcador}
                onChange={(event) => {
                  setMarcador(event.target.value);
                  setStatus({ type: 'idle', message: '' });
                }}
                placeholder="6-4 6-3"
                className={`${inputBase} ${borderFor('marcador')}`}
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
                  name="fecha"
                  type="date"
                  value={fecha}
                  onChange={(event) => {
                    setFecha(event.target.value);
                    setStatus({ type: 'idle', message: '' });
                  }}
                  className={`${inputBase} pl-11 ${borderFor('fecha')}`}
                />
              </div>
              {renderError('fecha')}
            </div>
          </div>

          {status.type === 'success' && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {status.message}
            </div>
          )}

          <button
            type="submit"
            disabled={!isValid}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-slate-100 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-5 w-5" />
            Registrar partido
          </button>
        </form>

        {/* Historial de partidos */}
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Últimos partidos
          </h2>

          {partidos.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/40 p-5 text-center text-sm text-slate-500">
              Aún no registras partidos. Agrega tu primer resultado para empezar
              a sumar puntos.
            </p>
          ) : (
            <ul className="grid gap-3">
              {partidos.map((partido) => {
                const gano = partido.resultado === 'Ganado';
                return (
                  <li
                    key={partido.id}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4 shadow-2xl backdrop-blur-md"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                            gano
                              ? 'bg-emerald-600/20 text-emerald-300'
                              : 'bg-red-500/15 text-red-300'
                          }`}
                        >
                          {gano ? (
                            <TrendingUp className="h-3.5 w-3.5" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <span className="truncate">vs {partido.rival}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        <span
                          className={`font-semibold ${
                            gano ? 'text-emerald-300' : 'text-red-300'
                          }`}
                        >
                          {partido.resultado}
                        </span>
                        {partido.marcador ? ` · ${partido.marcador}` : ''}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatFecha(partido.fecha)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removePartido(partido.id)}
                      aria-label="Eliminar partido"
                      className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-2 text-slate-400 transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Tabla de posiciones */}
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            <ListOrdered className="h-4 w-4" />
            Tabla de posiciones
          </h2>

          {loadingRanking ? (
            <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/40 p-5 text-center text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando jugadores...
            </p>
          ) : rankingError ? (
            <p className="mb-3 flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {rankingError}
            </p>
          ) : null}

          {!loadingRanking && (
            <ul className="grid gap-2">
              {rankingFusionado.map((jugador) => {
                const podio =
                  jugador.posicion <= 3
                    ? ['text-amber-300', 'text-slate-300', 'text-orange-400'][
                        jugador.posicion - 1
                      ]
                    : 'text-slate-500';

                return (
                  <li
                    key={jugador.id}
                    className={`flex items-center gap-3 rounded-2xl border p-3 shadow-2xl backdrop-blur-md ${
                      jugador.esYo
                        ? 'border-emerald-500/60 bg-emerald-600/10'
                        : 'border-slate-700/50 bg-slate-900/60'
                    }`}
                  >
                    <span
                      className={`flex w-6 shrink-0 items-center justify-center text-sm font-bold ${podio}`}
                    >
                      {jugador.posicion <= 3 ? (
                        <Award className="h-4 w-4" />
                      ) : (
                        jugador.posicion
                      )}
                    </span>

                    <span className="inline-flex shrink-0 rounded-full bg-gradient-to-tr from-emerald-500 via-emerald-400 to-lime-300 p-[1.5px]">
                      {jugador.avatar_url ? (
                        <img
                          src={jugador.avatar_url}
                          alt={`Foto de ${jugador.nombre}`}
                          className="h-9 w-9 rounded-full border-2 border-slate-900 object-cover"
                        />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-slate-900 bg-slate-800 text-xs font-semibold text-slate-400">
                          {iniciales(jugador.nombre, jugador.apellido)}
                        </span>
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {`${jugador.nombre} ${jugador.apellido}`.trim() ||
                          'Jugador'}
                        {jugador.esYo && (
                          <span className="ml-2 rounded-full bg-emerald-600/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                            Tú
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {jugador.nivel}
                      </p>
                    </div>

                    <span className="shrink-0 text-sm font-bold text-slate-100">
                      {jugador.puntos}
                      <span className="ml-1 text-xs font-medium text-slate-500">
                        pts
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Cómo funciona */}
        <section className="mt-6 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-md">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            <Info className="h-4 w-4 text-emerald-400" />
            ¿Cómo funciona el ranking?
          </h2>
          <ul className="mt-3 grid gap-2 text-xs text-slate-400">
            <li>
              Cada categoría parte con un puntaje base (1ra: 1600 · 2da: 1400 ·
              3ra: 1200 · 4ta: 1000 · 5ta: 800).
            </li>
            <li>
              Cada victoria suma <span className="font-semibold text-emerald-300">+{DELTA_VICTORIA} pts</span> y
              cada derrota resta{' '}
              <span className="font-semibold text-red-300">
                {DELTA_DERROTA} pts
              </span>
              .
            </li>
            <li>
              Tu puntaje se recalcula con todos los partidos que registres y se
              refleja en la tabla de posiciones.
            </li>
          </ul>
        </section>

        <p className="mt-auto pt-10 text-center text-xs text-slate-500">
          Registra tus partidos para escalar posiciones en MeetTennis.
        </p>
      </div>
    </div>
  );
}

export default RankingView;
