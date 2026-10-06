// MapEmbed.jsx
// Muestra un mapa de Google embebido dentro de la app, sin abrir pestañas
// externas. Usa el endpoint público de embed de Google Maps, que no
// requiere API key.
//
// Uso:
//   <MapEmbed latitud={-33.5} longitud={-70.7} titulo="Mapa de la cancha" />

function MapEmbed({ latitud, longitud, titulo, className }) {
  const src = `https://maps.google.com/maps?q=${latitud},${longitud}&z=15&output=embed`;

  return (
    <iframe
      src={src}
      title={titulo || 'Mapa'}
      loading="lazy"
      allowFullScreen
      referrerPolicy="no-referrer-when-downgrade"
      className={className || 'h-64 w-full rounded-xl border border-slate-700/50'}
    />
  );
}

export default MapEmbed;