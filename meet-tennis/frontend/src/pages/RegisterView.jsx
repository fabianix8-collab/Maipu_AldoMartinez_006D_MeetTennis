import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Trophy,
  User,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const GENEROS = ['Hombre', 'Mujer'];
const NIVELES = [
  '1ra Categoría',
  '2da Categoría',
  '3ra Categoría',
  '4ta Categoría',
  '5ta Categoría',
];

const onlyLetters = (value) =>
  /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/.test(value?.trim() || '');

const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');

const meetsMinAge = (dateStr) => {
  if (!dateStr) return false;
  const birth = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return false;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 14;
};

const initialValues = {
  nombre: '',
  apellido: '',
  fecha_nacimiento: '',
  genero: '',
  nivel: '',
  email: '',
  password: '',
};

function buildErrors(values, avatar) {
  const errors = {};

  if (!onlyLetters(values.nombre)) {
    errors.nombre = 'El nombre solo puede contener letras.';
  }
  if (!onlyLetters(values.apellido)) {
    errors.apellido = 'El apellido solo puede contener letras.';
  }
  if (!values.fecha_nacimiento) {
    errors.fecha_nacimiento = 'La fecha de nacimiento es obligatoria.';
  } else if (!meetsMinAge(values.fecha_nacimiento)) {
    errors.fecha_nacimiento = 'Debes tener al menos 14 años.';
  }
  if (!values.genero) {
    errors.genero = 'Selecciona un género.';
  }
  if (!values.nivel) {
    errors.nivel = 'Selecciona un nivel.';
  }
  if (!values.email) {
    errors.email = 'El email es obligatorio.';
  } else if (!isValidEmail(values.email)) {
    errors.email = 'Ingresa un email válido.';
  }
  if (!values.password) {
    errors.password = 'La contraseña es obligatoria.';
  } else if (values.password.length < 6) {
    errors.password = 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (!avatar) {
    errors.avatar = 'Debes seleccionar una foto.';
  }

  return errors;
}

const inputBase =
  'w-full rounded-xl border bg-slate-800/70 pl-11 pr-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition-colors';
const passwordInputBase =
  'w-full rounded-xl border bg-slate-800/70 pl-11 pr-12 py-3 text-slate-100 placeholder-slate-500 outline-none transition-colors';
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-400';

function RegisterView() {
  const navigate = useNavigate();
  const [values, setValues] = useState(initialValues);
  const [avatar, setAvatar] = useState(null);
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [loading, setLoading] = useState(false);

  const errors = useMemo(
    () => buildErrors(values, avatar),
    [values, avatar],
  );

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

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    setAvatar(file || null);
    setTouched((prev) => ({ ...prev, avatar: true }));
    setStatus({ type: 'idle', message: '' });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isValid || loading) return;

    const formData = new FormData();
    formData.append('nombre', values.nombre.trim());
    formData.append('apellido', values.apellido.trim());
    formData.append('fecha_nacimiento', values.fecha_nacimiento);
    formData.append('genero', values.genero);
    formData.append('nivel', values.nivel);
    formData.append('email', values.email.trim());
    formData.append('password', values.password);
    formData.append('avatar', avatar);

    setLoading(true);
    setStatus({ type: 'idle', message: '' });

    try {
      const response = await fetch(
        'http://localhost:3000/api/auth/register',
        {
          method: 'POST',
          body: formData,
        },
      );

      const result = await response.json();

      if (response.ok && result.success) {
        setStatus({
          type: 'success',
          message: 'Registro exitoso. ¡Bienvenido a MeetTennis!',
        });
        setTimeout(() => navigate('/'), 1000);
        setValues(initialValues);
        setAvatar(null);
        setTouched({});
      } else {
        setStatus({
          type: 'error',
          message: result.error || 'No se pudo completar el registro.',
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
      <Trophy className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 text-emerald-500 opacity-5" />
      <Trophy className="pointer-events-none absolute -bottom-28 -left-24 h-96 w-96 rotate-12 text-emerald-500 opacity-5" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 shadow-2xl shadow-emerald-600/30">
            <Trophy className="h-8 w-8 text-slate-100" />
          </div>
          <h1 className="text-3xl font-bold text-slate-100">Crear cuenta</h1>
          <p className="mt-2 text-sm text-slate-400">
            Únete a la comunidad de MeetTennis
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-md"
        >
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className={labelClass} htmlFor="nombre">
                Nombre
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="nombre"
                  name="nombre"
                  type="text"
                  value={values.nombre}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Tu nombre"
                  className={`${inputBase} ${borderFor('nombre')}`}
                />
              </div>
              {renderFieldError('nombre')}
            </div>

            <div>
              <label className={labelClass} htmlFor="apellido">
                Apellido
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="apellido"
                  name="apellido"
                  type="text"
                  value={values.apellido}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Tu apellido"
                  className={`${inputBase} ${borderFor('apellido')}`}
                />
              </div>
              {renderFieldError('apellido')}
            </div>

            <div>
              <label className={labelClass} htmlFor="fecha_nacimiento">
                Fecha de nacimiento
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="fecha_nacimiento"
                  name="fecha_nacimiento"
                  type="date"
                  value={values.fecha_nacimiento}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`${inputBase} ${borderFor('fecha_nacimiento')}`}
                />
              </div>
              {renderFieldError('fecha_nacimiento')}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="genero">
                  Género
                </label>
                <div className="relative">
                  <select
                    id="genero"
                    name="genero"
                    value={values.genero}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`${inputBase} appearance-none ${borderFor('genero')} ${
                      values.genero ? 'text-slate-100' : 'text-slate-500'
                    }`}
                  >
                    <option className="bg-slate-800 text-slate-100" value="" disabled>
                      Selecciona
                    </option>
                    {GENEROS.map((genero) => (
                      <option
                        key={genero}
                        value={genero}
                        className="bg-slate-800 text-slate-100"
                      >
                        {genero}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
                {renderFieldError('genero')}
              </div>

              <div>
                <label className={labelClass} htmlFor="nivel">
                  Nivel
                </label>
                <div className="relative">
                  <select
                    id="nivel"
                    name="nivel"
                    value={values.nivel}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`${inputBase} appearance-none ${borderFor('nivel')} ${
                      values.nivel ? 'text-slate-100' : 'text-slate-500'
                    }`}
                  >
                    <option className="bg-slate-800 text-slate-100" value="" disabled>
                      Selecciona
                    </option>
                    {NIVELES.map((nivel) => (
                      <option
                        key={nivel}
                        value={nivel}
                        className="bg-slate-800 text-slate-100"
                      >
                        {nivel}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
                {renderFieldError('nivel')}
              </div>
            </div>

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
                  placeholder="Mínimo 6 caracteres"
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

            <div>
              <label className={labelClass} htmlFor="avatar">
                Foto de perfil
              </label>
              <div
                className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-slate-800/70 px-4 py-3 transition-colors ${borderFor(
                  'avatar',
                )}`}
                onClick={() => document.getElementById('avatar')?.click()}
              >
                <Camera className="h-5 w-5 shrink-0 text-slate-500" />
                <span className="truncate text-sm text-slate-400">
                  {avatar ? avatar.name : 'Seleccionar imagen'}
                </span>
              </div>
              <input
                id="avatar"
                name="avatar"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              {renderFieldError('avatar')}
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
                Creando cuenta...
              </>
            ) : (
              'Crear cuenta'
            )}
          </button>

          <p className="mt-6 text-center text-sm text-slate-400">
            ¿Ya tienes cuenta?{' '}
            <Link
              to="/login"
              className="font-semibold text-emerald-400 transition-colors hover:text-emerald-300"
            >
              Inicia sesión
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default RegisterView;