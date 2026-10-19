import { Router } from 'express';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/auth.js';

dotenv.config();

const router = Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const CATEGORIAS = ['Raquetas', 'Zapatillas', 'Cuerdas', 'Accesorios', 'Ropa'];

// 42703: columna inexistente (falta ejecutar scripts/08_productos.sql).
const FALTA_SCRIPT =
  'Falta ejecutar el script backend/scripts/08_productos.sql en Supabase.';

const mensajeError = (error) => (error.code === '42703' ? FALTA_SCRIPT : error.message);

router.use(requireAuth);

// Lista las categorías disponibles de productos.
router.get('/categorias', async (req, res) => {
  return res.status(200).json({ success: true, data: CATEGORIAS, error: null });
});

// Lista los productos recomendados. Filtros opcionales:
//   ?categoria=Raquetas   ?destacado=true
router.get('/', async (req, res) => {
  try {
    const { categoria, destacado } = req.query;

    let query = supabaseAdmin
      .from('productos')
      .select('id, nombre, descripcion, categoria, precio, imagen_url, enlace, tienda, destacado')
      .order('destacado', { ascending: false })
      .order('created_at', { ascending: true });

    if (categoria) {
      if (!CATEGORIAS.includes(categoria)) {
        return res.status(400).json({
          success: false,
          data: null,
          error: 'Categoría no válida.',
        });
      }
      query = query.eq('categoria', categoria);
    }

    if (destacado === 'true') {
      query = query.eq('destacado', true);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({
        success: false,
        data: null,
        error: mensajeError(error),
      });
    }

    return res.status(200).json({ success: true, data: data || [], error: null });
  } catch (err) {
    return res.status(500).json({
      success: false,
      data: null,
      error: 'Error interno del servidor.',
    });
  }
});

export default router;
