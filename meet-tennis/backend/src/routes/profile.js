import { Router } from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Cliente admin con service_role key para operaciones de escritura
// que requieren bypass de RLS en la tabla 'usuario'.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Obtiene los datos del perfil de un usuario.
router.get('/:id', async (req, res) => {
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

// Actualiza la foto de perfil: sube la imagen al bucket "avatars"
// y guarda la URL pública en la tabla usuario.
router.post('/:id/avatar', upload.single('avatar'), async (req, res) => {
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

    const { error: uploadError } = await supabase.storage
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

    const { data: publicUrlData } = supabase.storage
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

const CATEGORIAS_VALIDAS = [
  '1ra Categoría',
  '2da Categoría',
  '3ra Categoría',
  '4ta Categoría',
  '5ta Categoría',
];

// Actualiza la categoría del jugador.
// Se usa al ascender en el ranking: el usuario pasa a competir en la
// categoría superior y su perfil queda actualizado en la base de datos.
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nivel } = req.body || {};

    if (!id) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Falta el identificador del usuario.',
      });
    }

    if (!nivel || !CATEGORIAS_VALIDAS.includes(nivel)) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Categoría no válida.',
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
