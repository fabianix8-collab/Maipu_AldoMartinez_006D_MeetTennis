import { Router } from 'express';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { crearRateLimit } from '../middleware/rateLimit.js';

dotenv.config();
const router = Router();
const TOKEN_MAX = 16384;
const PASSWORD_MAX = 128;
const ENLACE_INVALIDO = 'El enlace de recuperación es inválido o venció. Solicita uno nuevo.';

function formatoTokenValido(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return false;
  try {
    const [header, payload] = token.split('.').slice(0, 2).map((parte) => JSON.parse(Buffer.from(parte, 'base64url').toString('utf8')));
    return header && typeof header.alg === 'string' && payload && typeof payload === 'object' && !Array.isArray(payload);
  } catch { return false; }
}

function clientePublico() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'implicit' },
  });
}

export function urlRecuperacion(origin, env = process.env) {
  const configurados = [env.FRONTEND_URL, ...(env.CORS_ORIGIN || '').split(',')].filter(Boolean);
  if (env.NODE_ENV !== 'production') configurados.push('http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173');
  const permitidos = configurados.map((valor) => {
    try {
      const url = new URL(valor.trim());
      return ['http:', 'https:'].includes(url.protocol) && (env.NODE_ENV !== 'production' || url.protocol === 'https:') && !url.username && !url.password ? url.origin : null;
    } catch { return null; }
  }).filter(Boolean);
  const elegido = origin === undefined ? permitidos[0] : origin;
  if (typeof elegido !== 'string' || !permitidos.includes(elegido)) return null;
  return new URL('/restablecer-contrasena', elegido).href;
}

const limitarSolicitud = crearRateLimit({
  ventanaMs: 15 * 60 * 1000, max: 5,
  mensaje: 'Demasiadas solicitudes de recuperación. Espera unos minutos e intenta de nuevo.',
});
const limitarCambio = crearRateLimit({
  ventanaMs: 15 * 60 * 1000, max: 10,
  mensaje: 'Demasiados intentos de recuperación. Espera unos minutos e intenta de nuevo.',
});

router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

router.post('/forgot-password', limitarSolicitud, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, data: null, error: 'Ingresa un email válido.' });
  }
  const redirectTo = urlRecuperacion(req.body?.origin);
  if (!redirectTo) {
    return res.status(400).json({ success: false, data: null, error: 'No se pudo solicitar el enlace desde esta dirección. Revisa la configuración de la app.' });
  }
  try {
    const { error } = await clientePublico().auth.resetPasswordForEmail(email, { redirectTo });
    if (error && !['user_not_found', 'email_not_found'].includes(error.code)) {
      const limitado = error.status === 429;
      return res.status(limitado ? 429 : 503).json({
        success: false, data: null,
        error: limitado ? 'Espera unos minutos antes de solicitar otro enlace.' : 'No se pudo solicitar el enlace. Inténtalo de nuevo más tarde.',
      });
    }
    // La respuesta no revela si existe una cuenta con ese correo.
    return res.status(200).json({ success: true, data: null, error: null });
  } catch {
    return res.status(503).json({ success: false, data: null, error: 'No se pudo solicitar el enlace. Inténtalo de nuevo más tarde.' });
  }
});

router.post('/reset-password', limitarCambio, async (req, res) => {
  const { access_token, refresh_token, password } = req.body || {};
  if (![access_token, refresh_token].every((token) => typeof token === 'string' && token.length > 0 && token.length <= TOKEN_MAX) || !formatoTokenValido(access_token)) {
    return res.status(401).json({ success: false, data: null, error: ENLACE_INVALIDO });
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > PASSWORD_MAX) {
    return res.status(400).json({ success: false, data: null, error: 'Usa una contraseña de entre 6 y 128 caracteres.' });
  }
  try {
    const supabase = clientePublico();
    // setSession valida la sesión con Supabase. Cada petición tiene su propio
    // cliente; nunca se elige un usuario por correo ni se usa service_role.
    const { data, error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
    if (sessionError && (sessionError.status === 0 || sessionError.status >= 500)) {
      return res.status(503).json({ success: false, data: null, error: 'No se pudo validar el enlace. Inténtalo de nuevo.' });
    }
    if (sessionError || !data?.user?.id) {
      return res.status(401).json({ success: false, data: null, error: ENLACE_INVALIDO });
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      const invalidos = error.status === 401 || error.status === 403;
      const mensaje = invalidos ? ENLACE_INVALIDO
        : error.code === 'same_password' ? 'La nueva contraseña debe ser distinta de la anterior.'
        : error.code === 'weak_password' ? 'La contraseña no cumple los requisitos. Prueba una más larga.'
        : 'No se pudo guardar la contraseña. Inténtalo de nuevo.';
      return res.status(invalidos ? 401 : 400).json({ success: false, data: null, error: mensaje });
    }
    // Finaliza las sesiones renovables tras el cambio; la app pide iniciar sesión.
    await supabase.auth.signOut().catch(() => {});
    return res.status(200).json({ success: true, data: null, error: null });
  } catch {
    return res.status(503).json({ success: false, data: null, error: 'No se pudo guardar la contraseña. Inténtalo de nuevo.' });
  }
});

export default router;
