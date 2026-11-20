import { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import LanguageSelector from '../components/LanguageSelector.jsx';
import TennisBackground from '../components/TennisBackground.jsx';
import { useLanguage } from '../lib/i18n.js';
import { borrarSesionRecuperacion, leerSesionRecuperacion } from '../lib/passwordRecovery.js';

const inputClass = 'w-full rounded-xl border border-slate-700/50 bg-slate-800/70 py-3 pl-11 pr-12 text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-emerald-500';
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-400';
const INVALIDO = 'El enlace de recuperación es inválido o venció. Solicita uno nuevo.';

export default function PasswordRecoveryView({ mode = 'request' }) {
  const { t } = useLanguage();
  const { state, hash, search } = useLocation();
  const navigate = useNavigate();
  const restablecer = mode === 'reset';
  const [sesion, setSesion] = useState(() => restablecer ? leerSesionRecuperacion() : null);
  const [email, setEmail] = useState(state?.email || '');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [visible, setVisible] = useState(false);
  const [tocado, setTocado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: 'idle', message: '' });

  // Un segundo correo puede abrirse sobre la misma pantalla mediante un
  // cambio de fragmento. Consume también ese enlace y sincroniza el router
  // con la URL limpia para no reutilizar credenciales de un enlace anterior.
  useEffect(() => {
    if (!restablecer || !hash) return;
    setSesion(leerSesionRecuperacion());
    setPassword('');
    setConfirmacion('');
    setTocado(false);
    setStatus({ type: 'idle', message: '' });
    navigate({ pathname: '/restablecer-contrasena', search }, { replace: true, state });
  }, [restablecer, hash, search, navigate, state]);

  let error = '';
  if (!restablecer && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) error = 'Ingresa un email válido.';
  else if (restablecer && (password.length < 6 || password.length > 128)) error = 'Usa una contraseña de entre 6 y 128 caracteres.';
  else if (restablecer && password !== confirmacion) error = 'Las contraseñas no coinciden.';

  const enviar = async (event) => {
    event.preventDefault();
    setTocado(true);
    if (loading || error) return;
    if (restablecer && (!sesion || sesion.expiresAt <= Date.now())) {
      borrarSesionRecuperacion();
      setSesion(null);
      return;
    }
    setLoading(true);
    setStatus({ type: 'idle', message: '' });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(restablecer ? '/api/auth/reset-password' : '/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify(restablecer
          ? { access_token: sesion.access_token, refresh_token: sesion.refresh_token, password }
          : { email: email.trim(), origin: window.location.origin }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        if (restablecer && response.status === 401) {
          borrarSesionRecuperacion();
          setSesion(null);
          return;
        }
        setStatus({ type: 'error', message: result.error || 'No se pudo completar la solicitud. Inténtalo de nuevo.' });
        return;
      }
      if (restablecer) {
        borrarSesionRecuperacion();
        setSesion(null);
        setPassword('');
        setConfirmacion('');
      }
      setStatus({
        type: 'success',
        message: restablecer ? 'Tu contraseña se actualizó. Ya puedes iniciar sesión con la nueva contraseña.'
          : 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña. Revisa también la carpeta de spam.',
      });
    } catch (err) {
      setStatus({ type: 'error', message: err.name === 'AbortError'
        ? 'El servidor tardó demasiado en responder. Inténtalo de nuevo.' : 'No se pudo conectar con el servidor.' });
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  const terminado = status.type === 'success';
  const enlaceInvalido = restablecer && !sesion && !terminado;

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-slate-900 px-4 py-6">
      <div className="pointer-events-none fixed inset-0"><TennisBackground /></div>
      <LanguageSelector className="absolute right-4 top-4 z-20" />
      <div className="relative mx-auto flex min-h-[calc(100dvh-3rem)] max-w-md flex-col justify-center">
        <div className="mb-6 pt-10 text-center">
          <BrandLogo homeLink={false} className="mx-auto mb-6 h-32 sm:h-36" />
          <h1 className="text-2xl font-bold text-slate-100">
            {restablecer ? t('Restablecer contraseña') : t('¿Olvidaste tu contraseña?')}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {restablecer ? t('Elige una nueva contraseña para tu cuenta.') : t('Te enviaremos un enlace para recuperar el acceso.')}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-md">
          {enlaceInvalido ? (
            <div role="alert" className="text-sm text-slate-300">
              <div className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-amber-200">
                <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{t(INVALIDO)}
              </div>
              <Link to="/recuperar-contrasena" className="mt-5 flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-500">
                {t('Solicitar un nuevo enlace')}
              </Link>
            </div>
          ) : terminado ? (
            <div role="status">
              <div className="flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm leading-relaxed text-emerald-200">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />{t(status.message)}
              </div>
              {!restablecer && (
                <button type="button" onClick={() => { setStatus({ type: 'idle', message: '' }); setTocado(false); }} className="mt-4 min-h-11 rounded-lg px-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/10">
                  {t('Enviar otro enlace')}
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={enviar} noValidate className="grid gap-4">
              {!restablecer ? (
                <div>
                  <label className={labelClass} htmlFor="recovery-email">{t('Email')}</label>
                  <div className="relative">
                    <Mail aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input id="recovery-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => { setEmail(event.target.value); setStatus({ type: 'idle', message: '' }); }} onBlur={() => setTocado(true)} placeholder={t('tu@email.com')} aria-invalid={tocado && Boolean(error)} aria-describedby={tocado && error ? 'recovery-error' : undefined} className={inputClass} />
                  </div>
                </div>
              ) : (
                <>
                  {[['new-password', t('Nueva contraseña'), password, setPassword], ['confirm-password', t('Repite la nueva contraseña'), confirmacion, setConfirmacion]].map(([id, label, value, setter]) => (
                    <div key={id}>
                      <label className={labelClass} htmlFor={id}>{label}</label>
                      <div className="relative">
                        <Lock aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <input id={id} type={visible ? 'text' : 'password'} autoComplete="new-password" minLength={6} maxLength={128} value={value} onChange={(event) => { setter(event.target.value); setStatus({ type: 'idle', message: '' }); }} aria-invalid={tocado && Boolean(error)} aria-describedby={tocado && error ? 'recovery-error' : undefined} className={inputClass} />
                        <button type="button" onClick={() => setVisible((prev) => !prev)} aria-label={visible ? t('Ocultar contraseña') : t('Mostrar contraseña')} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate-400 hover:text-slate-100">
                          {visible ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                  <p className="text-sm text-slate-400">{t('Usa una contraseña de entre 6 y 128 caracteres.')}</p>
                </>
              )}
              {tocado && error && <p id="recovery-error" role="alert" className="text-sm text-red-300">{t(error)}</p>}
              {status.type === 'error' && <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{t(status.message)}</p>}
              <button type="submit" disabled={loading} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-60">
                {loading ? <><Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />{t('Procesando...')}</> : restablecer ? t('Guardar nueva contraseña') : t('Enviar enlace')}
              </button>
            </form>
          )}

          <Link to="/login" onClick={() => { if (restablecer) borrarSesionRecuperacion(); }} className="mt-5 flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-emerald-300 hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />{t('Volver a iniciar sesión')}
          </Link>
        </div>
      </div>
    </div>
  );
}
