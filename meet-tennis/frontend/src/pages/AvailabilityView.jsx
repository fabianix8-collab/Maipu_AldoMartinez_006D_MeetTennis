import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  MapPin,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';
import TennisBackground from '../components/TennisBackground.jsx';

const DIAS = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

const MODALIDADES = ['Disponible para jugar', 'Buscando partido'];

// Horas seleccionables en los desplegables (07:00 a 23:00, cada 30 minutos).
const HORAS = (() => {
  const lista = [];
  for (let hora = 7; hora <= 23; hora += 1) {
    lista.push(`${String(hora).padStart(2, '0')}:00`);
    if (hora < 23) lista.push(`${String(hora).padStart(2, '0')}:30`);
  }
  return lista;
})();

const inputBase =
  'w-full rounded-xl border border-slate-700/50 bg-slate-800/70 px-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition-colors focus:border-emerald-500';
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-400';

const AVAILABILITY_KEY = 'meettennis_availability';

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('meettennis_auth') || 'null');
  } catch {
    return null;
  }
}

function getUserId() {
  const stored = getStoredUser();
  return stored?.user?.id || stored?.profile?.id || '';
}

function getUserKey() {
  return getUserId() || 'invitado';
}

// Extrae la comuna desde la dirección (última parte tras la coma).
function extraerComuna(direccion) {
  if (!direccion) return '';
  const partes = direccion.split(',');
  return partes[partes.length - 1]?.trim() || '';
}

// Calcula las coordenadas de un bloque según la zona elegida:
// - Cancha específica → sus coordenadas exactas.
// - Comuna → promedio de las coordenadas de sus canchas.
function obtenerCoordenadasZona(zona, canchas) {
  const [tipoZona, nombreZona] = parseZona(zona);
  if (!nombreZona) {
    return { latitud: null, longitud: null, tipoZona, zona: nombreZona };
  }

  if (tipoZona === 'cancha') {
    const cancha = canchas.find((c) => c.nombre === nombreZona);
    if (cancha && cancha.latitud != null && cancha.longitud != null) {
      return {
        latitud: Number(cancha.latitud),
        longitud: Number(cancha.longitud),
        tipoZona,
        zona: nombreZona,
      };
    }
  }

  if (tipoZona === 'comuna') {
    const enComuna = canchas.filter(
      (c) => extraerComuna(c.direccion) === nombreZona,
    );
    if (enComuna.length > 0) {
      const latitud =
        enComuna.reduce((suma, c) => suma + Number(c.latitud), 0) /
        enComuna.length;
      const longitud =
        enComuna.reduce((suma, c) => suma + Number(c.longitud), 0) /
        enComuna.length;
      return { latitud, longitud, tipoZona, zona: nombreZona };
    }
  }

  return { latitud: null, longitud: null, tipoZona, zona: nombreZona };
}

function loadSlots() {
  try {
    const raw = JSON.parse(localStorage.getItem(AVAILABILITY_KEY) || '{}');
    const slots = raw[getUserKey()];
    return Array.isArray(slots) ? slots : [];
  } catch {
    return [];
  }
}

function persistSlots(slots) {
  try {
    const raw = JSON.parse(localStorage.getItem(AVAILABILITY_KEY) || '{}');
    raw[getUserKey()] = slots;
    localStorage.setItem(AVAILABILITY_KEY, JSON.stringify(raw));
  } catch {
    // Silencioso: si el almacenamiento no está disponible, la sesión sigue funcionando.
  }
}

// El select envía "comuna:Las Condes" o "cancha:Club de Tenis Maipú".
function parseZona(value) {
  if (!value) return ['', ''];
  if (value.startsWith('comuna:')) return ['comuna', value.slice(7)];
  if (value.startsWith('cancha:')) return ['cancha', value.slice(7)];
  return ['', value];
}

// Texto legible para la zona o cancha guardada.
function formatZona(slot) {
  if (!slot.zona) return '';
  if (slot.tipoZona === 'comuna') return `Zona: ${slot.zona}`;
  if (slot.tipoZona === 'cancha') return `Cancha: ${slot.zona}`;
  return slot.zona;
}

