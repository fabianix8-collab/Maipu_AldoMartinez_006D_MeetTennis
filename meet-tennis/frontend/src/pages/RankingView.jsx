import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Award,
  Calendar,
  CheckCircle2,
  Crown,
  Flame,
  Info,
  Layers,
  ListOrdered,
  Loader2,
  Percent,
  Plus,
  ShieldCheck,
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

// Categorías ordenadas de MAYOR a MENOR nivel competitivo.
const CATEGORIAS = [
  { nombre: '1ra Categoría', orden: 1 },
  { nombre: '2da Categoría', orden: 2 },
  { nombre: '3ra Categoría', orden: 3 },
  { nombre: '4ta Categoría', orden: 4 },
  { nombre: '5ta Categoría', orden: 5 },
];
const NOMBRES_CATEGORIAS = CATEGORIAS.map((c) => c.nombre);
const ORDEN_POR_CATEGORIA = Object.fromEntries(
  CATEGORIAS.map((c) => [c.nombre, c.orden]),
);

// Requisitos para ascender de cada categoría a la superior.
// Subir cuesta: se exigen puntos acumulados Y victorias válidas
// (contra rivales de tu misma categoría o superiores).
const ASCENSOS = {
  '5ta Categoría': { puntos: 200, victorias: 10 },
  '4ta Categoría': { puntos: 350, victorias: 14 },
  '3ra Categoría': { puntos: 500, victorias: 18 },
  '2da Categoría': { puntos: 700, victorias: 22 },
  '1ra Categoría': null, // Máxima categoría, no hay ascenso.
};

// Puntos según el resultado y la categoría del rival respecto al jugador.
// Ganar a alguien de categoría superior vale más que ganar a uno inferior.
const PUNTOS_RESULTADO = {
  Ganado: { superior: 40, igual: 25, inferior: 10 },
  Perdido: { superior: -5, igual: -15, inferior: -25 },
};

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

function siguienteCategoria(nivel) {
  if (!nivel || nivel === '1ra Categoría') return null;
  const idx = CATEGORIAS.findIndex((c) => c.nombre === nivel);
  return idx >= 0 ? CATEGORIAS[idx - 1].nombre : null;
}

// Relación entre la categoría del jugador y la de su rival.
function relacionCategorias(miNivel, rivalNivel) {
  const mi = ORDEN_POR_CATEGORIA[miNivel];
  const rival = ORDEN_POR_CATEGORIA[rivalNivel];
  if (mi == null || rival == null) return 'igual';
  if (rival === mi) return 'igual';
  return rival < mi ? 'superior' : 'inferior';
}

// Puntos que aporta (o resta) un partido, solo si se jugó en la categoría actual.
// Los partidos de categorías anteriores dejan de sumar al ascender: al cambiar
// de categoría se reinicia el desafío, como en el tenis real.
function puntosDePartido(partido, miNivel) {
  if (partido.categoria !== miNivel) return 0;
  const relacion = relacionCategorias(miNivel, partido.rivalNivel);
  return PUNTOS_RESULTADO[partido.resultado]?.[relacion] ?? 0;
}

function calcularPuntos(miNivel, partidos) {
  const total = partidos.reduce(
    (acc, partido) => acc + puntosDePartido(partido, miNivel),
    0,
  );
  return Math.max(0, total);
}

// Victorias "válidas": ganar a rivales de tu misma categoría o superiores.
function contarVictoriasValidas(miNivel, partidos) {
  return partidos.filter((partido) => {
    if (partido.categoria !== miNivel || partido.resultado !== 'Ganado') {
      return false;
    }
    return relacionCategorias(miNivel, partido.rivalNivel) !== 'inferior';
  }).length;
}

