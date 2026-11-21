// Sin --confirmar muestra el plan. Solo agrega productos; no modifica los existentes.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
const catalogo = JSON.parse(await readFile(new URL('../data/productos-adicionales.json', import.meta.url), 'utf8'));
const categorias = new Set(['Raquetas', 'Zapatillas', 'Cuerdas', 'Accesorios', 'Ropa']);
const campos = ['nombre', 'descripcion', 'categoria', 'precio', 'imagen_url', 'enlace', 'tienda', 'destacado'];
const normalizar = (texto) => texto.trim().toLocaleLowerCase('es');

async function agregarProductos() {
  const enlaces = new Set();
  const nombres = new Set();
  for (const producto of catalogo.productos) {
    if (!campos.every((campo) => Object.hasOwn(producto, campo)) || !categorias.has(producto.categoria)
      || !Number.isInteger(producto.precio) || producto.precio <= 0
      || !producto.nombre.trim() || !producto.descripcion.trim() || !producto.tienda.trim()
      || typeof producto.destacado !== 'boolean'
      || new URL(producto.enlace).protocol !== 'https:' || new URL(producto.imagen_url).protocol !== 'https:') {
      throw new Error(`Ficha incompleta o inválida: ${producto.nombre}`);
    }
    if (enlaces.has(producto.enlace) || nombres.has(normalizar(producto.nombre))) {
      throw new Error(`Producto duplicado en el catálogo: ${producto.nombre}`);
    }
    enlaces.add(producto.enlace);
    nombres.add(normalizar(producto.nombre));
  }

  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: actuales, error } = await db.from('productos').select('id,nombre,enlace');
  if (error) throw new Error(error.message);
  const enlacesActuales = new Set(actuales.map((producto) => producto.enlace));
  const nombresActuales = new Set(actuales.map((producto) => normalizar(producto.nombre)));
  const nuevos = catalogo.productos.filter((producto) => !enlacesActuales.has(producto.enlace)
    && !nombresActuales.has(normalizar(producto.nombre)));
  console.log(JSON.stringify({ revisadoEl: catalogo.revisadoEl, existentes: actuales.length,
    porAgregar: nuevos.map(({ nombre, categoria, precio, tienda }) => ({ nombre, categoria, precio, tienda })),
    yaPresentes: catalogo.productos.length - nuevos.length }, null, 2));
  if (!process.argv.includes('--confirmar')) {
    console.log('Revisión solamente. Usa --confirmar para agregar estas recomendaciones.');
    return;
  }
  if (nuevos.length) {
    const { error: insertarError } = await db.from('productos').insert(nuevos.map((producto) =>
      Object.fromEntries(campos.map((campo) => [campo, producto[campo]]))));
    if (insertarError) throw new Error(insertarError.message);
  }
  const { data: resultado, error: verificarError } = await db.from('productos').select('id,nombre,categoria,enlace');
  if (verificarError) throw new Error(verificarError.message);
  if (!actuales.every((anterior) => resultado.some((producto) => producto.id === anterior.id
    && producto.nombre === anterior.nombre && producto.enlace === anterior.enlace))) {
    throw new Error('La verificación detectó cambios en los productos anteriores.');
  }
  if (!catalogo.productos.every((ficha) => resultado.some((producto) => producto.enlace === ficha.enlace
    || normalizar(producto.nombre) === normalizar(ficha.nombre)))) {
    throw new Error('La verificación detectó recomendaciones pendientes.');
  }
  console.log(JSON.stringify({ agregados: nuevos.length, total: resultado.length,
    porCategoria: Object.fromEntries([...categorias].map((categoria) => [categoria,
      resultado.filter((producto) => producto.categoria === categoria).length])) }, null, 2));
}

agregarProductos().catch((error) => { console.error(error.message); process.exitCode = 1; });
