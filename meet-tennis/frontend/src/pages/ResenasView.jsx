import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Save,
  Star,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import TennisBackground from '../components/TennisBackground.jsx';
import { apiFetch } from '../lib/api.js';
import {
  getStoredAuth,
  haceCuanto,
  iniciales,
  nombreCompleto,
} from '../lib/formato.js';

const COMENTARIO_MAX = 300;

const labelClass = 'mb-1.5 block text-sm font-medium text-slate-400';
const tarjeta =
  'rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4 shadow-2xl backdrop-blur-md';
const tituloSeccion =
  'mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400';

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

// Estrellas: si recibe onChange son interactivas (selector), si no,
// solo muestran la calificación.
function Estrellas({ valor, onChange, size = 'h-5 w-5' }) {
  const [hover, setHover] = useState(0);
  const activo = onChange ? hover || valor : valor;

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}
          onClick={() => onChange && onChange(n)}
          aria-label={`${n} estrella${n > 1 ? 's' : ''}`}
          className={onChange ? 'transition-transform hover:scale-110' : 'cursor-default'}
        >
          <Star
            className={`${size} ${
              n <= activo
                ? 'fill-amber-400 text-amber-400'
                : 'fill-slate-700 text-slate-600'
            }`}
          />
        </button>
      ))}
    </div>
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

