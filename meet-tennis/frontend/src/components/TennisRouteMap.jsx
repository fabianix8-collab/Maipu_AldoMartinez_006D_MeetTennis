import { useEffect, useRef, useState } from 'react';
import { Expand, Loader2 } from 'lucide-react';
import { translate, useLanguage } from '../lib/i18n.js';
import 'leaflet/dist/leaflet.css';
import '../styles/ruta.css';

const PELOTA = '<div class="tennis-map-ball"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M6.6 5.6c3 3 3 9.8 0 12.8M17.4 5.6c-3 3-3 9.8 0 12.8"/></svg></div>';

export default function TennisRouteMap({ origen, cancha, ruta }) {
  const { t, language } = useLanguage();
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const encuadre = useRef(null);
  const animaciones = useRef([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    let instancia;
    let observer;
    let movimientoReducido;
    let cambiarMovimiento;
    let iniciarEntrada;
    const iniciar = async () => {
      try {
        const leaflet = await import('leaflet');
        if (!activo) return;
        const L = leaflet.default || leaflet;
        instancia = L.map(contenedor.current, { zoomControl: false, scrollWheelZoom: false, attributionControl: true });
        mapa.current = instancia;
        L.control.zoom({ position: 'bottomright', zoomInTitle: translate('Acercar'), zoomOutTitle: translate('Alejar') }).addTo(instancia);
        instancia.attributionControl.setPrefix(false);

        const bounds = L.latLngBounds(ruta.puntos).extend([origen.lat, origen.lng]).extend([cancha.latitud, cancha.longitud]);
        encuadre.current = () => instancia.fitBounds(bounds, { paddingTopLeft: [38, 42], paddingBottomRight: [38, 58], maxZoom: 17, animate: false });
        encuadre.current();
        const { crearFondoMapa, CREDITOS_MAPA } = await import('../lib/fondoMapa.js');
        if (!activo) return;
        const fondo = crearFondoMapa(instancia);
        instancia.attributionControl.addAttribution(import.meta.env.VITE_MAP_ATTRIBUTION || CREDITOS_MAPA);
        instancia.attributionControl.addAttribution(
          '<a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener noreferrer">OSRM/FOSSGIS</a> · '
          + `<a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer" title="${translate('Corregir el mapa')}">${translate('Corregir')}</a>`,
        );
        const vector = fondo.getMaplibreMap();
        vector.on('load', () => {
          if (!activo) return;
          contenedor.current.dataset.basemapReady = 'true';
          iniciarEntrada?.();
          setCargando(false);
        });
        vector.on('error', () => {
          if (!activo) return;
          setError('No se pudieron cargar algunas calles del mapa.');
          setCargando(false);
        });
        const borde = L.polyline(ruta.puntos, { color: '#022c22', weight: 10, opacity: 0.9, interactive: false }).addTo(instancia);
        const linea = L.polyline(ruta.puntos, { className: 'tennis-route-line', color: '#34d399', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(instancia);
        L.polyline(ruta.puntos, { className: 'tennis-route-flow', color: '#d1fae5', weight: 2, opacity: 0.9,
          dashArray: '1 19', lineCap: 'round', interactive: false }).addTo(instancia);

        if (origen.precision > 0 && origen.precision <= 1000) {
          L.circle([origen.lat, origen.lng], { radius: origen.precision, color: '#38bdf8', weight: 1, fillColor: '#38bdf8', fillOpacity: 0.08, interactive: false }).addTo(instancia);
        }
        L.circleMarker([origen.lat, origen.lng], { className: 'tennis-map-origin-pulse', radius: 14, stroke: false,
          fillColor: '#38bdf8', fillOpacity: 0.35, interactive: false }).addTo(instancia);
        L.circleMarker([origen.lat, origen.lng], { radius: 8, color: '#e0f2fe', weight: 3, fillColor: '#0ea5e9', fillOpacity: 1 })
          .bindTooltip(translate('Tu ubicación'), { direction: 'top', offset: [0, -8] }).addTo(instancia);
        const nombre = document.createElement('span');
        nombre.textContent = cancha.nombre;
        L.marker([cancha.latitud, cancha.longitud], {
          icon: L.divIcon({ className: 'tennis-map-destination', html: PELOTA, iconSize: [36, 36], iconAnchor: [18, 18] }),
          alt: cancha.nombre,
        }).bindTooltip(nombre, { direction: 'top', offset: [0, -20] }).addTo(instancia);
        encuadre.current();

        // Se anima únicamente la presentación; los puntos geográficos no se mueven.
        movimientoReducido = window.matchMedia('(prefers-reduced-motion: reduce)');
        const terminarEntrada = () => { animaciones.current.forEach((animation) => animation.cancel()); animaciones.current = []; };
        iniciarEntrada = () => {
          if (movimientoReducido.matches) return;
          animaciones.current = [borde, linea].map((capa) => {
            const path = capa.getElement();
            const longitud = path.getTotalLength();
            return path.animate([
              { strokeDasharray: `${longitud} ${longitud}`, strokeDashoffset: longitud },
              { strokeDasharray: `${longitud} ${longitud}`, strokeDashoffset: 0 },
            ], { duration: 1400, easing: 'cubic-bezier(.22,.61,.36,1)' });
          });
        };
        // Al mover o ampliar el mapa, se conserva el trazado completo y preciso.
        instancia.on('movestart zoomstart', terminarEntrada);
        cambiarMovimiento = () => {
          if (movimientoReducido.matches) terminarEntrada();
        };
        movimientoReducido.addEventListener('change', cambiarMovimiento);
        let ancho = contenedor.current.clientWidth;
        let alto = contenedor.current.clientHeight;
        observer = new ResizeObserver(() => {
          const nuevoAncho = contenedor.current.clientWidth;
          const nuevoAlto = contenedor.current.clientHeight;
          if (ancho === nuevoAncho && alto === nuevoAlto) return;
          ancho = nuevoAncho; alto = nuevoAlto;
          instancia.invalidateSize(); encuadre.current?.();
        });
        observer.observe(contenedor.current);
      } catch {
        if (activo) { setError('No se pudo cargar el mapa.'); setCargando(false); }
      }
    };
    iniciar();
    return () => {
      activo = false;
      observer?.disconnect();
      movimientoReducido?.removeEventListener('change', cambiarMovimiento);
      animaciones.current.forEach((animation) => animation.cancel());
      animaciones.current = [];
      instancia?.remove();
      mapa.current = null;
      encuadre.current = null;
    };
  }, [origen, cancha, ruta, language]);

  return (
    <div className="relative isolate overflow-hidden rounded-2xl border border-emerald-400/50 bg-slate-900 shadow-[0_0_0_3px_rgba(16,185,129,0.08)]">
      <div ref={contenedor} role="region" aria-label={t('Mapa del recorrido a {0}', { 0: cancha.nombre })}
        className="tennis-route-map h-[min(48dvh,25rem)] min-h-64 w-full" />
      {cargando && <div role="status" className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center gap-2 bg-slate-900/80 text-sm text-emerald-200"><Loader2 className="h-5 w-5 animate-spin" />{t('Cargando mapa...')}</div>}
      {!cargando && <button type="button" onClick={() => encuadre.current?.()} title={t('Ver recorrido completo')}
        aria-label={t('Ver recorrido completo')} className="absolute right-3 top-3 z-[500] rounded-xl border border-emerald-400/40 bg-emerald-950/95 p-2.5 text-emerald-100 shadow-lg transition-colors hover:border-emerald-300 hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"><Expand className="h-4 w-4" /></button>}
      {error && <p role="status" className="absolute left-2 top-2 z-[500] max-w-[75%] rounded-lg bg-slate-950/90 px-3 py-2 text-xs text-amber-200">{t(error)}</p>}
    </div>
  );
}
