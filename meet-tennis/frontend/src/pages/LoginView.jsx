import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  Mail,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import TennisBackground from '../components/TennisBackground.jsx';

const initialValues = {
  email: '',
  password: '',
};

const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');

function buildErrors(values) {
  const errors = {};

  if (!values.email) {
    errors.email = 'El email es obligatorio.';
  } else if (!isValidEmail(values.email)) {
    errors.email = 'Ingresa un email válido.';
  }

  if (!values.password) {
    errors.password = 'La contraseña es obligatoria.';
  }

  return errors;
}

const inputBase =
  'w-full rounded-xl border bg-slate-800/70 pl-11 pr-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition-colors';
const passwordInputBase =
  'w-full rounded-xl border bg-slate-800/70 pl-11 pr-12 py-3 text-slate-100 placeholder-slate-500 outline-none transition-colors';
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-400';

function LoginView() {
  const navigate = useNavigate();
  const [values, setValues] = useState(initialValues);
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [loading, setLoading] = useState(false);

  const errors = useMemo(() => buildErrors(values), [values]);

  const isValid = useMemo(
    () => Object.keys(errors).length === 0,
    [errors],
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setStatus({ type: 'idle', message: '' });
  };

  const handleBlur = (event) => {
    const { name } = event.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isValid || loading) return;

    setLoading(true);
    setStatus({ type: 'idle', message: '' });

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: values.email.trim(),
          password: values.password,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        localStorage.setItem('meettennis_auth', JSON.stringify(result.data));
        setStatus({
          type: 'success',
          message: 'Inicio de sesión exitoso. ¡Bienvenido de nuevo!',
        });
        setTimeout(() => navigate('/'), 1000);
      } else {
        setStatus({
          type: 'error',
          message: result.error || 'No se pudo iniciar sesión.',
        });
      }
    } catch {
      setStatus({
        type: 'error',
        message: 'No se pudo conectar con el servidor.',
      });
    } finally {
      setLoading(false);
    }
  };

  const borderFor = (name) => {
    if (!touched[name]) return 'border-slate-700/50';
    if (errors[name]) return 'border-red-500';
    return 'border-emerald-500';
  };

  const renderFieldError = (name) => {
    if (!touched[name] || !errors[name]) return null;
    return (
      <p className="mt-1.5 flex items-center gap-1 text-xs text-red-400">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        {errors[name]}
      </p>
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900 px-4 py-10">
      <TennisBackground />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center">
        <div className="mb-8 text-center">
          <BrandLogo className="mx-auto mb-12 h-32 sm:h-40" />
          <h1 className="text-2xl font-bold text-slate-100">Iniciar sesión</h1>
          <p className="mt-2 text-sm text-slate-400">
            Bienvenido de nuevo a MeetTennis
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-md"
        >
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className={labelClass} htmlFor="email">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={values.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="tu@email.com"
                  className={`${inputBase} ${borderFor('email')}`}
                />
              </div>
              {renderFieldError('email')}
            </div>

            <div>
              <label className={labelClass} htmlFor="password">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={values.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Tu contraseña"
                  className={`${passwordInputBase} ${borderFor('password')}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-200"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {renderFieldError('password')}
            </div>
          </div>

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

          <button
            type="submit"
            disabled={!isValid || loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-slate-100 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Iniciando sesión...
              </>
            ) : (
              <>
                <LogIn className="h-5 w-5" />
                Iniciar sesión
              </>
            )}
          </button>

          <p className="mt-6 text-center text-sm text-slate-400">
            ¿No tienes cuenta?{' '}
            <Link
              to="/register"
              className="font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
            >
              Regístrate
            </Link>
          </p>

          <a
            href="https://www.instagram.com/meettennischl/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Síguenos en Instagram"
            className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500 transition-colors hover:text-emerald-400"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
            </svg>
            @meettennischl
          </a>
        </form>
      </div>
    </div>
  );
}

export default LoginView;