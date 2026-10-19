import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  ShoppingBag,
  Store,
  Tag,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import TennisBackground from '../components/TennisBackground.jsx';
import { apiFetch } from '../lib/api.js';

const CATEGORIAS = ['Raquetas', 'Zapatillas', 'Cuerdas', 'Accesorios', 'Ropa'];

// Precio en CLP → "$189.990".
function formatPrecio(precio) {
  if (precio == null) return null;
  return `$${Number(precio).toLocaleString('es-CL')}`;
}

function ProductoCard({ producto }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/60 shadow-2xl backdrop-blur-md">
      <div className="relative flex h-40 items-center justify-center bg-slate-900/60">
        {producto.imagen_url ? (
          <img
            src={producto.imagen_url}
            alt={producto.nombre}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600/15 text-emerald-400">
            <ShoppingBag className="h-8 w-8" />
          </span>
        )}
        {producto.destacado && (
          <span className="absolute left-3 top-3 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-slate-900 shadow-lg">
            Destacado
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Tag className="h-3.5 w-3.5" />
          {producto.categoria}
        </div>
        <h3 className="font-semibold leading-tight text-slate-100">{producto.nombre}</h3>
        {producto.descripcion && (
          <p className="text-sm text-slate-400">{producto.descripcion}</p>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            {formatPrecio(producto.precio) && (
              <p className="text-lg font-bold text-emerald-300">
                {formatPrecio(producto.precio)}
              </p>
            )}
            <p className="flex items-center gap-1 text-xs text-slate-400">
              <Store className="h-3.5 w-3.5" />
              {producto.tienda}
            </p>
          </div>
          <a
            href={producto.enlace}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-emerald-500"
          >
            Comprar
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </article>
  );
}

function ProductosView() {
  const navigate = useNavigate();
  const [productos, setProductos] = useState([]);
  const [categoria, setCategoria] = useState('Todas');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    (async () => {
      setCargando(true);
      setError('');
      try {
        const query = categoria === 'Todas' ? '' : `?categoria=${encodeURIComponent(categoria)}`;
        const response = await apiFetch(`/api/products${query}`);
        const result = await response.json();
        if (activo && response.ok && result.success) {
          setProductos(result.data || []);
        } else if (activo) {
          setError(result.error || 'No se pudieron cargar los productos.');
        }
      } catch {
        if (activo) setError('No se pudo conectar con el servidor.');
      } finally {
        if (activo) setCargando(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, [categoria]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-900 px-4 py-5">
      <TennisBackground />

      <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-md flex-col">
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Volver"
            className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-2.5 text-slate-400 shadow-2xl backdrop-blur-md transition-colors hover:border-emerald-500/50 hover:text-emerald-400"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <BrandLogo className="h-10" />
        </header>

        <div className="mt-4 flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600/15 text-emerald-400">
            <ShoppingBag className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-slate-100">Recomendaciones</h1>
            <p className="text-xs text-slate-400">
              Equipo de tenis de tiendas asociadas para mejorar tu juego.
            </p>
          </div>
        </div>

        {/* Filtro por categoría */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {['Todas', ...CATEGORIAS].map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setCategoria(c)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                categoria === c
                  ? 'bg-emerald-600 text-white'
                  : 'border border-slate-700/50 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-4 flex-1">
          {cargando ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
            </div>
          ) : productos.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600/15 text-emerald-400">
                <ShoppingBag className="h-8 w-8" />
              </span>
              <p className="font-semibold text-slate-200">Sin productos en esta categoría</p>
              <p className="text-sm text-slate-400">
                Pronto agregaremos más recomendaciones de equipo.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {productos.map((p) => (
                <ProductoCard key={p.id} producto={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductosView;
