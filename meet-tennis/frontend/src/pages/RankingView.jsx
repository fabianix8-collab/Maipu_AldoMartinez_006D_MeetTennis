import LanguageSelector from '../components/LanguageSelector.jsx';
import { useLanguage } from '../lib/i18n.js';
import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Crown,
  Flame,
  Layers,
  ListOrdered,
  Loader2,
  Percent,
  Swords,
  TrendingDown,
  TrendingUp,
  Trophy,
  User,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import TennisBackground from '../components/TennisBackground.jsx';
import { RankingGuide, RankingProgress } from '../components/RankingHelp.jsx';
import { apiFetch } from '../lib/api.js';
import { getStoredAuth, iniciales } from '../lib/formato.js';

const NOMBRES_CATEGORIAS = [
  '1ra Categoría',
  '2da Categoría',
  '3ra Categoría',
  '4ta Categoría',
  '5ta Categoría',
];

function RankingView() {
  const { t } = useLanguage();
  const storedUser = getStoredAuth();
  const profile = storedUser?.profile || {};
  const userId = storedUser?.user?.id || profile.id || '';

  const miNombre = profile.nombre || 'Deportista';
  const miApellido = profile.apellido || '';
  const miAvatar = profile.avatar_url || null;

  // Todo el ranking (puntos, posiciones, requisitos) lo calcula el
  // servidor a partir de los partidos confirmados.
  const [ranking, setRanking] = useState({});
  const [yo, setYo] = useState(null);
  const [reglas, setReglas] = useState(null);
  const [loadingRanking, setLoadingRanking] = useState(true);
  const [rankingError, setRankingError] = useState('');
  const [recargar, setRecargar] = useState(0);
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  const [ascendiendo, setAscendiendo] = useState(false);
  const [status, setStatus] = useState({ type: 'idle', message: '' });

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      try {
        const response = await apiFetch('/api/ranking');
        const result = await response.json();

        if (!activo) return;

        if (response.ok && result.success && result.data) {
          setRanking(result.data.ranking || {});
          setYo(result.data.yo);
          setReglas(result.data.reglas?.ascenso ? result.data.reglas : null);
          setRankingError('');
        } else {
          setRankingError(result.error || 'No se pudo cargar la tabla de posiciones.');
        }
      } catch {
        if (activo) setRankingError('No se pudo conectar con el servidor.');
      } finally {
        if (activo) setLoadingRanking(false);
      }
    };

    cargar();

    return () => {
      activo = false;
    };
  }, [recargar]);

  const miCategoria = yo?.categoria || '5ta Categoría';
  const miNivel = yo?.nivel || profile.nivel;
  const puntos = yo?.puntos ?? 0;
  const proximaCategoria = yo?.proximaCategoria ?? null;
  const puedeAscender = !!yo?.puedeAscender;
  const miPosicion = yo?.posicion ?? null;
  const jugadoresEnMiCategoria = yo?.totalCategoria ?? 0;

  const estadisticas = {
    jugados: yo?.jugados ?? 0,
    ganados: yo?.ganados ?? 0,
    perdidos: yo?.perdidos ?? 0,
    efectividad: yo?.efectividad ?? 0,
    racha: yo?.racha ?? null,
  };

  // Mientras el usuario no elija otra, se muestra la tabla de su grupo.
  const grupoPropio = NOMBRES_CATEGORIAS.includes(miNivel) ? miNivel : 'Sin categoría';
  const categoriaVisible = categoriaActiva || grupoPropio;

  const rankingPorCategoria = Object.fromEntries(Object.entries(ranking).map(([categoria, lista]) => [
      categoria, (lista || []).map((jugador) => ({
        ...jugador,
        esYo: jugador.id === userId,
      })),
  ]));

  const tablaVisible = rankingPorCategoria[categoriaVisible] || [];
  const totalesPorCategoria = Object.fromEntries(
    Object.entries(rankingPorCategoria).map(([categoria, jugadores]) => [categoria, jugadores.length]),
  );

  const solicitarAscenso = async () => {
    if (!puedeAscender || !proximaCategoria || !userId) return;

    setAscendiendo(true);
    try {
      const response = await apiFetch(`/api/profile/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nivel: proximaCategoria }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'No se pudo actualizar la categoría.');
      }

      // Actualiza el perfil local para que el resto de la app lo refleje.
      const stored = getStoredAuth();
      if (stored?.profile) {
        stored.profile.nivel = proximaCategoria;
        localStorage.setItem('meettennis_auth', JSON.stringify(stored));
      }

      setCategoriaActiva(proximaCategoria);
      setStatus({
        type: 'success',
        message: `¡Ascendiste a ${proximaCategoria}! Tu desafío comienza de nuevo desde cero.`,
      });
      setRecargar((n) => n + 1);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setAscendiendo(false);
    }
  };

  const tabs =
    categoriaVisible === 'Sin categoría' ||
    rankingPorCategoria['Sin categoría']?.length > 0
      ? [...NOMBRES_CATEGORIAS, 'Sin categoría']
      : NOMBRES_CATEGORIAS;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-slate-900 px-4 py-8">
      <TennisBackground />

      <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md flex-col">
        <header className="flex items-start justify-between gap-4">
          <div>
            <BrandLogo className="mb-4 h-16 sm:h-20" />
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600/15 text-emerald-400">
                <Trophy className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-2xl font-bold leading-tight text-slate-100">{t("Mi Ranking")}</h1>
                <p className="mt-1 text-sm text-slate-400">{t("Compite dentro de tu categoría")}</p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <Link
              to="/"
              aria-label={t("Volver al inicio")}
              className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-2.5 text-slate-400 shadow-2xl backdrop-blur-md transition-colors hover:border-emerald-500/50 hover:text-emerald-300"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <LanguageSelector />
          </div>
        </header>


        {/* Tarjeta principal: puntos, categoría y posición */}
        <section className="mt-6 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-4">
            <span className="relative inline-flex shrink-0 rounded-full bg-gradient-to-tr from-emerald-500 via-emerald-400 to-lime-300 p-[2px] shadow-lg">
              {miAvatar ? (
                <img
                  src={miAvatar}
                  alt={t("Foto de perfil de {0}", { 0: t(miNombre) })}
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
                {t(`${miNombre} ${miApellido}`.trim())}
              </h2>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <Trophy className="h-3.5 w-3.5" />
                {t(miCategoria)}
              </span>
            </div>
          </div>

          <div className="mt-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("Puntos en esta categoría")}</p>
              <p className="mt-1 text-4xl font-bold text-slate-100">
                {t(puntos)}
                <span className="ml-1 text-sm font-medium text-slate-500">{t("pts")}</span>
              </p>
            </div>

            <span className="inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-300">
              <Crown className="h-4 w-4" />
              {miPosicion ? t("#{0} de {1}", { 0: t(miPosicion), 1: t(jugadoresEnMiCategoria) }) : t('Sin posición')}
            </span>
          </div>

          <p className="mt-4 text-sm text-slate-400">{t('Los puntos determinan tu posición dentro de tu categoría.')}</p>
          <a href="#reglas-ranking" className="mt-2 inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-emerald-300 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">{t('Entender los puntos y el ascenso')}</a>

          {status.type === 'success' && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {t(status.message)}
            </div>
          )}
          {status.type === 'error' && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {t(status.message)}
            </div>
          )}
        </section>

        {!loadingRanking && !rankingError && yo && reglas && (
          <RankingProgress yo={yo} requisitos={reglas.ascenso} ascendiendo={ascendiendo} onAscender={solicitarAscenso} />
        )}

        {/* Resumen de estadísticas */}
        <section className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4 shadow-2xl backdrop-blur-md">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-400">
              <Swords className="h-5 w-5" />
            </span>
            <p className="mt-3 text-2xl font-bold text-slate-100">
              {t(estadisticas.jugados)}
            </p>
            <p className="text-xs text-slate-400">{t("Partidos en categoría")}</p>
          </div>

          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4 shadow-2xl backdrop-blur-md">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-400">
              <Percent className="h-5 w-5" />
            </span>
            <p className="mt-3 text-2xl font-bold text-slate-100">
              {t(estadisticas.efectividad)}%
            </p>
            <p className="text-sm text-slate-300">{t('Efectividad general')}</p>
            <p className="mt-1 text-xs text-slate-400">{t('Victorias ante rivales de cualquier categoría')}</p>
          </div>

          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4 shadow-2xl backdrop-blur-md">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </span>
            <p className="mt-3 text-2xl font-bold text-slate-100">
              {t(estadisticas.ganados)}
            </p>
            <p className="text-xs text-slate-400">{t("Partidos ganados")}</p>
          </div>

          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4 shadow-2xl backdrop-blur-md">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
              <TrendingDown className="h-5 w-5" />
            </span>
            <p className="mt-3 text-2xl font-bold text-slate-100">
              {t(estadisticas.perdidos)}
            </p>
            <p className="text-xs text-slate-400">{t("Partidos perdidos")}</p>
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
            <p className="text-sm text-slate-300">{t("Racha actual:")}{' '}
              <span
                className={`font-semibold ${
                  estadisticas.racha.resultado === 'Ganado'
                    ? 'text-emerald-300'
                    : 'text-red-300'
                }`}
              >
                {t(estadisticas.racha.cantidad)}{' '}
                {estadisticas.racha.cantidad === 1 ? t('partido') : t('partidos')}{' '}
                {estadisticas.racha.resultado === 'Ganado' ? t('ganado') : t('perdido')}
                {estadisticas.racha.cantidad === 1 ? '' : t('s')}
              </span>
            </p>
          </div>
        )}

        {/* Los resultados se registran y confirman en Mis Partidos */}
        <Link
          to="/mis-partidos"
          className="mt-6 flex items-center gap-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 shadow-2xl backdrop-blur-md transition-colors hover:bg-emerald-500/15"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600/20 text-emerald-300">
            <ClipboardCheck className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-100">{t("Registrar un resultado")}</span>
            <span className="mt-0.5 block text-xs text-slate-400">{t("Los puntos se suman cuando tu rival confirma el partido.")}</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-emerald-300" />
        </Link>

        {/* Categorías del circuito + tabla de posiciones */}
        <section className="mt-6 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4 shadow-2xl backdrop-blur-md">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            <Layers className="h-4 w-4 text-emerald-400" />{t("Categorías del circuito")}</h2>
          <div className="grid gap-1.5">
            {tabs.map((categoria) => {
              const activa = categoria === categoriaVisible;
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
                    {t(numero)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span
                        className={`truncate text-sm font-semibold ${
                          activa ? 'text-slate-100' : 'text-slate-300'
                        }`}
                      >
                        {t(categoria)}
                      </span>
                      {esMiCategoria && (
                        <span className="shrink-0 rounded-full bg-emerald-600/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200">{t("Tú")}</span>
                      )}
                    </span>
                    <span className="text-xs text-slate-500">
                      {totalesPorCategoria[categoria] || 0}{' '}
                      {totalesPorCategoria[categoria] === 1 ? t('jugador') : t('jugadores')}
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
              <ListOrdered className="h-4 w-4" />{t("Tabla de posiciones · ")}{t(categoriaVisible)}
            </h3>

            {loadingRanking ? (
              <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/40 p-5 text-center text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />{t("Cargando jugadores...")}</p>
            ) : rankingError ? (
              <p className="mb-3 flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {t(rankingError)}
              </p>
            ) : null}

            {!loadingRanking && tablaVisible.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/40 p-5 text-center text-sm text-slate-500">{t("Aún no hay jugadores registrados en esta categoría.")}</p>
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
                            alt={t("Foto de {0}", { 0: jugador.nombre })}
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
                          {`${jugador.nombre} ${jugador.apellido}`.trim() || t('Jugador')}
                          {jugador.esYo && (
                            <span className="ml-2 rounded-full bg-emerald-600/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">{t("Tú")}</span>
                          )}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {t(jugador.nivel)}
                        </p>
                      </div>

                      <span className="shrink-0 text-sm font-bold text-slate-100">
                        {t(jugador.puntos)}
                        <span className="ml-1 text-xs font-medium text-slate-500">{t("pts")}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <RankingGuide reglas={reglas} />

        <p className="mt-auto pt-10 text-center text-xs text-slate-500">{t("Registra tus partidos para escalar posiciones dentro de tu categoría.")}</p>
      </div>
    </div>
  );
}

export default RankingView;
