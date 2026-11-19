// Cartografía vectorial real con la paleta plana de la referencia del usuario.
export function crearEstiloMapa() {
  const verde = '#92d47a';
  const azul = '#98d0f5';
  const areasVerdes = ['wood', 'grass', 'forest', 'park', 'cemetery', 'pitch', 'recreation_ground', 'garden', 'golf_course', 'meadow'];
  const verdes = (capa) => ({
    id: `${capa}-verde`, type: 'fill', source: 'calles', 'source-layer': capa,
    filter: ['in', ['get', 'class'], ['literal', areasVerdes]],
    paint: { 'fill-color': verde, 'fill-opacity': 1 },
  });
  const anchura = (escala) => ['interpolate', ['exponential', 1.25], ['zoom'],
    9, 0.5 * escala, 12, 1.3 * escala, 14, 3 * escala, 16, 7 * escala, 19, 18 * escala];
  const carretera = (id, clases, escala, minzoom = 0) => ({
    id, type: 'line', source: 'calles', 'source-layer': 'transportation', minzoom,
    filter: ['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'class'], ['literal', clases]]],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-width': anchura(escala) },
  });
  // Se conservan los nombres propios locales también al usar la app en inglés.
  const nombre = ['coalesce', ['get', 'name:es'], ['get', 'name'], ''];
  const nombreCalle = (id, clases, minzoom, tamano) => ({
    id, type: 'symbol', source: 'calles', 'source-layer': 'transportation_name', minzoom,
    filter: ['in', ['get', 'class'], ['literal', clases]],
    layout: {
      'symbol-placement': 'line', 'symbol-spacing': 350,
      'text-field': nombre, 'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 12, tamano, 16, tamano + 1.5],
      'text-offset': [0, 0.85], 'text-max-angle': 30, 'text-padding': 5,
      'text-allow-overlap': false,
    },
    paint: { 'text-color': '#475569', 'text-halo-color': '#ffffff', 'text-halo-width': 1.7 },
  });
  return {
    version: 8,
    name: 'MeetTennis · calles blancas y parques verdes',
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: { calles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
    layers: [
      { id: 'manzanas', type: 'background', paint: { 'background-color': '#e3e4e6' } },
      verdes('landcover'), verdes('landuse'),
      { id: 'parques', type: 'fill', source: 'calles', 'source-layer': 'park', paint: { 'fill-color': verde } },
      { id: 'agua', type: 'fill', source: 'calles', 'source-layer': 'water', paint: { 'fill-color': azul } },
      { id: 'canales', type: 'line', source: 'calles', 'source-layer': 'waterway',
        paint: { 'line-color': azul, 'line-width': anchura(0.75) } },
      carretera('senderos', ['path', 'track'], 0.35, 13),
      carretera('calles-locales', ['minor', 'service'], 0.65, 12),
      carretera('calles-conectoras', ['tertiary', 'secondary'], 1.05),
      carretera('avenidas', ['primary', 'trunk'], 1.55),
      carretera('autopistas', ['motorway'], 2),
      nombreCalle('nombres-calles-locales', ['minor', 'service', 'tertiary'], 15, 12),
      nombreCalle('nombres-avenidas', ['primary', 'secondary', 'trunk', 'motorway'], 11.5, 12.5),
      {
        id: 'nombres-sectores', type: 'symbol', source: 'calles', 'source-layer': 'place', minzoom: 14,
        filter: ['in', ['get', 'class'], ['literal', ['neighbourhood', 'quarter', 'village']]],
        layout: {
          'text-field': nombre, 'text-font': ['Noto Sans Regular'], 'text-size': 12,
          'text-max-width': 10, 'text-padding': 12, 'text-allow-overlap': false,
        },
        paint: { 'text-color': '#64748b', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
      },
      {
        id: 'nombres-comunas', type: 'symbol', source: 'calles', 'source-layer': 'place', minzoom: 9,
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'suburb']]],
        layout: {
          'text-field': nombre, 'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 13, 14, 16],
          'text-transform': 'uppercase', 'text-letter-spacing': 0.05,
          'text-anchor': 'top-right', 'text-offset': [-1.2, 1.2], 'text-max-width': 11,
          'text-padding': 14, 'text-allow-overlap': false,
        },
        paint: { 'text-color': '#334155', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
      },
    ],
  };
}