// Racha actual a partir del partido más reciente de la categoría activa.
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

  // Categoría efectiva del jugador para cálculos (los sin categoría parten en 5ta).
  const miCategoria = NOMBRES_CATEGORIAS.includes(miNivel)
    ? miNivel
    : '5ta Categoría';

  const [partidos, setPartidos] = useState(loadPartidos);

  const [rival, setRival] = useState('');
  const [rivalNivel, setRivalNivel] = useState(miCategoria);
  const [resultado, setResultado] = useState('Ganado');
  const [marcador, setMarcador] = useState('');
  const [fecha, setFecha] = useState(hoyISO);
  const [tocado, setTocado] = useState(false);
  const [status, setStatus] = useState({ type: 'idle', message: '' });

  const [ranking, setRanking] = useState({});
  const [loadingRanking, setLoadingRanking] = useState(true);
  const [rankingError, setRankingError] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState(miCategoria);
  const [ascendiendo, setAscendiendo] = useState(false);

  const cargarRanking = async () => {
    try {
      const response = await fetch('/api/ranking');
      const result = await response.json();

      if (response.ok && result.success && result.data) {
        setRanking(
          result.data.ranking && typeof result.data.ranking === 'object'
            ? result.data.ranking
            : {},
        );
      } else {
        setRankingError('No se pudo cargar la tabla de posiciones.');
      }
    } catch {
      setRankingError('No se pudo conectar con el servidor.');
    } finally {
      setLoadingRanking(false);
    }
  };

  useEffect(() => {
    let activo = true;

    const iniciar = async () => {
      try {
        const response = await fetch('/api/ranking');
        const result = await response.json();

        if (!activo) return;

        if (response.ok && result.success && result.data) {
          setRanking(
            result.data.ranking && typeof result.data.ranking === 'object'
              ? result.data.ranking
              : {},
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

    iniciar();

    return () => {
      activo = false;
    };
  }, []);

  const partidosDeCategoria = useMemo(
    () => partidos.filter((partido) => partido.categoria === miCategoria),
    [partidos, miCategoria],
  );

  const puntos = useMemo(
    () => calcularPuntos(miCategoria, partidos),
    [miCategoria, partidos],
  );

  const victoriasValidas = useMemo(
    () => contarVictoriasValidas(miCategoria, partidos),
    [miCategoria, partidos],
  );

  const requisitoAscenso = ASCENSOS[miCategoria] || null;
  const proximaCategoria = siguienteCategoria(miCategoria);

  const progresoPuntos = requisitoAscenso
    ? Math.min(
        100,
        Math.round((puntos / requisitoAscenso.puntos) * 100),
      )
    : 100;
  const progresoVictorias = requisitoAscenso
    ? Math.min(
        100,
        Math.round((victoriasValidas / requisitoAscenso.victorias) * 100),
      )
    : 100;
  const puedeAscender =
    !!requisitoAscenso &&
    puntos >= requisitoAscenso.puntos &&
    victoriasValidas >= requisitoAscenso.victorias;

  const estadisticas = useMemo(() => {
    const jugados = partidosDeCategoria.length;
    const ganados = partidosDeCategoria.filter(
      (p) => p.resultado === 'Ganado',
    ).length;
    const perdidos = jugados - ganados;
    const efectividad =
      jugados > 0 ? Math.round((ganados / jugados) * 100) : 0;
    const racha = calcularRacha(partidosDeCategoria);

    return { jugados, ganados, perdidos, efectividad, racha };
  }, [partidosDeCategoria]);

  // Agrupa el ranking por categoría, incluye al usuario actual con sus
  // puntos reales y asigna la posición dentro de cada categoría.
  const rankingPorCategoria = useMemo(() => {
    const grupos = {};
    for (const cat of [...NOMBRES_CATEGORIAS, 'Sin categoría']) {
      grupos[cat] = [];
    }

    for (const [categoria, lista] of Object.entries(ranking)) {
      if (!grupos[categoria]) grupos[categoria] = [];
      grupos[categoria] = Array.isArray(lista) ? [...lista] : [];
    }

    const listaYo = grupos[miCategoria];
    const idx = listaYo.findIndex((jugador) => jugador.id === userId);
    const yo = {
      id: userId,
      nombre: miNombre,
      apellido: miApellido,
      nivel: miNivel,
      avatar_url: miAvatar,
      puntos,
      esYo: true,
    };
    if (idx >= 0) {
      listaYo[idx] = { ...listaYo[idx], ...yo };
    } else if (userId) {
      listaYo.push(yo);
    }

    for (const categoria of Object.keys(grupos)) {
      grupos[categoria].sort((a, b) => {
        if (b.puntos !== a.puntos) return b.puntos - a.puntos;
        return `${a.nombre} ${a.apellido}`.localeCompare(
          `${b.nombre} ${b.apellido}`,
          'es',
        );
      });
      grupos[categoria] = grupos[categoria].map((jugador, index) => ({
        ...jugador,
        posicion: index + 1,
      }));
    }

    return grupos;
  }, [ranking, userId, miNombre, miApellido, miNivel, miAvatar, puntos, miCategoria]);

  const miPosicion =
    rankingPorCategoria[miCategoria]?.find((jugador) => jugador.esYo)
      ?.posicion || null;
  const jugadoresEnMiCategoria = rankingPorCategoria[miCategoria]?.length || 0;

  const tablaVisible = rankingPorCategoria[categoriaActiva] || [];
  const totalesPorCategoria = useMemo(() => {
    const totales = {};
    for (const cat of Object.keys(rankingPorCategoria)) {
      totales[cat] = rankingPorCategoria[cat].length;
    }
    return totales;
  }, [rankingPorCategoria]);

  const rivalesSugeridos = useMemo(() => {
    const nombres = new Set();
    for (const lista of Object.values(rankingPorCategoria)) {
      for (const jugador of lista) {
        if (jugador.id !== userId && jugador.nombre) {
          nombres.add(`${jugador.nombre} ${jugador.apellido}`.trim());
        }
      }
    }
    return [...nombres];
  }, [rankingPorCategoria, userId]);

  const pintaPreview = useMemo(() => {
    const relacion = relacionCategorias(miCategoria, rivalNivel);
    const puntosPreview = PUNTOS_RESULTADO[resultado]?.[relacion] ?? 0;
    const valida = resultado === 'Ganado' && relacion !== 'inferior';
    return { relacion, puntos: puntosPreview, valida };
  }, [miCategoria, rivalNivel, resultado]);

  const errors = useMemo(() => {
    const list = {};

    if (!rival.trim()) {
      list.rival = 'Indica el nombre del rival.';
    }

    if (!rivalNivel) {
      list.rivalNivel = 'Selecciona la categoría del rival.';
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
  }, [rival, rivalNivel, fecha, marcador]);

  const isValid = Object.keys(errors).length === 0;

  const handleSubmit = (event) => {
    event.preventDefault();
    setTocado(true);

    if (!isValid) return;

    const nuevoPartido = {
      id: `${Date.now()}`,
      rival: rival.trim(),
      rivalNivel,
      resultado,
      marcador: marcador.trim(),
      fecha,
      categoria: miCategoria,
    };

    const siguientes = [nuevoPartido, ...partidos];
    setPartidos(siguientes);
    persistPartidos(siguientes);

    setRival('');
    setRivalNivel(miCategoria);
    setResultado('Ganado');
    setMarcador('');
    setFecha(hoyISO());
    setTocado(false);
    setStatus({
      type: 'success',
      message: 'Resultado registrado. Tus puntos de categoría se actualizaron.',
    });
  };

  const removePartido = (id) => {
    const siguientes = partidos.filter((partido) => partido.id !== id);
    setPartidos(siguientes);
    persistPartidos(siguientes);
    setStatus({ type: 'idle', message: '' });
  };

  const solicitarAscenso = async () => {
    if (!puedeAscender || !proximaCategoria || !userId) return;

    setAscendiendo(true);
    try {
      const response = await fetch(`/api/profile/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nivel: proximaCategoria }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'No se pudo actualizar la categoría.');
      }

      // Actualiza el perfil local para que el resto de la app lo refleje.
      const stored = getStoredUser();
      if (stored?.profile) {
        stored.profile.nivel = proximaCategoria;
        localStorage.setItem('meettennis_auth', JSON.stringify(stored));
      }

      setCategoriaActiva(proximaCategoria);
      setStatus({
        type: 'success',
        message: `¡Ascendiste a ${proximaCategoria}! Tu desafío comienza de nuevo desde cero.`,
      });
      cargarRanking();
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setAscendiendo(false);
    }
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

  const tabs =
    categoriaActiva === 'Sin categoría' ||
    rankingPorCategoria['Sin categoría']?.length > 0
      ? [...NOMBRES_CATEGORIAS, 'Sin categoría']
      : NOMBRES_CATEGORIAS;

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
                  Compite dentro de tu categoría
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
        <section className="mt-6 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-md">
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
                {miCategoria}
              </span>
            </div>
          </div>

          <div className="mt-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Puntos en esta categoría
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
              {miPosicion
                ? `#${miPosicion} de ${jugadoresEnMiCategoria}`
                : 'Sin posición'}
            </span>
          </div>

          {/* Progreso de ascenso */}
          {requisitoAscenso ? (
            <div className="mt-5 space-y-4 rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                Ascenso a {proximaCategoria}
              </p>

              <div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Puntos acumulados
                    <span className="ml-1 font-semibold text-slate-200">
                      {puntos}/{requisitoAscenso.puntos}
                    </span>
                  </span>
                  <span>{progresoPuntos}%</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-300 transition-all duration-500"
                    style={{ width: `${progresoPuntos}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    Victorias válidas
                    <span className="ml-1 font-semibold text-slate-200">
                      {victoriasValidas}/{requisitoAscenso.victorias}
                    </span>
                  </span>
                  <span>{progresoVictorias}%</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500"
                    style={{ width: `${progresoVictorias}%` }}
                  />
                </div>
              </div>

              {puedeAscender ? (
                <button
                  type="button"
                  onClick={solicitarAscenso}
                  disabled={ascendiendo}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-slate-100 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {ascendiendo ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ArrowUpRight className="h-5 w-5" />
                  )}
                  Ascender a {proximaCategoria}
                </button>
              ) : (
                <p className="text-xs text-slate-500">
                  Te faltan{' '}
                  <span className="font-semibold text-slate-300">
                    {Math.max(0, requisitoAscenso.puntos - puntos)} pts
                  </span>{' '}
                  y{' '}
                  <span className="font-semibold text-slate-300">
                    {Math.max(
                      0,
                      requisitoAscenso.victorias - victoriasValidas,
                    )}{' '}
                    victorias válidas
                  </span>{' '}
                  para ascender. Las victorias válidas son contra rivales de tu
                  categoría o superiores.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-300">
                <Crown className="h-4 w-4" />
                Estás en la máxima categoría del circuito.
              </p>
            </div>
          )}

          {status.type === 'success' && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {status.message}
            </div>
          )}
          {status.type === 'error' && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {status.message}
            </div>
          )}
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
            <p className="text-xs text-slate-400">Partidos en categoría</p>
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
            Los puntos dependen de la categoría del rival: subir cuesta, como
            en el tenis real.
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
            <label className={labelClass} htmlFor="rivalNivel">
              Categoría del rival
            </label>
            <div className="relative">
              <Layers className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                id="rivalNivel"
                name="rivalNivel"
                value={rivalNivel}
                onChange={(event) => {
                  setRivalNivel(event.target.value);
                  setStatus({ type: 'idle', message: '' });
                }}
                className={`${inputBase} appearance-none pl-11 ${borderFor('rivalNivel')}`}
              >
                {CATEGORIAS.map((categoria) => (
                  <option key={categoria.nombre} value={categoria.nombre}>
                    {categoria.nombre}
                  </option>
                ))}
              </select>
            </div>
            {renderError('rivalNivel')}
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

          {/* Vista previa de puntos */}
          <div
            className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${
              pintaPreview.puntos >= 0
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/40 bg-red-500/10 text-red-300'
            }`}
          >
            {pintaPreview.puntos >= 0 ? (
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <TrendingDown className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>
              Este resultado{' '}
              {pintaPreview.puntos >= 0
                ? `suma +${pintaPreview.puntos} pts`
                : `resta ${pintaPreview.puntos} pts`}{' '}
              en {miCategoria}.{' '}
              {pintaPreview.valida
                ? '¡Cuenta como victoria válida para ascender!'
                : pintaPreview.relacion === 'inferior'
                  ? 'Al ser un rival de categoría inferior no cuenta como victoria válida.'
                  : ''}
            </span>
          </div>

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
              Aún no registras partidos. Agrega tu primer resultado para sumar
              puntos en tu categoría.
            </p>
          ) : (
            <ul className="grid gap-3">
              {partidos.map((partido) => {
                const gano = partido.resultado === 'Ganado';
                const enCategoria = partido.categoria === miCategoria;
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
                        <span className="text-slate-500">
                          {' '}
                          · rival:{' '}
                          {partido.rivalNivel || 'Sin categoría'}
                        </span>
                        {!enCategoria && partido.categoria && (
                          <span className="ml-1 rounded-full bg-slate-700/60 px-1.5 py-0.5 text-[10px] text-slate-400">
                            (jugado en {partido.categoria})
                          </span>
                        )}
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

        {/* Categorías del circuito + tabla de posiciones */}
        <section className="mt-6 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4 shadow-2xl backdrop-blur-md">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            <Layers className="h-4 w-4 text-emerald-400" />
            Categorías del circuito
          </h2>
          <div className="grid gap-1.5">
            {tabs.map((categoria) => {
              const activa = categoria === categoriaActiva;
              const esMiCategoria = categoria === miCategoria;
              const numero =
                {
                  '1ra Categoría': '1',
                  '2da Categoría': '2',
                  '3ra Categoría': '3',
                  '4ta Categoría': '4',
                  '5ta Categoría': '5',
                  'Sin categoría': '—',
                }[categoria] || '•';
              const insignia =
                {
                  '1ra Categoría':
                    'bg-amber-400/15 text-amber-300 border-amber-400/40',
                  '2da Categoría':
                    'bg-emerald-400/15 text-emerald-300 border-emerald-400/40',
                  '3ra Categoría':
                    'bg-sky-400/15 text-sky-300 border-sky-400/40',
                  '4ta Categoría':
                    'bg-violet-400/15 text-violet-300 border-violet-400/40',
                  '5ta Categoría':
                    'bg-slate-400/15 text-slate-300 border-slate-400/40',
                  'Sin categoría':
                    'bg-slate-700/40 text-slate-400 border-slate-600/50',
                }[categoria] || 'bg-slate-700/40 text-slate-400 border-slate-600/50';
              const borde = activa
                ? 'border-emerald-500/60 bg-emerald-600/10'
                : 'border-slate-700/50 bg-slate-800/40';

              return (
                <button
                  key={categoria}
                  type="button"
                  onClick={() => setCategoriaActiva(categoria)}
                  aria-pressed={activa}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors hover:border-emerald-500/40 ${borde}`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm font-bold ${insignia}`}
                  >
                    {numero}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span
                        className={`truncate text-sm font-semibold ${
                          activa ? 'text-slate-100' : 'text-slate-300'
                        }`}
                      >
                        {categoria}
                      </span>
                      {esMiCategoria && (
                        <span className="shrink-0 rounded-full bg-emerald-600/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
                          Tú
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-slate-500">
                      {totalesPorCategoria[categoria] || 0}{' '}
                      {totalesPorCategoria[categoria] === 1
                        ? 'jugador'
                        : 'jugadores'}
                    </span>
                  </span>
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      activa
                        ? 'bg-emerald-600 text-slate-100'
                        : 'bg-slate-800 text-slate-600'
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tabla de posiciones de la categoría seleccionada */}
          <div className="mt-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
              <ListOrdered className="h-4 w-4" />
              Tabla de posiciones · {categoriaActiva}
            </h3>

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

            {!loadingRanking && tablaVisible.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/40 p-5 text-center text-sm text-slate-500">
                Aún no hay jugadores registrados en esta categoría.
              </p>
            )}

            {!loadingRanking && tablaVisible.length > 0 && (
              <ul className="grid gap-2">
                {tablaVisible.map((jugador) => {
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
          </div>
        </section>

        {/* Cómo funciona */}
        <section className="mt-6 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-md">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
            <Info className="h-4 w-4 text-emerald-400" />
            ¿Cómo funciona el ranking?
          </h2>
          <ul className="mt-3 grid gap-2 text-xs text-slate-400">
            <li className="flex items-start gap-2">
              <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              Cada categoría tiene su propia tabla de posiciones. Compites
              contra jugadores de tu mismo nivel, como en el tenis real.
            </li>
            <li className="flex items-start gap-2">
              <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              Ganar a un rival de categoría superior suma{' '}
              <span className="font-semibold text-emerald-300">+40 pts</span>,
              a uno igual{' '}
              <span className="font-semibold text-emerald-300">+25 pts</span> y
              a uno inferior{' '}
              <span className="font-semibold text-emerald-300">+10 pts</span>.
              Perder resta puntos.
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              Para ascender necesitas alcanzar los puntos acumulados y las
              victorias válidas (contra rivales de tu categoría o superior):
              5ta→4ta: 200 pts y 10 victorias · 4ta→3ra: 350 pts y 14 ·
              3ra→2da: 500 pts y 18 · 2da→1ra: 700 pts y 22.
            </li>
            <li className="flex items-start gap-2">
              <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
              Al ascender tu perfil se actualiza y tu desafío parte desde cero
              en la nueva categoría. Subir cuesta, como debe ser.
            </li>
          </ul>
        </section>

        <p className="mt-auto pt-10 text-center text-xs text-slate-500">
          Registra tus partidos para escalar posiciones dentro de tu
          categoría.
        </p>
      </div>
    </div>
  );
}

export default RankingView;