function AvailabilityView() {
  const [selectedDays, setSelectedDays] = useState([]);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [modalidad, setModalidad] = useState(MODALIDADES[0]);
  const [zona, setZona] = useState('');
  const [slots, setSlots] = useState(loadSlots);
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [canchas, setCanchas] = useState([]);
  const [comunas, setComunas] = useState([]);
  const [loadingCanchas, setLoadingCanchas] = useState(true);
  const [ubicacion, setUbicacion] = useState(null);
  const [geoStatus, setGeoStatus] = useState('idle');

  const userId = getUserId();

  useEffect(() => {
    let activo = true;

    const cargarCanchas = async () => {
      try {
        const response = await fetch('/api/courts');
        const result = await response.json();

        if (activo && response.ok && result.success && result.data) {
          setCanchas(Array.isArray(result.data.canchas) ? result.data.canchas : []);
          setComunas(Array.isArray(result.data.comunas) ? result.data.comunas : []);
        }
      } catch {
        // Silencioso: si falla la carga, el usuario aún puede elegir otra opción.
      } finally {
        if (activo) setLoadingCanchas(false);
      }
    };

    // Carga la disponibilidad publicada en el backend (compartida).
    // Si el backend no responde, usa la copia local como respaldo.
    const cargarDisponibilidad = async () => {
      if (!userId) return;

      try {
        const response = await fetch(`/api/matches/availability/${userId}`);
        const result = await response.json();

        if (activo && response.ok && result.success && Array.isArray(result.data)) {
          setSlots(result.data);
          persistSlots(result.data);
        }
      } catch {
        // Silencioso: se mantiene la disponibilidad local.
      }
    };

    // Geolocalización opcional: mejora la recomendación de cancha.
    const solicitarUbicacion = () => {
      if (!('geolocation' in navigator)) return;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!activo) return;
          setUbicacion({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setGeoStatus('success');
        },
        () => {
          if (activo) setGeoStatus('error');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    };

    cargarCanchas();
    cargarDisponibilidad();
    solicitarUbicacion();

    return () => {
      activo = false;
    };
  }, [userId]);

  const errors = useMemo(() => {
    const list = {};

    if (selectedDays.length === 0) {
      list.dias = 'Selecciona al menos un día.';
    }
    if (!desde) {
      list.desde = 'Indica la hora de inicio.';
    }
    if (!hasta) {
      list.hasta = 'Indica la hora de término.';
    } else if (desde && hasta <= desde) {
      list.hasta = 'La hora de término debe ser mayor a la de inicio.';
    }

    return list;
  }, [selectedDays, desde, hasta]);

  const isValid = Object.keys(errors).length === 0;

  const toggleDay = (dia) => {
    setSelectedDays((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia],
    );
    setStatus({ type: 'idle', message: '' });
  };

  // Publica la lista completa de bloques en el backend (compartida).
  // Devuelve true si la sincronización fue exitosa.
  const guardarEnBackend = async (lista) => {
    if (!userId) return true;

    try {
      const response = await fetch('/api/matches/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, slots: lista }),
      });
      const result = await response.json();
      return response.ok && result.success;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setTouched(true);

    if (!isValid) return;

    // Coordenadas del bloque: geolocalización real si está disponible,
    // si no, las derivadas de la cancha o comuna elegida.
    const { latitud, longitud, tipoZona, zona: nombreZona } =
      obtenerCoordenadasZona(zona, canchas);

    const newSlot = {
      id: crypto.randomUUID(),
      dias: selectedDays,
      desde,
      hasta,
      modalidad,
      zona: nombreZona,
      tipoZona,
      latitud: ubicacion?.lat ?? latitud,
      longitud: ubicacion?.lng ?? longitud,
    };

    const nextSlots = [...slots, newSlot];
    setSlots(nextSlots);
    persistSlots(nextSlots);
    const sincronizado = await guardarEnBackend(nextSlots);

    setSelectedDays([]);
    setDesde('');
    setHasta('');
    setZona('');
    setModalidad(MODALIDADES[0]);
    setTouched(false);
    setStatus(
      sincronizado
        ? {
            type: 'success',
            message: 'Disponibilidad publicada. Otros jugadores ya pueden encontrarte.',
          }
        : {
            type: 'warning',
            message:
              'Disponibilidad guardada en este dispositivo, pero no se pudo sincronizar con el servidor. Verifica que el backend esté activo para que otros jugadores puedan encontrarte.',
          },
    );
  };

  const removeSlot = async (id) => {
    const nextSlots = slots.filter((slot) => slot.id !== id);
    setSlots(nextSlots);
    persistSlots(nextSlots);
    await guardarEnBackend(nextSlots);
    setStatus({ type: 'idle', message: '' });
  };

  const renderError = (name) => {
    if (!touched || !errors[name]) return null;
    return (
      <p className="mt-1.5 flex items-center gap-1 text-xs text-red-400">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        {errors[name]}
      </p>
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900 px-4 py-8">
      <TennisBackground />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col">
        <header className="flex items-start justify-between gap-4">
          <div>
            <BrandLogo className="mb-4 h-16 sm:h-20" />
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600/15 text-emerald-400">
                <CalendarClock className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-2xl font-bold leading-tight text-slate-100">
                  Mi Disponibilidad
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  Publica cuándo puedes jugar
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

        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-8 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-md"
        >
          <div>
            <span className={labelClass}>Días disponibles</span>
            <div className="flex flex-wrap gap-2">
              {DIAS.map((dia) => {
                const active = selectedDays.includes(dia);
                return (
                  <button
                    type="button"
                    key={dia}
                    onClick={() => toggleDay(dia)}
                    aria-pressed={active}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-emerald-500 bg-emerald-600/20 text-emerald-300'
                        : 'border-slate-700/50 bg-slate-800/70 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                    }`}
                  >
                    {dia}
                  </button>
                );
              })}
            </div>
            {renderError('dias')}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} htmlFor="desde">
                Desde
              </label>
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <select
                  id="desde"
                  name="desde"
                  value={desde}
                  onChange={(event) => {
                    setDesde(event.target.value);
                    setStatus({ type: 'idle', message: '' });
                  }}
                  className={`${inputBase} appearance-none pl-11`}
                >
                  <option value="" className="bg-slate-800 text-slate-100">
                    --:--
                  </option>
                  {HORAS.map((hora) => (
                    <option
                      key={hora}
                      value={hora}
                      className="bg-slate-800 text-slate-100"
                    >
                      {hora}
                    </option>
                  ))}
                </select>
              </div>
              {renderError('desde')}
            </div>

            <div>
              <label className={labelClass} htmlFor="hasta">
                Hasta
              </label>
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <select
                  id="hasta"
                  name="hasta"
                  value={hasta}
                  onChange={(event) => {
                    setHasta(event.target.value);
                    setStatus({ type: 'idle', message: '' });
                  }}
                  className={`${inputBase} appearance-none pl-11`}
                >
                  <option value="" className="bg-slate-800 text-slate-100">
                    --:--
                  </option>
                  {HORAS.map((hora) => (
                    <option
                      key={hora}
                      value={hora}
                      className="bg-slate-800 text-slate-100"
                    >
                      {hora}
                    </option>
                  ))}
                </select>
              </div>
              {renderError('hasta')}
            </div>
          </div>

          <div className="mt-5">
            <label className={labelClass} htmlFor="modalidad">
              Modalidad
            </label>
            <select
              id="modalidad"
              name="modalidad"
              value={modalidad}
              onChange={(event) => setModalidad(event.target.value)}
              className={`${inputBase} appearance-none`}
            >
              {MODALIDADES.map((item) => (
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

          <div className="mt-5">
            <label className={labelClass} htmlFor="zona">
              Zona o cancha preferida (opcional)
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                id="zona"
                name="zona"
                value={zona}
                onChange={(event) => setZona(event.target.value)}
                disabled={loadingCanchas}
                className={`${inputBase} appearance-none pl-11 disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <option value="" className="bg-slate-800 text-slate-100">
                  {loadingCanchas
                    ? 'Cargando zonas y canchas...'
                    : 'Cualquier zona o cancha'}
                </option>
                {comunas.length > 0 && (
                  <optgroup
                    label="Zona (comuna)"
                    className="bg-slate-800 text-slate-100"
                  >
                    {comunas.map((comuna) => (
                      <option
                        key={comuna}
                        value={`comuna:${comuna}`}
                        className="bg-slate-800 text-slate-100"
                      >
                        {comuna}
                      </option>
                    ))}
                  </optgroup>
                )}
                {canchas.length > 0 && (
                  <optgroup
                    label="Cancha específica"
                    className="bg-slate-800 text-slate-100"
                  >
                    {canchas.map((cancha) => (
                      <option
                        key={cancha.id}
                        value={`cancha:${cancha.nombre}`}
                        className="bg-slate-800 text-slate-100"
                      >
                        {cancha.nombre}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Elige una comuna para buscar por zona o una cancha específica.
            </p>

            {geoStatus === 'success' && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-300">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                Usando tu ubicación actual para recomendar la cancha más cercana.
              </p>
            )}
            {geoStatus === 'error' && (
              <p className="mt-2 text-xs text-slate-500">
                Sin ubicación: la cancha recomendada se calculará desde la zona
                o cancha que elijas.
              </p>
            )}
          </div>

          {status.type === 'success' && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {status.message}
            </div>
          )}

          {status.type === 'warning' && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {status.message}
            </div>
          )}

          <button
            type="submit"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-slate-100 transition-colors hover:bg-emerald-700"
          >
            <Save className="h-5 w-5" />
            Guardar disponibilidad
          </button>
        </form>

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Bloques guardados
          </h2>

          {slots.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/40 p-5 text-center text-sm text-slate-500">
              Aún no has publicado tu disponibilidad.
            </p>
          ) : (
            <ul className="grid gap-3">
              {slots.map((slot) => (
                <li
                  key={slot.id}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-slate-700/50 bg-slate-800/60 p-4 shadow-2xl backdrop-blur-md"
                >
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                      <Clock className="h-4 w-4" />
                      {slot.desde} - {slot.hasta}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      {slot.dias.join(', ')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {slot.modalidad}
                      {slot.zona ? ` · ${formatZona(slot)}` : ''}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeSlot(slot.id)}
                    aria-label="Eliminar bloque"
                    className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-2 text-slate-400 transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-auto pt-10 text-center text-xs text-slate-500">
          <Plus className="mr-1 inline h-3.5 w-3.5" />
          Puedes agregar varios bloques de disponibilidad.
        </p>
      </div>
    </div>
  );
}

export default AvailabilityView;