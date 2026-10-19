import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Loader2,
  MessageSquare,
  MessagesSquare,
  Plus,
  Search,
  Send,
  X,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import TennisBackground from '../components/TennisBackground.jsx';
import { apiFetch } from '../lib/api.js';
import { getStoredAuth, haceCuanto, iniciales, nombreCompleto } from '../lib/formato.js';

const inputBase =
  'w-full rounded-xl border border-slate-700/50 bg-slate-800/70 px-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-emerald-500';

function Avatar({ jugador, size = 'h-11 w-11' }) {
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

// Devuelve el otro participante desde una conversación, tanto si viene
// del listado (campo "otro") como si viene cruda (usuario1/usuario2).
function otroDe(conv, miId) {
  if (conv?.otro) return conv.otro;
  if (conv?.usuario1_id === miId) return conv.usuario2;
  return conv?.usuario1;
}

// Lista de conversaciones (sidebar). Se reutiliza en escritorio y móvil.
function ListaConversaciones({ conversaciones, activaId, miId, onAbrir, cargando }) {
  if (cargando) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (conversaciones.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600/15 text-emerald-400">
          <MessageSquare className="h-8 w-8" />
        </span>
        <p className="font-semibold text-slate-200">Aún no tienes chats</p>
        <p className="text-sm text-slate-400">
          Inicia una conversación para coordinar la cancha, la hora y los detalles de tu partido.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversaciones.map((conv) => {
        const otro = otroDe(conv, miId);
        const ultimo = conv.ultimoMensaje;
        const esMio = ultimo?.remitente_id === miId;
        const activa = conv.id === activaId;
        return (
          <button
            type="button"
            key={conv.id}
            onClick={() => onAbrir(conv)}
            className={`flex w-full items-center gap-3 border-b border-slate-700/40 px-4 py-3 text-left transition-colors ${
              activa ? 'bg-emerald-600/15' : 'hover:bg-slate-700/40'
            }`}
          >
            <div className="relative">
              <Avatar jugador={otro} />
              {conv.noLeidos > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[11px] font-bold text-white">
                  {conv.noLeidos}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate font-semibold text-slate-100">{nombreCompleto(otro)}</p>
                {ultimo && (
                  <span className="shrink-0 text-[11px] text-slate-500">
                    {haceCuanto(ultimo.created_at)}
                  </span>
                )}
              </div>
              <p
                className={`truncate text-sm ${
                  conv.noLeidos > 0 ? 'font-medium text-slate-200' : 'text-slate-400'
                }`}
              >
                {ultimo ? `${esMio ? 'Tú: ' : ''}${ultimo.contenido}` : 'Sin mensajes todavía'}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ChatView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const miId = getStoredAuth()?.user?.id;

  const [conversaciones, setConversaciones] = useState([]);
  const [activa, setActiva] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Selector "Nuevo chat".
  const [mostrandoNuevo, setMostrandoNuevo] = useState(false);
  const [jugadores, setJugadores] = useState([]);
  const [buscandoJugadores, setBuscandoJugadores] = useState(false);
  const [filtro, setFiltro] = useState('');

  const finRef = useRef(null);

  const cargarConversaciones = useCallback(async () => {
    try {
      const response = await apiFetch('/api/chat/conversations');
      const result = await response.json();
      if (response.ok && result.success) {
        setConversaciones(result.data || []);
      }
    } catch {
      // Silencioso: se reintenta en el siguiente ciclo de polling.
    }
  }, []);

  // Carga los mensajes de la conversación activa y la marca como leída.
  const cargarMensajes = useCallback(
    async (convId) => {
      if (!convId) return;
      try {
        const response = await apiFetch(`/api/chat/conversations/${convId}/messages`);
        const result = await response.json();
        if (response.ok && result.success) {
          setMensajes(result.data.mensajes || []);
          setActiva((prev) => (prev ? { ...prev, noLeidos: 0 } : prev));
        }
      } catch {
        // Silencioso.
      }
    },
    [],
  );

  // Abre una conversación existente (desde la lista).
  const abrirConversacion = (conv) => {
    setActiva(conv);
    setError('');
    cargarMensajes(conv.id);
  };

  // Crea (o reutiliza) la conversación con un jugador y la abre.
  const abrirConUsuario = async (usuarioId) => {
    setMostrandoNuevo(false);
    setError('');
    try {
      const response = await apiFetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: usuarioId }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setError(result.error || 'No se pudo iniciar el chat.');
        return;
      }
      setActiva(result.data);
      cargarMensajes(result.data.id);
      cargarConversaciones();
    } catch {
      setError('No se pudo conectar con el servidor.');
    }
  };

  const enviarMensaje = async (e) => {
    e.preventDefault();
    const contenido = texto.trim();
    if (!contenido || !activa || enviando) return;

    setEnviando(true);
    try {
      const response = await apiFetch(`/api/chat/conversations/${activa.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenido }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        setMensajes((prev) => [...prev, result.data]);
        setTexto('');
        cargarConversaciones();
      } else {
        setError(result.error || 'No se pudo enviar el mensaje.');
      }
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setEnviando(false);
    }
  };

  const abrirNuevoChat = async () => {
    setMostrandoNuevo(true);
    setBuscandoJugadores(true);
    try {
      const response = await apiFetch('/api/chat/players');
      const result = await response.json();
      if (response.ok && result.success) {
        setJugadores(result.data || []);
      }
    } catch {
      setJugadores([]);
    } finally {
      setBuscandoJugadores(false);
    }
  };

  // Carga inicial: lista de conversaciones y, si viene ?usuario=, abre
  // el chat con ese jugador.
  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const response = await apiFetch('/api/chat/conversations');
        const result = await response.json();
        if (activo && response.ok && result.success) {
          setConversaciones(result.data || []);
        }
      } catch {
        // Silencioso.
      } finally {
        if (activo) setCargando(false);
      }
    })();

    const usuarioParam = searchParams.get('usuario');
    if (usuarioParam) {
      abrirConUsuario(usuarioParam);
      setSearchParams({}, { replace: true });
    }

    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling: refresca la lista de conversaciones y, si hay una activa,
  // también sus mensajes (para recibir respuestas en tiempo real).
  useEffect(() => {
    const intervalo = setInterval(() => {
      cargarConversaciones();
      if (activa?.id) cargarMensajes(activa.id);
    }, 4000);
    return () => clearInterval(intervalo);
  }, [activa?.id, cargarConversaciones, cargarMensajes]);

  // Auto-scroll al último mensaje.
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  const jugadoresFiltrados = jugadores.filter((j) =>
    nombreCompleto(j).toLowerCase().includes(filtro.toLowerCase()),
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-900 px-4 py-5">
      <TennisBackground />

      <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-5xl flex-col">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => (activa ? setActiva(null) : navigate('/'))}
              aria-label="Volver"
              className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-2.5 text-slate-400 shadow-2xl backdrop-blur-md transition-colors hover:border-emerald-500/50 hover:text-emerald-400"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <BrandLogo className="h-10" />
          </div>
          <button
            type="button"
            onClick={abrirNuevoChat}
            className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-600/15 px-3 py-2.5 text-sm font-semibold text-emerald-300 shadow-2xl backdrop-blur-md transition-colors hover:bg-emerald-600/25"
          >
            <Plus className="h-4 w-4" />
            Nuevo chat
          </button>
        </header>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-1 gap-3 overflow-hidden">
          {/* ---------- Sidebar de conversaciones (escritorio) ---------- */}
          <aside className="hidden w-72 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/60 shadow-2xl backdrop-blur-md sm:flex">
            <div className="flex items-center gap-2 border-b border-slate-700/50 bg-slate-800/80 px-4 py-3">
              <MessagesSquare className="h-5 w-5 text-emerald-400" />
              <h2 className="font-semibold text-slate-100">Conversaciones</h2>
            </div>
            <ListaConversaciones
              conversaciones={conversaciones}
              activaId={activa?.id}
              miId={miId}
              onAbrir={abrirConversacion}
              cargando={cargando}
            />
          </aside>

          {/* ---------- Lista de conversaciones (móvil, sin chat activo) ---------- */}
          {!activa && (
            <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/60 shadow-2xl backdrop-blur-md sm:hidden">
              <div className="flex items-center gap-2 border-b border-slate-700/50 bg-slate-800/80 px-4 py-3">
                <MessagesSquare className="h-5 w-5 text-emerald-400" />
                <h2 className="font-semibold text-slate-100">Conversaciones</h2>
              </div>
              <ListaConversaciones
                conversaciones={conversaciones}
                activaId={activa?.id}
                miId={miId}
                onAbrir={abrirConversacion}
                cargando={cargando}
              />
            </div>
          )}

          {/* ---------- Hilo de mensajes (centro) ---------- */}
          <div
            className={`flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/60 shadow-2xl backdrop-blur-md ${
              activa ? 'flex' : 'hidden sm:flex'
            }`}
          >
            {activa ? (
              <>
                <div className="flex items-center gap-3 border-b border-slate-700/50 bg-slate-800/80 px-4 py-3">
                  <Avatar jugador={otroDe(activa, miId)} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-100">
                      {nombreCompleto(otroDe(activa, miId))}
                    </p>
                    <p className="text-xs text-slate-400">
                      {otroDe(activa, miId)?.nivel || 'Jugador'}
                    </p>
                  </div>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
                  {mensajes.length === 0 ? (
                    <p className="py-10 text-center text-sm text-slate-500">
                      Aún no hay mensajes. ¡Coordina la cancha y la hora!
                    </p>
                  ) : (
                    mensajes.map((m) => {
                      const mio = m.remitente_id === miId;
                      return (
                        <div key={m.id} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-lg ${
                              mio
                                ? 'rounded-br-sm bg-emerald-600 text-white'
                                : 'rounded-bl-sm bg-slate-700/70 text-slate-100'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{m.contenido}</p>
                            <p
                              className={`mt-1 text-right text-[10px] ${
                                mio ? 'text-emerald-100/80' : 'text-slate-400'
                              }`}
                            >
                              {haceCuanto(m.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={finRef} />
                </div>

                <form
                  onSubmit={enviarMensaje}
                  className="flex items-center gap-2 border-t border-slate-700/50 bg-slate-800/80 p-3"
                >
                  <input
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    maxLength={1000}
                    className={inputBase}
                  />
                  <button
                    type="submit"
                    disabled={!texto.trim() || enviando}
                    aria-label="Enviar mensaje"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {enviando ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600/15 text-emerald-400">
                  <MessageSquare className="h-8 w-8" />
                </span>
                <p className="font-semibold text-slate-200">Selecciona una conversación</p>
                <p className="text-sm text-slate-400">
                  Elige un rival de la lista para coordinar la cancha y la hora del partido.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Selector "Nuevo chat" ---------- */}
      {mostrandoNuevo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 backdrop-blur-sm sm:items-center">
          <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl border border-slate-700/50 bg-slate-900 p-4 shadow-2xl sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-slate-100">Nuevo chat</h3>
              <button
                type="button"
                onClick={() => setMostrandoNuevo(false)}
                aria-label="Cerrar"
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar jugador..."
                className={`${inputBase} pl-9`}
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              {buscandoJugadores ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                </div>
              ) : jugadoresFiltrados.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-500">
                  Solo puedes chatear con jugadores con los que ya tienes un partido confirmado
                  para jugar.
                </p>
              ) : (
                jugadoresFiltrados.map((j) => (
                  <button
                    type="button"
                    key={j.id}
                    onClick={() => abrirConUsuario(j.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-800"
                  >
                    <Avatar jugador={j} size="h-10 w-10" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-100">{nombreCompleto(j)}</p>
                      <p className="text-xs text-slate-400">{j.nivel || 'Jugador'}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatView;
