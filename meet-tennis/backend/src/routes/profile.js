import { Router } from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { requireAuth, requireSelf } from '../middleware/auth.js';
import { categoriaSuperior, NOMBRES_CATEGORIAS, resumenJugador } from '../lib/ranking.js';
import { partidosConfirmadosPorJugador } from './ranking.js';

dotenv.config();

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Cliente admin con service_role key para operaciones de escritura
// que requieren bypass de RLS en la tabla 'usuario'.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Datos que cualquier jugador con sesión puede ver de otro jugador.
// Fecha de nacimiento, género y coordenadas quedan fuera: solo los ve
// el propio usuario.
const CAMPOS_PUBLICOS = ['id', 'nombre', 'apellido', 'nivel', 'avatar_url', 'bio', 'comuna'];

function perfilPublico(perfil) {
  return Object.fromEntries(
    CAMPOS_PUBLICOS.filter((campo) => campo in perfil).map((campo) => [
      campo,
      perfil[campo],
    ]),
  );
}

// Obtiene los datos del perfil de un usuario.
// Requiere sesión: el propio perfil se devuelve completo y el de otros
// jugadores solo con los campos públicos.
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: profiles, error } = await supabaseAdmin
      .from('usuario')
      .select('*')
      .eq('id', id);

    if (error) {
      return res.status(500).json({
        success: false,
        data: null,
        error: error.message,
      });
    }

    if (!profiles || profiles.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Usuario no encontrado.',
      });
    }

    const esPropio = req.user.id === id;

    return res.status(200).json({
      success: true,
      data: esPropio ? profiles[0] : perfilPublico(profiles[0]),
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Error interno del servidor.',
    });
  }
});

// Actualiza la foto de perfil: sube la imagen al bucket "avatars"
// y guarda la URL pública en la tabla usuario.
// Requiere sesión y que el usuario modifique solo su propio perfil.
router.post('/:id/avatar', requireAuth, requireSelf, upload.single('avatar'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Falta el identificador del usuario.',
      });
    }

    if (!req.file || !req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'El avatar debe ser una imagen válida.',
      });
    }

    const extension = req.file.mimetype.split('/')[1] || 'jpg';
    const avatarPath = `${randomUUID()}.${extension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(avatarPath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      return res.status(400).json({
        success: false,
        data: null,
        error: uploadError.message,
      });
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(avatarPath);

    const avatarUrl = publicUrlData?.publicUrl;

    const { data: profiles, error: updateError } = await supabaseAdmin
      .from('usuario')
      .update({ avatar_url: avatarUrl })
      .eq('id', id)
      .select();

    if (updateError) {
      return res.status(500).json({
        success: false,
        data: null,
        error: updateError.message,
      });
    }

    if (!profiles || profiles.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Usuario no encontrado.',
      });
    }

    return res.status(200).json({
      success: true,
      data: profiles[0],
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Error interno del servidor.',
    });
  }
});

// Asciende al jugador a la categoría inmediatamente superior.
// El servidor verifica los requisitos (puntos y victorias válidas) con
// los partidos confirmados; el cliente no puede saltárselos.
// Body: { nivel } — la categoría a la que asciende.
router.patch('/:id', requireAuth, requireSelf, async (req, res) => {
  try {
    const { id } = req.params;
    const { nivel } = req.body || {};

    if (!nivel || !NOMBRES_CATEGORIAS.includes(nivel)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Categoría no válida.',
      });
    }

    const { data: actual, error: actualError } = await supabaseAdmin
      .from('usuario')
      .select('nivel')
      .eq('id', id)
      .maybeSingle();

    if (actualError) {
      return res.status(500).json({
        success: false,
        data: null,
        error: actualError.message,
      });
    }

    if (!actual) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Usuario no encontrado.',
      });
    }

    if (nivel !== categoriaSuperior(actual.nivel)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Solo puedes ascender a la categoría inmediatamente superior.',
      });
    }

    const partidos = (await partidosConfirmadosPorJugador([id])).get(id) || [];
    const resumen = resumenJugador(id, actual.nivel, partidos);

    if (!resumen.puedeAscender) {
      return res.status(403).json({
        success: false,
        data: null,
        error: `Aún no cumples los requisitos: necesitas ${resumen.requisito.puntos} pts y ${resumen.requisito.victorias} victorias válidas (tienes ${resumen.puntos} pts y ${resumen.victoriasValidas}).`,
      });
    }

    const { data: profiles, error } = await supabaseAdmin
      .from('usuario')
      .update({ nivel })
      .eq('id', id)
      .select();

    if (error) {
      return res.status(500).json({
        success: false,
        data: null,
        error: error.message,
      });
    }

    if (!profiles || profiles.length === 0) {
      return res.status(404).json({
        success: false,
        data: null,
        error: 'Usuario no encontrado.',
      });
    }

    return res.status(200).json({
      success: true,
      data: profiles[0],
      error: null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Error interno del servidor.',
    });
  }
});

export default router;
