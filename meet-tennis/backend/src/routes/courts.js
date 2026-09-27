import { Router } from 'express';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { extraerComuna } from '../lib/utils.js';

dotenv.config();

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);


// Lista las canchas registradas y las comunas disponibles.
// Sirve para elegir una zona general (comuna) o una cancha específica.
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('canchas')
      .select('id, nombre, direccion, latitud, longitud')
      .order('nombre', { ascending: true });

    if (error) {
      return res.status(500).json({
        success: false,
        data: null,
        error: error.message,
      });
    }

    const canchas = data || [];

    const comunas = [
      ...new Set(canchas.map((cancha) => extraerComuna(cancha.direccion))),
    ]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es'));

    return res.status(200).json({
      success: true,
      data: { canchas, comunas },
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
