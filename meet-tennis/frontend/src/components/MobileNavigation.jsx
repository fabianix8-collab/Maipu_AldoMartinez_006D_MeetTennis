import { useEffect, useState } from 'react';
import { CalendarClock, Home, MessageCircle, Swords, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { apiFetch } from '../lib/api.js';
import { useLanguage } from '../lib/i18n.js';
import { SECCIONES_PARTIDOS } from '../lib/partidos.js';

const ITEMS = [
  { title: 'Inicio', to: '/', Icon: Home },
  { title: 'Buscar', to: '/buscar-partido', Icon: Swords },
  { title: 'Partidos', to: '/partidos', Icon: CalendarClock },
  { title: 'Chat', to: '/chat', Icon: MessageCircle },
  { title: 'Perfil', to: '/perfil', Icon: User },
];
const RUTAS_PARTIDOS = ['/partidos', ...Object.values(SECCIONES_PARTIDOS).map((seccion) => seccion.ruta)];

export default function MobileNavigation() {
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const [noLeidos, setNoLeidos] = useState(0);

  useEffect(() => {
    // En escritorio se conserva la burbuja del inicio.
    if (!window.matchMedia('(max-width: 639px)').matches) return;
    let activo = true;
    const cargar = async () => {
      try {
        const response = await apiFetch('/api/chat/conversations');
        const result = await response.json();
        if (activo && response.ok && result.success) {
          setNoLeidos((result.data || []).reduce((total, chat) => total + (chat.noLeidos || 0), 0));
        }
      } catch { /* La navegación sigue disponible si falla el contador. */ }
    };
    const alActualizar = (event) => {
      if (activo) setNoLeidos(event.detail.reduce((total, chat) => total + (chat.noLeidos || 0), 0));
    };
    window.addEventListener('meettennis:chat-actualizado', alActualizar);
    cargar();
    // Dentro del chat se usa la misma sincronización en vivo del hilo.
    const intervalo = pathname === '/chat' ? null : setInterval(cargar, 12000);
    return () => {
      activo = false;
      clearInterval(intervalo);
      window.removeEventListener('meettennis:chat-actualizado', alActualizar);
    };
  }, [pathname]);

  return (
    <nav aria-label={t('Navegación principal')} className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-700/70 bg-slate-900/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(2,6,23,0.3)] backdrop-blur-xl sm:hidden">
      <div className="mx-auto grid h-[4.5rem] max-w-md grid-cols-5 px-1">
        {ITEMS.map(({ title, to, Icon }) => {
          const activa = to === '/partidos' ? RUTAS_PARTIDOS.includes(pathname) : pathname === to;
          return (
            <Link
              key={to}
              to={to}
              aria-current={activa ? 'page' : undefined}
              className={`my-1 flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${activa ? 'bg-emerald-500/10 text-emerald-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
            >
              <span className="relative">
                <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={activa ? 2.5 : 1.75} />
                {to === '/chat' && noLeidos > 0 && (
                  <span aria-label={t('{0} mensajes sin leer', { 0: noLeidos })} className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-300 px-1 text-[10px] font-bold text-slate-900">
                    {noLeidos > 99 ? '99+' : noLeidos}
                  </span>
                )}
              </span>
              <span>{t(title)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
