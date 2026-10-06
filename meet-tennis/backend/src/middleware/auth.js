import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Verifica el token de sesión (header "Authorization: Bearer <token>")
// contra Supabase Auth y deja el usuario autenticado en req.user.
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Debes iniciar sesión.',
      });
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Sesión inválida o expirada.',
      });
    }

    req.user = data.user;
    return next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Error interno del servidor.',
    });
  }
}

// Solo permite continuar si el :id de la ruta es el del usuario autenticado.
// Debe usarse después de requireAuth.
export function requireSelf(req, res, next) {
  if (req.user?.id !== req.params.id) {
    return res.status(403).json({
      success: false,
      data: null,
      error: 'No tienes permiso para modificar este perfil.',
    });
  }
  return next();
}
