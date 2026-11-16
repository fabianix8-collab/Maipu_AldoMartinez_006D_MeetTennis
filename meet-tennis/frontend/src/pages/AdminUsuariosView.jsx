import { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import TennisBackground from '../components/TennisBackground.jsx';
import { apiFetch } from '../lib/api.js';

function fechaCorta(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Tabla de administración de usuarios: lista, rol y acciones.
function AdminUsuarios({ usuarios, yoId, cargando, error, onCambiarRol }) {
  if (cargando && usuarios.length === 0) {
    return <p className="py-6 text-center text-xs text-slate-500">Cargando usuarios…</p>;
  }

  return (
    <div className="overflow-x-auto">
      {error && (
        <p className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          {error}
        </p>
      )}

      <div className="min-w-[640px]">
        {/* Encabezado */}
        <div className="grid grid-cols-[minmax(0,2fr)_0.8fr_0.9fr_0.9fr_0.6fr_auto] gap-2 border-b border-slate-700/50 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <span>Jugador</span>
          <span>Comuna</span>
          <span>Categoría</span>
          <span>Registrado</span>
          <span>Rol</span>
          <span>Acción</span>
        </div>

        {/* Filas */}
        <div className="flex flex-col divide-y divide-slate-700/40">
          {usuarios.map((u) => (
            <div
              key={u.id}
              className="grid grid-cols-[minmax(0,2fr)_0.8fr_0.9fr_0.9fr_0.6fr_auto] items-center gap-2 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-100">
                  {u.nombre} {u.apellido}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {u.email || (
                    <span className="text-amber-400/80">(sin cuenta de acceso)</span>
                  )}
                </p>
              </div>
              <span className="truncate text-xs text-slate-300">{u.comuna || '—'}</span>
              <span className="truncate text-xs text-slate-300">{u.nivel}</span>
              <span className="truncate text-xs text-slate-300">{fechaCorta(u.registrado)}</span>
              <span>
                {u.rol === 'admin' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    <ShieldCheck className="h-3 w-3" /> admin
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                    jugador
                  </span>
                )}
              </span>
              <span>
                {u.id === yoId ? (
                  <span className="text-[11px] text-slate-500">Eres tú</span>
                ) : u.rol === 'admin' ? (
                  <button
                    type="button"
                    onClick={() => onCambiarRol(u.id, 'jugador')}
                    className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300 transition-colors hover:bg-rose-500/20"
                  >
                    Quitar admin
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onCambiarRol(u.id, 'admin')}
                    className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
                  >
                    Hacer admin
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>

        {usuarios.length === 0 && (
          <p className="py-6 text-center text-xs text-slate-500">No hay usuarios registrados.</p>
        )}
      </div>
    </div>
  );
}

function AdminUsuariosView() {
  const navigate = useNavigate();

  const [usuarios, setUsuarios] = useState([]);
  const [yoId, setYoId] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [recargar, setRecargar] = useState(0);

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      try {
        const response = await apiFetch('/api/monitoring/usuarios');
        const result = await response.json();
        if (response.ok && result.success) {
          if (activo) {
            setUsuarios(result.data?.usuarios || []);
            setYoId(result.data?.yoId || null);
            setError(null);
          }
        } else if (activo) {
          setError(result.error || 'No se pudo cargar la lista de usuarios.');
        }
      } catch (err) {
        if (activo) setError(err.message || 'Sin conexión con el servidor.');
      } finally {
        if (activo) setCargando(false);
      }
    };

    cargar();

    return () => {
      activo = false;
    };
  }, [recargar]);

  // Promueve o revoca el rol admin de un usuario.
  const cambiarRol = async (id, rol) => {
    try {
      const response = await apiFetch(`/api/monitoring/usuarios/${id}/rol`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'No se pudo cambiar el rol.');
      }
      setUsuarios((prev) =>
        prev
          .map((u) => (u.id === id ? { ...u, rol } : u))
          .sort((a, b) => {
            if (a.rol !== b.rol) return a.rol === 'admin' ? -1 : 1;
            return `${a.nombre} ${a.apellido}`.localeCompare(
              `${b.nombre} ${b.apellido}`,
              'es',
            );
          }),
      );
      setError(null);
    } catch (err) {
      setError(err.message || 'No se pudo cambiar el rol.');
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-900 px-4 py-5">
      <TennisBackground />

      <div className="relative mx-auto max-w-6xl">
        {/* Encabezado */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/')}
              aria-label="Volver al inicio"
              className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-2.5 text-slate-400 shadow-2xl backdrop-blur-md transition-colors hover:border-emerald-500/50 hover:text-emerald-300"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <BrandLogo className="h-10 sm:h-12" />
          </div>

          <button
            type="button"
            onClick={() => {
              setCargando(true);
              setRecargar((n) => n + 1);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-600/15 px-4 py-2 text-sm font-semibold text-emerald-300 shadow-xl backdrop-blur-md transition-colors hover:bg-emerald-600/25"
          >
            <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </header>

        <div className="mt-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-100">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
            Administración de usuarios
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Gestiona los roles de los jugadores registrados en MeetTennis.
          </p>
        </div>

        {/* Tabla de usuarios */}
        <div className="mt-6 rounded-2xl border border-slate-700/50 bg-slate-800/60 p-5 shadow-2xl backdrop-blur-md">
          <AdminUsuarios
            usuarios={usuarios}
            yoId={yoId}
            cargando={cargando}
            error={error}
            onCambiarRol={cambiarRol}
          />
        </div>
      </div>
    </div>
  );
}

export default AdminUsuariosView;
