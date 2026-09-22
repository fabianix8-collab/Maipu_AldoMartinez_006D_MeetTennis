import { LogOut, MapPin, Swords, Trophy, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import TennisBackground from '../components/TennisBackground.jsx';

const NAV_ITEMS = [
  { title: 'Buscar Partido', Icon: Swords },
  { title: 'Canchas Cercanas', Icon: MapPin },
  { title: 'Mi Ranking', Icon: Trophy },
  { title: 'Mi Perfil', Icon: User },
];

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

  const handleLogout = () => {
    localStorage.removeItem('meettennis_auth');
    navigate('/login');
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900 px-4 py-8">
      <TennisBackground />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col">
        <header className="flex items-start justify-between gap-4">
          <div>
            <BrandLogo className="mb-4 h-20 sm:h-24" />
            <h1 className="text-3xl font-bold leading-tight text-slate-100">
              Hola, {firstName}
            </h1>
            <p className="mt-1 text-sm text-slate-400">¿Listo para jugar hoy?</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-2.5 text-slate-400 shadow-2xl backdrop-blur-md transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </header>

        <nav className="mt-10 grid grid-cols-2 gap-4">
          {NAV_ITEMS.map(({ title, Icon }) => (
            <button
              type="button"
              key={title}
              className="group flex aspect-square flex-col items-center justify-center gap-4 rounded-2xl border border-slate-700/50 bg-slate-800/60 p-5 text-slate-100 shadow-2xl backdrop-blur-md transition-all duration-200 hover:-translate-y-1 hover:border-emerald-500/50 hover:bg-slate-800/80"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600/15 text-emerald-400 transition-colors group-hover:bg-emerald-600/25 group-hover:text-emerald-300">
                <Icon className="h-8 w-8" />
              </span>
              <span className="text-sm font-semibold">{title}</span>
            </button>
          ))}
        </nav>

        <p className="mt-auto pt-10 text-center text-xs text-slate-500">
          Próximamente: partidos, canchas, ranking y más.
        </p>
      </div>
    </div>
  );
}

export default DashboardView;