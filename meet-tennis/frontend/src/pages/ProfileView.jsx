import { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Camera,
  CheckCircle2,
  Loader2,
  Mail,
  Save,
  Trophy,
  User,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import TennisBackground from '../components/TennisBackground.jsx';

const labelClass = 'text-xs font-medium uppercase tracking-wide text-slate-500';
const BIO_KEY = 'meettennis_bio';
const BIO_MAX = 300;

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('meettennis_auth') || 'null');
  } catch {
    return null;
  }
}

function getUserKey() {
  const stored = getStoredUser();
  return stored?.profile?.id || stored?.user?.id || 'invitado';
}

function loadBio() {
  try {
    const raw = JSON.parse(localStorage.getItem(BIO_KEY) || '{}');
    return raw[getUserKey()] || '';
  } catch {
    return '';
  }
}

function persistBio(value) {
  try {
    const raw = JSON.parse(localStorage.getItem(BIO_KEY) || '{}');
    raw[getUserKey()] = value;
    localStorage.setItem(BIO_KEY, JSON.stringify(raw));
  } catch {
    // Silencioso: si el almacenamiento no está disponible, la sesión sigue funcionando.
  }
}

function formatFecha(fecha) {
  if (!fecha) return 'No registrada';
  const [anio, mes, dia] = String(fecha).split('-');
  if (!anio || !mes || !dia) return fecha;
  return `${dia}/${mes}/${anio}`;
}

function ProfileView() {
  const storedUser = getStoredUser();
  const profile = storedUser?.profile || {};
  const userId = profile.id || storedUser?.user?.id || '';
  const email = storedUser?.user?.email || '';

  const nombre = profile.nombre || 'Deportista';
  const apellido = profile.apellido || '';
  const genero = profile.genero || 'No especificado';
  const nivel = profile.nivel || 'Sin nivel';

  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || null);
  const [subiendoAvatar, setSubiendoAvatar] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState({ type: 'idle', message: '' });

  const [bio, setBio] = useState(loadBio);
  const [bioStatus, setBioStatus] = useState({ type: 'idle', message: '' });

  const nombreCompleto = `${nombre} ${apellido}`.trim();

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarStatus({ type: 'error', message: 'Selecciona una imagen válida.' });
      return;
    }

    if (!userId) {
      setAvatarStatus({
        type: 'error',
        message: 'No se pudo identificar al usuario.',
      });
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    setSubiendoAvatar(true);
    setAvatarStatus({ type: 'idle', message: '' });

    try {
      const response = await fetch(`/api/profile/${userId}/avatar`, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();

      if (response.ok && result.success) {
        const nuevaUrl = result.data?.avatar_url || null;
        setAvatarUrl(nuevaUrl);

        // Mantener sincronizada la sesión guardada.
        try {
          const stored = getStoredUser();
          if (stored?.profile) {
            stored.profile.avatar_url = nuevaUrl;
            localStorage.setItem('meettennis_auth', JSON.stringify(stored));
          }
        } catch {
          // Silencioso.
        }

        setAvatarStatus({
          type: 'success',
          message: 'Foto de perfil actualizada.',
        });
      } else {
        setAvatarStatus({
          type: 'error',
          message: result.error || 'No se pudo actualizar la foto.',
        });
      }
    } catch {
      setAvatarStatus({
        type: 'error',
        message: 'No se pudo conectar con el servidor.',
      });
    } finally {
      setSubiendoAvatar(false);
    }
  };

  const handleGuardarBio = () => {
    persistBio(bio.trim());
    setBioStatus({
      type: 'success',
      message: 'Información guardada correctamente.',
    });
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
                <User className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-2xl font-bold leading-tight text-slate-100">
                  Mi Perfil
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  Tus datos y preferencias
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

        <section className="mt-8 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-5">
            <span className="relative inline-flex shrink-0 rounded-full bg-gradient-to-tr from-emerald-500 via-emerald-400 to-lime-300 p-[2px] shadow-lg">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`Foto de perfil de ${nombreCompleto}`}
                  className="h-20 w-20 rounded-full border-2 border-slate-900 object-cover"
                />
              ) : (
                <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-slate-900 bg-slate-800 text-slate-400">
                  <User className="h-9 w-9" />
                </span>
              )}
            </span>

            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-slate-100">
                {nombreCompleto}
              </h2>
              <p className="mt-0.5 truncate text-sm text-slate-400">
                {email || 'Sin correo'}
              </p>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <Trophy className="h-3.5 w-3.5" />
                {nivel}
              </span>
            </div>
          </div>

          <input
            id="avatar-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <label
            htmlFor="avatar-input"
            className={`mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/70 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-emerald-500/50 hover:text-emerald-300 ${
              subiendoAvatar ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            {subiendoAvatar ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Subiendo foto...
              </>
            ) : (
              <>
                <Camera className="h-4 w-4" />
                Cambiar foto de perfil
              </>
            )}
          </label>

          {avatarStatus.type === 'success' && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              {avatarStatus.message}
            </p>
          )}
          {avatarStatus.type === 'error' && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {avatarStatus.message}
            </p>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-md">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Mis datos
          </h2>

          <dl className="mt-4 grid gap-4">
            <div>
              <dt className={labelClass}>Nombre completo</dt>
              <dd className="mt-0.5 text-sm text-slate-100">{nombreCompleto}</dd>
            </div>

            <div>
              <dt className={labelClass}>Email</dt>
              <dd className="mt-0.5 flex items-center gap-2 text-sm text-slate-100">
                <Mail className="h-4 w-4 shrink-0 text-slate-500" />
                {email || 'No registrado'}
              </dd>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className={labelClass}>Género</dt>
                <dd className="mt-0.5 text-sm text-slate-100">{genero}</dd>
              </div>
              <div>
                <dt className={labelClass}>Nacimiento</dt>
                <dd className="mt-0.5 flex items-center gap-2 text-sm text-slate-100">
                  <Calendar className="h-4 w-4 shrink-0 text-slate-500" />
                  {formatFecha(profile.fecha_nacimiento)}
                </dd>
              </div>
            </div>

            <div>
              <dt className={labelClass}>Nivel de juego</dt>
              <dd className="mt-0.5 inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-300">
                <Trophy className="h-4 w-4" />
                {nivel}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-md">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Sobre mí
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Cuéntale a la comunidad tu estilo de juego, disponibilidad o lo que
            buscas.
          </p>

          <textarea
            id="bio"
            name="bio"
            rows={4}
            maxLength={BIO_MAX}
            value={bio}
            onChange={(event) => {
              setBio(event.target.value);
              setBioStatus({ type: 'idle', message: '' });
            }}
            placeholder="Ej: Juego los fines de semana, nivel intermedio, busco partidos amistosos..."
            className="mt-3 w-full resize-none rounded-xl border border-slate-700/50 bg-slate-800/70 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-emerald-500"
          />

          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {bio.length}/{BIO_MAX}
            </span>
            <button
              type="button"
              onClick={handleGuardarBio}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:bg-emerald-700"
            >
              <Save className="h-4 w-4" />
              Guardar
            </button>
          </div>

          {bioStatus.type === 'success' && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              {bioStatus.message}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export default ProfileView;
