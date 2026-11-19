import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, ArrowRight, Car, Clock, ExternalLink, Footprints, Loader2, MapPin, Navigation, Route, X } from 'lucide-react';
import { useLanguage } from '../lib/i18n.js';
import { obtenerUbicacionRuta } from '../lib/ubicacion.js';
import { cargarRuta } from '../lib/rutas.js';
import { crearUrlComoLlegar } from '../lib/mapas.js';
import { TennisBall } from './TennisIcons.jsx';
import TennisRouteMap from './TennisRouteMap.jsx';

export default function CourtRouteModal({ cancha, origen, onCerrar }) {
  const { t, locale } = useLanguage();
  const tituloId = useId();
  const dialogo = useRef(null);
  const cerrar = useRef(null);
  const [modo, setModo] = useState('auto');
  const [recargar, setRecargar] = useState(0);
  const [estado, setEstado] = useState({ fase: 'ubicacion', ruta: null, origen: null, error: '' });

  useEffect(() => {
    const anterior = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cerrar.current?.focus();
    const teclado = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onCerrar(); return; }
      if (event.key !== 'Tab') return;
      const focos = [...dialogo.current.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]')]
        .filter((element) => element.getClientRects().length > 0);
      const primero = focos[0];
      const ultimo = focos.at(-1);
      if (event.shiftKey && document.activeElement === primero) { event.preventDefault(); ultimo?.focus(); }
      else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primero?.focus(); }
    };
    document.addEventListener('keydown', teclado);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', teclado);
      anterior?.focus?.();
    };
  }, [onCerrar]);

  useEffect(() => {
    const controller = new AbortController();
    const calcular = async () => {
      try {
        const punto = await obtenerUbicacionRuta({ origen, signal: controller.signal });
        if (controller.signal.aborted) return;
        setEstado({ fase: 'ruta', ruta: null, origen: punto, error: '' });
        const ruta = await cargarRuta(punto, cancha, modo, { signal: controller.signal });
        if (!controller.signal.aborted) setEstado({ fase: 'lista', origen: punto, ruta, error: '' });
      } catch (error) {
        if (!controller.signal.aborted) setEstado({ fase: 'error', ruta: null, origen: null, error: error.message });
      }
    };
    calcular();
    return () => controller.abort();
  }, [cancha, origen, modo, recargar]);

  const distancia = (metros) => metros < 1000
    ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(metros)} m`
    : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(metros / 1000)} km`;
  const cargando = ['ubicacion', 'ruta'].includes(estado.fase);
  // Maps obtiene la posición del dispositivo al abrirse, en lugar de fijar
  // como origen la posición que se consultó al preparar la vista previa.
  const navegacion = crearUrlComoLlegar(cancha, undefined, modo);

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-sm sm:p-6"
      onClick={(event) => { if (event.target === event.currentTarget) onCerrar(); }}>
      <section ref={dialogo} role="dialog" aria-modal="true" aria-labelledby={tituloId}
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-emerald-500/30 bg-slate-900 shadow-2xl">
        <header className="flex shrink-0 items-start gap-3 border-b border-slate-700/50 bg-gradient-to-r from-emerald-950/70 to-slate-900 px-4 py-4 sm:px-6">
          <span className="rounded-2xl bg-emerald-500/15 p-2.5 text-emerald-300"><TennisBall className="h-7 w-7" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">{t('Rumbo a la cancha')}</p>
            <h2 id={tituloId} className="mt-1 text-lg font-bold leading-tight text-slate-100">{cancha.nombre}</h2>
            <p className="mt-1 text-sm text-slate-400">{cancha.direccion}</p>
          </div>
          <button ref={cerrar} type="button" onClick={onCerrar} aria-label={t('Cerrar recorrido')}
            className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-2 text-slate-400 hover:border-emerald-500/50 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"><X className="h-5 w-5" /></button>
        </header>
        <div className="overflow-y-auto overscroll-contain p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-sm text-slate-300"><Navigation className="h-4 w-4 text-sky-400" />{t('Tu ubicación')}<ArrowRight className="h-3.5 w-3.5 text-slate-500" /><MapPin className="h-4 w-4 text-emerald-400" />{t('Cancha')}</span>
            <div role="group" aria-label={t('Medio de transporte')} className="flex gap-1 rounded-xl border border-slate-700/50 bg-slate-800/60 p-1">
              {[['auto', Car, 'En auto'], ['pie', Footprints, 'A pie']].map(([valor, Icono, texto]) => (
                <button key={valor} type="button" aria-pressed={modo === valor} onClick={() => {
                  if (modo === valor) return;
                  setEstado({ fase: 'ubicacion', ruta: null, origen: null, error: '' });
                  setModo(valor);
                }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${modo === valor ? 'bg-emerald-600 text-slate-100' : 'text-slate-400 hover:text-slate-100'}`}><Icono className="h-4 w-4" />{t(texto)}</button>
              ))}
            </div>
          </div>
          {cargando && <div role="status" className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border border-slate-700/50 bg-slate-950/40 p-6 text-center"><TennisBall className="h-12 w-12 text-emerald-400" /><Loader2 className="h-5 w-5 animate-spin text-emerald-300" /><p className="text-sm text-slate-300">{estado.fase === 'ubicacion' ? t('Comprobando tu ubicación actual...') : t('Calculando el recorrido por calles...')}</p></div>}
          {estado.fase === 'error' && <div role="alert" className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-amber-500/30 bg-slate-950/40 p-6 text-center"><AlertCircle className="h-8 w-8 text-amber-300" /><p className="max-w-md text-sm text-slate-300">{t(estado.error)}</p><button type="button" onClick={() => {
            setEstado({ fase: 'ubicacion', ruta: null, origen: null, error: '' });
            setRecargar((n) => n + 1);
          }} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">{t('Reintentar')}</button></div>}
          {estado.ruta && <>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/15 to-slate-800/60 px-4 py-3"><p className="flex items-center gap-1.5 text-xs text-emerald-200/80"><Route className="h-3.5 w-3.5 text-emerald-400" />{t('Distancia por calles')}</p><p className="mt-1 text-xl font-bold text-emerald-300">{distancia(estado.ruta.distancia)}</p></div>
              <div className="rounded-xl border border-sky-500/25 bg-gradient-to-br from-sky-500/15 to-slate-800/60 px-4 py-3"><p className="flex items-center gap-1.5 text-xs text-sky-200/80"><Clock className="h-3.5 w-3.5 text-sky-400" />{t('Tiempo estimado')}</p><p className="mt-1 text-xl font-bold text-sky-200">{Math.max(1, Math.round(estado.ruta.duracion / 60))} min</p></div>
            </div>
            <TennisRouteMap key={locale} origen={estado.origen} cancha={cancha} ruta={estado.ruta} />
          </>}
        </div>
        {estado.ruta && navegacion && <footer className="shrink-0 border-t border-slate-700/50 bg-slate-900 px-4 py-3 sm:px-6">
          <a href={navegacion} target="_blank" rel="noopener noreferrer"
            aria-label={t('Iniciar navegación en Google Maps a {0}', { 0: cancha.nombre })}
            className="flex w-full items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-600/15 px-4 py-3 text-left text-sm font-semibold text-emerald-300 transition-colors hover:border-emerald-400/60 hover:bg-emerald-600/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
            <Navigation className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">{t('Iniciar navegación')}</span>
            <span className="shrink-0 rounded-md bg-slate-950/40 px-2 py-1 text-xs font-medium text-slate-300">Google Maps</span>
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          </a>
        </footer>}
      </section>
    </div>, document.body,
  );
}
