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

router.post('/login', async (req, res) => {
  try {
    const { email: emailRaw, password } = req.body || {};

    const email = emailRaw?.trim().toLowerCase();

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Email y contraseña son obligatorios.',
      });
    }

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      return res.status(401).json({
        success: false,
        data: null,
        error: authError.message,
      });
    }

    const user = authData?.user;
    const session = authData?.session;

    if (!user?.id) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Credenciales inválidas.',
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from('usuario')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return res.status(500).json({
        success: false,
        data: null,
        error: profileError.message,
      });
    }

    return res.status(200).json({
      success: true,
      data: { user, profile, session },
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

router.post('/register', upload.single('avatar'), async (req, res) => {
  try {
    const {
      nombre: nombreRaw,
      apellido: apellidoRaw,
      fecha_nacimiento,
      genero: generoRaw,
      nivel: nivelRaw,
      email: emailRaw,
      password,
    } = req.body;

    // Sanitización obligatoria: multer puede arrastrar espacios o saltos de línea
    // invisibles en los campos de texto del FormData.
    const nombre = nombreRaw?.trim();
    const apellido = apellidoRaw?.trim();
    const genero = generoRaw?.trim();
    const nivel = nivelRaw?.trim();
    const email = emailRaw?.trim().toLowerCase();

    if (
      !nombre ||
      !apellido ||
      !fecha_nacimiento ||
      !genero ||
      !nivel ||
      !email ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Todos los campos son obligatorios.',
      });
    }

    // a) Validar que el avatar sea una imagen.
    if (!req.file || !req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'El avatar debe ser una imagen válida.',
      });
    }

    const extension = req.file.mimetype.split('/')[1] || 'jpg';
    const avatarPath = `${randomUUID()}.${extension}`;

    // b) Subir el avatar al bucket público "avatars" y obtener su URL.
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

    // c) Registrar el usuario en Supabase Auth.
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      return res.status(400).json({
        success: false,
        data: null,
        error: authError.message,
      });
    }

    const userId = authData?.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'No se pudo crear el usuario.',
      });
    }

    // d) Insertar el perfil en la tabla pública "usuario".
    const { data: profile, error: profileError } = await supabase
      .from('usuario')
      .insert([
        {
          id: userId,
          nombre,
          apellido,
          genero,
          nivel,
          fecha_nacimiento,
          avatar_url: avatarUrl,
        },
      ])
      .select()
      .single();

    if (profileError) {
      return res.status(500).json({
        success: false,
        data: null,
        error: profileError.message,
      });
    }

    return res.status(201).json({
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