function ResenasView() {
  const miId = getStoredAuth()?.user?.id;

  const [jugadores, setJugadores] = useState([]);
  const [recibidas, setRecibidas] = useState([]);
  const [miPromedio, setMiPromedio] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [recargar, setRecargar] = useState(0);

  // Formulario de reseña.
  const [jugadorId, setJugadorId] = useState('');
  const [calificacion, setCalificacion] = useState(0);
  const [comentario, setComentario] = useState('');
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [statusForm, setStatusForm] = useState({ type: 'idle', message: '' });

  // Acciones sobre reseñas propias (borrar).
  const [procesando, setProcesando] = useState(null);
  const [statusLista, setStatusLista] = useState({ type: 'idle', message: '' });

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      try {
        const response = await apiFetch('/api/reviews');
        const result = await response.json();

        if (!activo) return;

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'No se pudieron cargar las reseñas.');
        }

        setJugadores(result.data.jugadores || []);
        setRecibidas(result.data.recibidas || []);
        setMiPromedio(result.data.miPromedio);
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

  const jugadorSeleccionado = jugadores.find((j) => j.id === jugadorId) || null;
  const editando = jugadorSeleccionado?.miResena || null;

  // Al elegir un jugador, si ya le dejé reseña se precarga para editarla.
  const handleSeleccionarJugador = (id) => {
    setJugadorId(id);
    const jugador = jugadores.find((j) => j.id === id);
    if (jugador?.miResena) {
      setCalificacion(jugador.miResena.calificacion);
      setComentario(jugador.miResena.comentario || '');
    } else {
      setCalificacion(0);
      setComentario('');
    }
    setStatusForm({ type: 'idle', message: '' });
    setTocado(false);
  };

  const errors = useMemo(() => {
    const list = {};
    if (!jugadorId) list.jugador = 'Selecciona a un jugador.';
    if (!calificacion) list.calificacion = 'Elige una calificación de 1 a 5 estrellas.';
    return list;
  }, [jugadorId, calificacion]);

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
      const esEdicion = !!editando;
      const response = await apiFetch(
        esEdicion ? `/api/reviews/${editando.id}` : '/api/reviews',
        {
          method: esEdicion ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(esEdicion ? {} : { jugador_id: jugadorId }),
            calificacion,
            comentario: comentario.trim() || null,
          }),
        },
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'No se pudo guardar la reseña.');
      }

      setStatusForm({
        type: 'success',
        message: esEdicion
          ? 'Reseña actualizada correctamente.'
          : `Reseña publicada para ${nombreCompleto(jugadorSeleccionado)}.`,
      });
      setRecargar((n) => n + 1);
    } catch (err) {
      setStatusForm({ type: 'error', message: err.message });
    } finally {
      setEnviando(false);
    }
  };

  const eliminarResena = async (id) => {
    setProcesando(id);
    setStatusLista({ type: 'idle', message: '' });

    try {
      const response = await apiFetch(`/api/reviews/${id}`, { method: 'DELETE' });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'No se pudo eliminar la reseña.');
      }

      setStatusLista({ type: 'success', message: 'Reseña eliminada.' });
      setRecargar((n) => n + 1);
    } catch (err) {
      setStatusLista({ type: 'error', message: err.message });
    } finally {
      setProcesando(null);
    }
  };

  // Reseñas que dejé (vienen dentro de cada jugador).
  const enviadas = jugadores.filter((j) => j.miResena);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900 px-4 py-8">
      <TennisBackground />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col">
        <header className="flex items-start justify-between gap-4">
          <div>
            <BrandLogo className="mb-4 h-16 sm:h-20" />
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600/15 text-emerald-400">
                <MessageSquare className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-2xl font-bold leading-tight text-slate-100">
                  Reseñas de Jugadores
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  Califica la confiabilidad de tus rivales
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

        {/* Dejar una reseña */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-8 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-md"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Dejar una reseña
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Cuenta cómo fue tu experiencia: si asistió, llegó a tiempo, su
            actitud en la cancha, etc. Una reseña por jugador.
          </p>

          <div className="mt-4">
            <span className={labelClass}>Jugador</span>
            <div className="mt-1.5 max-h-56 space-y-1.5 overflow-y-auto overscroll-contain rounded-xl border border-slate-700/50 bg-slate-800/50 p-2">
              {cargando ? (
                <p className="flex items-center justify-center gap-2 p-4 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando jugadores...
                </p>
              ) : jugadores.length === 0 ? (
                <p className="p-4 text-center text-sm text-slate-500">
                  No hay jugadores disponibles.
                </p>
              ) : (
                jugadores.map((jugador) => {
                  const seleccionado = jugador.id === jugadorId;
                  return (
                    <button
                      type="button"
                      key={jugador.id}
                      onClick={() => handleSeleccionarJugador(jugador.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                        seleccionado
                          ? 'border-emerald-500/60 bg-emerald-500/10'
                          : 'border-transparent hover:border-slate-600/60 hover:bg-slate-700/40'
                      }`}
                    >
                      <Avatar jugador={jugador} size="h-10 w-10" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-100">
                          {nombreCompleto(jugador)}
                        </p>
                        <p className="text-xs text-slate-400">
                          {jugador.promedio
                            ? `${jugador.promedio}★ · ${jugador.totalResenas} ${
                                jugador.totalResenas === 1 ? 'reseña' : 'reseñas'
                              }`
                            : 'Sin reseñas aún'}
                        </p>
                      </div>
                      {seleccionado && (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
            {renderError('jugador')}
          </div>

          <div className="mt-5">
            <span className={labelClass}>Calificación</span>
            <div className="mt-2 flex items-center gap-3">
              <Estrellas valor={calificacion} onChange={setCalificacion} />
              <span className="text-sm text-slate-400">
                {calificacion ? `${calificacion}/5` : 'Toca las estrellas'}
              </span>
            </div>
            {renderError('calificacion')}
          </div>

          <div className="mt-5">
            <label className={labelClass} htmlFor="comentario">
              Comentario (opcional)
            </label>
            <textarea
              id="comentario"
              rows={3}
              maxLength={COMENTARIO_MAX}
              value={comentario}
              onChange={(event) => {
                setComentario(event.target.value);
                setStatusForm({ type: 'idle', message: '' });
              }}
              placeholder="Ej: Llegó puntual y jugamos un gran partido..."
              className="mt-1 w-full resize-none rounded-xl border border-slate-700/50 bg-slate-800/70 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-emerald-500"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {comentario.length}/{COMENTARIO_MAX}
              </span>
            </div>
          </div>

          {editando && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-300">
              <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
              Ya dejaste una reseña para este jugador: al guardar la actualizarás.
            </p>
          )}

          <Aviso status={statusForm} />

          <button
            type="submit"
            disabled={enviando}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-slate-100 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : editando ? (
              <Save className="h-5 w-5" />
            ) : (
              <Star className="h-5 w-5" />
            )}
            {enviando
              ? 'Guardando...'
              : editando
                ? 'Actualizar reseña'
                : 'Publicar reseña'}
          </button>
        </form>

        {/* Reseñas que recibí */}
        <section className="mt-8">
          <h2 className={tituloSeccion}>
            <Star className="h-4 w-4 text-amber-300" />
            Reseñas que recibí
          </h2>

          {cargando ? (
            <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/40 p-5 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando reseñas...
            </p>
          ) : recibidas.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/40 p-5 text-center text-sm text-slate-500">
              Aún no recibes reseñas. Juega con otros jugadores para que te
              califiquen.
            </p>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
                <Estrellas valor={Math.round(miPromedio)} size="h-6 w-6" />
                <div>
                  <p className="text-sm font-semibold text-slate-100">
                    {miPromedio} de 5
                  </p>
                  <p className="text-xs text-slate-400">
                    {recibidas.length}{' '}
                    {recibidas.length === 1 ? 'reseña' : 'reseñas'}
                  </p>
                </div>
              </div>

              <ul className="grid max-h-96 gap-3 overflow-y-auto overscroll-contain pr-1">
                {recibidas.map((resena) => (
                  <li key={resena.id} className={tarjeta}>
                    <div className="flex items-start gap-3">
                      <Avatar jugador={resena.autor} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-100">
                          {nombreCompleto(resena.autor)}
                        </p>
                        <div className="mt-1">
                          <Estrellas valor={resena.calificacion} size="h-4 w-4" />
                        </div>
                        {resena.comentario && (
                          <p className="mt-1.5 text-sm text-slate-300">
                            {resena.comentario}
                          </p>
                        )}
                        <p className="mt-1.5 text-xs text-slate-500">
                          {haceCuanto(resena.created_at)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Reseñas que dejé */}
        <section className="mt-8">
          <h2 className={tituloSeccion}>
            <MessageSquare className="h-4 w-4" />
            Reseñas que dejé
          </h2>

          <Aviso status={statusLista} />

          {cargando ? (
            <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/40 p-5 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando reseñas...
            </p>
          ) : enviadas.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/40 p-5 text-center text-sm text-slate-500">
              Aún no has dejado reseñas.
            </p>
          ) : (
            <ul className="grid max-h-96 gap-3 overflow-y-auto overscroll-contain pr-1">
              {enviadas.map((jugador) => (
                <li key={jugador.miResena.id} className={`${tarjeta} flex items-start gap-3`}>
                  <Avatar jugador={jugador} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-100">
                      {nombreCompleto(jugador)}
                    </p>
                    <div className="mt-1">
                      <Estrellas
                        valor={jugador.miResena.calificacion}
                        size="h-4 w-4"
                      />
                    </div>
                    {jugador.miResena.comentario && (
                      <p className="mt-1.5 text-sm text-slate-300">
                        {jugador.miResena.comentario}
                      </p>
                    )}
                    <p className="mt-1.5 text-xs text-slate-500">
                      {haceCuanto(jugador.miResena.created_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => eliminarResena(jugador.miResena.id)}
                    disabled={procesando === jugador.miResena.id}
                    aria-label="Eliminar reseña"
                    className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-2 text-slate-400 transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-60"
                  >
                    {procesando === jugador.miResena.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-auto pt-10 text-center text-xs text-slate-500">
          Las reseñas ayudan a que la comunidad sea más confiable.
        </p>
      </div>
    </div>
  );
}

export default ResenasView;