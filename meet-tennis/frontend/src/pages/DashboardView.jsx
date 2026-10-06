import { useEffect, useState } from 'react';
import {
  CalendarClock,
  ClipboardCheck,
  LogOut,
  MapPin,
  Swords,
  Trophy,
  User,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
import TennisBackground from '../components/TennisBackground.jsx';
import { apiFetch } from '../lib/api.js';

// "ancho": ocupa las dos columnas. "aviso": clave del contador de pendientes.
const NAV_ITEMS = [
  { title: 'Buscar Partido', Icon: Swords, to: '/buscar-partido', ancho: true, aviso: 'solicitudes' },
  { title: 'Mis Partidos', Icon: ClipboardCheck, to: '/mis-partidos', aviso: 'partidos' },
  { title: 'Mi Ranking', Icon: Trophy, to: '/ranking' },
  { title: 'Mi Disponibilidad', Icon: CalendarClock, to: '/disponibilidad' },
  { title: 'Canchas Cercanas', Icon: MapPin, to: '/canchas' },
  { title: 'Mi Perfil', Icon: User, to: '/perfil', ancho: true },
];

const TEXTO_AVISO = {
  solicitudes: (n) => `${n} ${n === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}`,
  partidos: (n) => `${n} por confirmar`,
};

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('meettennis_auth') || 'null');
  } catch {
    return null;
  }
}

function DashboardView() {
  const navigate = useNavigate();
  const storedUser = getStoredUser();

  const firstName = storedUser?.profile?.nombre || 'Deportista';
  const avatarUrl = storedUser?.profile?.avatar_url || null;

  // Avisos de la campana y contadores de pendientes de cada sección.
  const [notificaciones, setNotificaciones] = useState({
    avisos: [],
    noLeidos: 0,
    pendientes: { solicitudes: 0, partidos: 0 },
  });
  const [recargarAvisos, setRecargarAvisos] = useState(0);

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      try {
        const response = await apiFetch('/api/notifications');
        const result = await response.json();
        if (activo && response.ok && result.success) {
          setNotificaciones(result.data);
        }
      } catch {
        // Silencioso: el menú funciona igual sin avisos.
      }
    };

    cargar();

    return () => {
      activo = false;
    };
  }, [recargarAvisos]);

  // Confirma (o no) la asistencia desde la campana. Devuelve un mensaje
  // de error para mostrarlo en el aviso, o null si salió bien.
  const responderAsistencia = async (solicitudId, asiste) => {
    try {
      const response = await apiFetch(`/api/matchmaking/requests/${solicitudId}/asistencia`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asiste }),
      });
      const result = await response.json();
      setRecargarAvisos((n) => n + 1);
      return response.ok && result.success
        ? null
        : result.error || 'No se pudo guardar tu respuesta.';
    } catch {
      return 'No se pudo conectar con el servidor.';
    }
  };

  // Al abrir la campana, las novedades pasan a leídas. Los avisos que
  // requieren respuesta siguen contando hasta que se respondan.
  const marcarVistos = () => {
    if (!notificaciones.avisos.some((a) => a.nuevo)) return;

    setNotificaciones((prev) => ({
      ...prev,
      avisos: prev.avisos.map((a) => ({ ...a, nuevo: false })),
      noLeidos: prev.avisos.filter((a) => a.tipo === 'accion').length,
    }));
    apiFetch('/api/notifications/vistos', { method: 'POST' }).catch(() => {});
  };

  const handleLogout = () => {
    localStorage.removeItem('meettennis_auth');
    navigate('/login');
  };

  return (
    <div className="relative h-screen overflow-hidden bg-slate-900 px-4 py-5">
      <TennisBackground />

      <div className="relative mx-auto flex h-full max-w-md flex-col">
        <header className="flex items-start justify-between gap-4">
          <div>
            <BrandLogo className="mb-3 h-14 sm:h-16" />
            <div className="flex items-center gap-3">
              <span className="relative inline-flex shrink-0 rounded-full bg-gradient-to-tr from-emerald-500 via-emerald-400 to-lime-300 p-[2px] shadow-[0_0_25px_rgba(16,185,129,0.35)]">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={`Foto de perfil de ${firstName}`}
                    className="h-10 w-10 rounded-full border-2 border-slate-900 object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-900 bg-slate-800 text-slate-400">
                    <User className="h-5 w-5" />
                  </span>
                )}
              </span>
              <div>
                <h1 className="text-2xl font-bold leading-tight text-slate-100 drop-shadow-[0_0_18px_rgba(16,185,129,0.3)]">
                  Hola, {firstName}
                </h1>
                <p className="mt-0.5 text-sm text-slate-400">
                  ¿Listo para jugar hoy?
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell
              avisos={notificaciones.avisos}
              noLeidos={notificaciones.noLeidos}
              onAbrir={marcarVistos}
              onAsistencia={responderAsistencia}
            />
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Cerrar sesión"
              className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-2.5 text-slate-400 shadow-2xl backdrop-blur-md transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <nav className="mt-10 grid grid-cols-2 gap-4">
          {NAV_ITEMS.map(({ title, Icon, to, ancho, aviso }) => {
            const pendientes = aviso ? notificaciones.pendientes[aviso] : 0;
            return (
              <button
                type="button"
                key={title}
                onClick={() => to && navigate(to)}
                className={`group relative flex items-center justify-center gap-4 rounded-2xl border border-slate-700/50 bg-slate-800/60 p-5 text-slate-100 shadow-2xl backdrop-blur-md transition-all duration-200 hover:-translate-y-1 hover:border-emerald-500/50 hover:bg-slate-800/80 ${
                  ancho ? 'col-span-2' : 'aspect-square flex-col'
                }`}
              >
                {pendientes > 0 && (
                  <span className="absolute right-3 top-3 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-slate-900 shadow-lg">
                    {ancho ? TEXTO_AVISO[aviso](pendientes) : pendientes}
                  </span>
                )}
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-600/15 text-emerald-400 transition-colors group-hover:bg-emerald-600/25 group-hover:text-emerald-300">
                  <Icon className="h-8 w-8" />
                </span>
                <span
                  className={`font-semibold ${ancho ? 'text-base' : 'text-sm'}`}
                >
                  {title}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export default DashboardView;