import { useLanguage } from '../lib/i18n.js';
import { lazy, Suspense, useCallback, useId, useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import MapEmbed from './MapEmbed.jsx';
import { crearUrlMapa } from '../lib/mapas.js';

const CourtRouteModal = lazy(() => import('./CourtRouteModal.jsx'));

export default function CanchaPartido({ cancha, origen }) {
  const { t } = useLanguage();
  const [abierto, setAbierto] = useState(false);
  const [rutaAbierta, setRutaAbierta] = useState(false);
  const cerrarRuta = useCallback(() => setRutaAbierta(false), []);
  const mapaId = useId();
  if (!cancha) return null;
  if (!crearUrlMapa(cancha)) return <p className="mt-3 text-xs text-slate-500">{t("Ubicación de la cancha no disponible.")}</p>;

  const boton = 'flex items-center justify-center gap-1.5 rounded-xl border border-slate-700/50 bg-slate-800/70 px-2 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:border-emerald-500/50 hover:text-emerald-300';
  return (
    <div className="mt-3">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" aria-expanded={abierto} aria-controls={mapaId}
          onClick={() => setAbierto((valor) => !valor)} className={boton}>
          <MapPin className="h-4 w-4 shrink-0" />
          {abierto ? t('Ocultar cancha') : t('Ver cancha')}
        </button>
        <button type="button" onClick={() => setRutaAbierta(true)} aria-haspopup="dialog" aria-expanded={rutaAbierta}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-600/15 px-2 py-2.5 text-xs font-semibold text-emerald-300 transition-colors hover:border-emerald-400/60 hover:bg-emerald-600/25"
          aria-label={t("Cómo llegar a {0}", { 0: cancha.nombre })}>
          <Navigation className="h-4 w-4 shrink-0" />{t("Cómo llegar")}</button>
      </div>
      {rutaAbierta && <Suspense fallback={<p role="status" className="mt-3 text-sm text-emerald-300">{t('Cargando recorrido...')}</p>}>
        <CourtRouteModal cancha={cancha} origen={origen} onCerrar={cerrarRuta} />
      </Suspense>}
      <div id={mapaId} hidden={!abierto}>
        {abierto && <MapEmbed {...cancha} titulo={t("Mapa de {0}", { 0: cancha.nombre })} className="mt-3 h-64 w-full rounded-xl border border-slate-700/50" />}
      </div>
    </div>
  );
}
