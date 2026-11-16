// MapEmbed.jsx
// Muestra un mapa de Google embebido dentro de la app, sin abrir pestañas
// externas. Usa el endpoint público de embed de Google Maps, que no
// requiere API key.
//
// Precisión: si se pasa "direccion", Google Maps la geocodifica y muestra
// el punto exacto (mucho más preciso que coordenadas aproximadas). Si no
// hay dirección, se usa el par latitud/longitud.
//
// Uso:
//   <MapEmbed direccion="Av. Los Pajaritos 1234, Maipú" titulo="Mapa" />
//   <MapEmbed latitud={-33.5} longitud={-70.7} titulo="Mapa" />

function MapEmbed({ latitud, longitud, direccion, titulo, className }) {
  const consulta = direccion
    ? encodeURIComponent(direccion)
    : `${latitud},${longitud}`;

  // z=17: nivel de calle, suficiente para distinguir la cancha exacta.
  const src = `https://maps.google.com/maps?q=${consulta}&z=17&output=embed`;

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
