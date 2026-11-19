import { useLanguage } from '../lib/i18n.js';
// MapEmbed.jsx
// Muestra un mapa de Google embebido dentro de la app, sin abrir pestañas
// externas. Usa el endpoint público de embed de Google Maps, que no
// requiere API key.
//
// Se priorizan las coordenadas verificadas del recinto. La dirección es
// solamente un respaldo si no existe un par de coordenadas válido.
//
// Uso:
//   <MapEmbed direccion="Chacabuco 100, Maipú" titulo="Mapa" />
//   <MapEmbed latitud={-33.5} longitud={-70.7} titulo="Mapa" />

import { crearUrlMapa } from '../lib/mapas.js';

function MapEmbed({ latitud, longitud, direccion, titulo, className }) {
  const { t, language } = useLanguage();
  const src = crearUrlMapa({ latitud, longitud, direccion });
  if (!src) return <p className="mt-3 text-xs text-slate-400">{t("Ubicación no disponible.")}</p>;
  const localizedSrc = new URL(src);
  localizedSrc.searchParams.set('hl', language);

  return (
    <iframe
      src={localizedSrc.toString()}
      title={titulo || t('Mapa')}
      loading="lazy"
      allowFullScreen
      referrerPolicy="no-referrer-when-downgrade"
      className={className || 'h-64 w-full rounded-xl border border-slate-700/50'}
    />
  );
}

export default MapEmbed;
