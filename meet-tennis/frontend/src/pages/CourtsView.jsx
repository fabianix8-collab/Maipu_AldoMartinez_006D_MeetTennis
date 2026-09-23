import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  MapPin,
  Navigation,
  Search,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import TennisBackground from '../components/TennisBackground.jsx';

const inputBase =
  'w-full rounded-xl border border-slate-700/50 bg-slate-800/70 px-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-emerald-500';
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-400';

// Radios de búsqueda disponibles (en kilómetros).
const RADIOS = [5, 10, 15, 20];
const RADIO_POR_DEFECTO = 10;

// Extrae la comuna desde la dirección (última parte tras la coma).
function extraerComuna(direccion) {
  if (!direccion) return '';
  const partes = direccion.split(',');
  return partes[partes.length - 1]?.trim() || '';
}

// Distancia en kilómetros entre dos coordenadas (fórmula de Haversine).
function distanciaKm(lat1, lon1, lat2, lon2) {
  const RADIO_TIERRA = 6371;
  const aRad = (grados) => (grados * Math.PI) / 180;

  const dLat = aRad(lat2 - lat1);
  const dLon = aRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRad(lat1)) * Math.cos(aRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return 2 * RADIO_TIERRA * Math.asin(Math.sqrt(a));
}

function CourtsView() {
  const [canchas, setCanchas] = useState([]);
  const [comunas, setComunas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modo, setModo] = useState('comuna');
  const [comuna, setComuna] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const [radioKm, setRadioKm] = useState(RADIO_POR_DEFECTO);
  const [ubicacion, setUbicacion] = useState(null);
  const [geoStatus, setGeoStatus] = useState('idle');
  const [geoError, setGeoError] = useState('');

  useEffect(() => {
    let activo = true;

    const cargarCanchas = async () => {
      try {
        const response = await fetch('/api/courts');
        const result = await response.json();

        if (!activo) return;

        if (response.ok && result.success && result.data) {
          setCanchas(Array.isArray(result.data.canchas) ? result.data.canchas : []);
          setComunas(Array.isArray(result.data.comunas) ? result.data.comunas : []);
        } else {
          setError('No se pudieron cargar las canchas.');
        }
      } catch {
        if (activo) setError('No se pudo conectar con el servidor.');
      } finally {
        if (activo) setLoading(false);
      }
    };

    cargarCanchas();

    return () => {
      activo = false;
    };
  }, []);

  const solicitarUbicacion = () => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('error');
      setGeoError('Tu navegador no soporta la geolocalización.');
      return;
    }

    setGeoStatus('loading');
    setGeoError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUbicacion({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGeoStatus('success');
      },
      () => {
        setGeoStatus('error');
        setGeoError(
          'No pudimos obtener tu ubicación. Revisa los permisos del navegador.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const seleccionarCerca = () => {
    setModo('cerca');
    if (!ubicacion && geoStatus !== 'loading') solicitarUbicacion();
  };

  const filtradas = useMemo(() => {
    if (modo === 'comuna') {
      const termino = busqueda.trim().toLowerCase();

      return canchas.filter((cancha) => {
        const coincideComuna =
          !comuna || extraerComuna(cancha.direccion) === comuna;
        const coincideBusqueda =
          !termino || cancha.nombre.toLowerCase().includes(termino);
        return coincideComuna && coincideBusqueda;
      });
    }

    if (!ubicacion) return [];

    return canchas
      .map((cancha) => ({
        ...cancha,
        distancia: distanciaKm(
          ubicacion.lat,
          ubicacion.lng,
          cancha.latitud,
          cancha.longitud,
        ),
      }))
      .filter((cancha) => cancha.distancia <= radioKm)
      .sort((a, b) => a.distancia - b.distancia);
  }, [canchas, comuna, busqueda, modo, ubicacion, radioKm]);

  const resumen =
    modo === 'cerca'
      ? `${filtradas.length} ${
          filtradas.length === 1 ? 'cancha' : 'canchas'
        } en un radio de ${radioKm} km`
      : `${filtradas.length} ${
          filtradas.length === 1 ? 'cancha encontrada' : 'canchas encontradas'
        }`;

  const sinResultadosCerca = (
    <p className="rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/40 p-5 text-center text-sm text-slate-500">
      No hay canchas en un radio de {radioKm} km. Prueba ampliar el radio de
      búsqueda.
    </p>
  );

  const sinResultadosComuna = (
    <p className="rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/40 p-5 text-center text-sm text-slate-500">
      No se encontraron canchas para esa búsqueda.
    </p>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900 px-4 py-8">
      <TennisBackground />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col">
        <header className="flex items-start justify-between gap-4">
          <div>
            <BrandLogo className="mb-4 h-16 sm:h-20" />
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600/15 text-emerald-400">
                <MapPin className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-2xl font-bold leading-tight text-slate-100">
                  Canchas Cercanas
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  Encuentra canchas de Santiago
                </p>
              </div>
            </div>
          </div>

          <Link
            to="/"
            aria-label="Volver al inicio"
            className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-2.5 text-slate-400 shadow-2xl backdrop-blur-md transition-colors hover:border-emerald-500/50 hover:text-emerald-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </header>

        <div className="mt-8 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-md">
          <span className={labelClass}>Buscar por</span>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-700/50 bg-slate-800/50 p-1">
            <button
              type="button"
              onClick={() => setModo('comuna')}
              aria-pressed={modo === 'comuna'}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                modo === 'comuna'
                  ? 'bg-emerald-600 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapPin className="h-4 w-4" />
              Por comuna
            </button>
            <button
              type="button"
              onClick={seleccionarCerca}
              aria-pressed={modo === 'cerca'}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                modo === 'cerca'
                  ? 'bg-emerald-600 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Navigation className="h-4 w-4" />
              Cerca de mí
            </button>
          </div>

          {modo === 'comuna' ? (
            <>
              <div className="mt-4">
                <label className={labelClass} htmlFor="comuna">
                  Comuna o zona
                </label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <select
                    id="comuna"
                    name="comuna"
                    value={comuna}
                    onChange={(event) => setComuna(event.target.value)}
                    disabled={loading}
                    className={`${inputBase} appearance-none pl-11 disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <option value="" className="bg-slate-800 text-slate-100">
                      {loading ? 'Cargando comunas...' : 'Todas las comunas'}
                    </option>
                    {comunas.map((item) => (
                      <option
                        key={item}
                        value={item}
                        className="bg-slate-800 text-slate-100"
                      >
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className={labelClass} htmlFor="busqueda">
                  Buscar cancha
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    id="busqueda"
                    name="busqueda"
                    type="text"
                    value={busqueda}
                    onChange={(event) => setBusqueda(event.target.value)}
                    placeholder="Ej: Parque, Club, Municipal..."
                    className={`${inputBase} pl-11`}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="mt-4">
              <label className={labelClass} htmlFor="radio">
                Radio de búsqueda
              </label>
              <div className="relative">
                <Navigation className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <select
                  id="radio"
                  name="radio"
                  value={radioKm}
                  onChange={(event) => setRadioKm(Number(event.target.value))}
                  className={`${inputBase} appearance-none pl-11`}
                >
                  {RADIOS.map((radio) => (
                    <option
                      key={radio}
                      value={radio}
                      className="bg-slate-800 text-slate-100"
                    >
                      {radio} km a la redonda
                    </option>
                  ))}
                </select>
              </div>

              {geoStatus === 'loading' && (
                <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Obteniendo tu ubicación...
                </p>
              )}

              {geoStatus === 'success' && (
                <p className="mt-3 flex items-center gap-2 text-xs text-emerald-300">
                  <Navigation className="h-3.5 w-3.5" />
                  Usando tu ubicación actual · radio de {radioKm} km
                </p>
              )}

              {geoStatus === 'error' && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {geoError}
                    <button
                      type="button"
                      onClick={solicitarUbicacion}
                      className="ml-1 font-semibold text-red-200 underline"
                    >
                      Reintentar
                    </button>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            {loading ? 'Buscando canchas...' : resumen}
          </h2>

          {loading ? (
            <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/40 p-5 text-center text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando canchas...
            </p>
          ) : error ? (
            <p className="flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : modo === 'cerca' && geoStatus === 'loading' ? (
            <p className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/40 p-5 text-center text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Obteniendo tu ubicación...
            </p>
          ) : modo === 'cerca' && geoStatus === 'error' ? (
            <p className="rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/40 p-5 text-center text-sm text-slate-500">
              Activa tu ubicación para ver las canchas cercanas.
            </p>
          ) : filtradas.length === 0 ? (
            modo === 'cerca' ? (
              sinResultadosCerca
            ) : (
              sinResultadosComuna
            )
          ) : (
            <ul className="grid gap-3">
              {filtradas.map((cancha) => (
                <li
                  key={cancha.id}
                  className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4 shadow-2xl backdrop-blur-md"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-400">
                      <MapPin className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">
                        {cancha.nombre}
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        {cancha.direccion}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                          {extraerComuna(cancha.direccion)}
                        </span>
                        {typeof cancha.distancia === 'number' && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-600/50 bg-slate-900/60 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
                            <Navigation className="h-3 w-3" />
                            a {cancha.distancia.toFixed(1)} km
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${cancha.latitud},${cancha.longitud}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700/50 bg-slate-900/60 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-300"
                  >
                    <Navigation className="h-4 w-4" />
                    Ver en el mapa
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-auto pt-10 text-center text-xs text-slate-500">
          Solo se muestran canchas de Santiago.
        </p>
      </div>
    </div>
  );
}

export default CourtsView;
