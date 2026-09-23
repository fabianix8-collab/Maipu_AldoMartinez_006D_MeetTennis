import { Router } from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

// Obtiene los datos del perfil de un usuario.
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('usuario')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        data: null,
        error: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      data,
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

    const { data: profile, error: updateError } = await supabase
      .from('usuario')
      .update({ avatar_url: avatarUrl })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({
        success: false,
        data: null,
        error: updateError.message,
      });
    }

    return res.status(200).json({
      success: true,
      data: profile,
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
