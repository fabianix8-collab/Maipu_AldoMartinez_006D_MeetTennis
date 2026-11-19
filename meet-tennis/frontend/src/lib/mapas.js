export function coordenadasValidas(latitud, longitud) {
  const esNumero = (valor) => (typeof valor === 'number' ||
    (typeof valor === 'string' && valor.trim() !== '')) && Number.isFinite(Number(valor));
  return esNumero(latitud) && esNumero(longitud) &&
    Math.abs(Number(latitud)) <= 90 && Math.abs(Number(longitud)) <= 180;
}

function consultaUbicacion({ latitud, longitud, direccion }) {
  // El punto del recinto prevalece sobre el geocodificador de direcciones.
  // Esto distingue, por ejemplo, las dos canchas de la misma avenida Bonilla.
  return coordenadasValidas(latitud, longitud)
    ? `${Number(latitud)},${Number(longitud)}`
    : direccion?.trim();
}

export function crearUrlMapa(cancha) {
  const consulta = consultaUbicacion(cancha);
  if (!consulta) return null;
  const parametros = new URLSearchParams({ q: consulta, z: '17', output: 'embed' });
  return `https://maps.google.com/maps?${parametros}`;
}

export function crearUrlComoLlegar(cancha, origen, modo) {
  const destino = consultaUbicacion(cancha);
  if (!destino) return null;
  const parametros = new URLSearchParams({ api: '1', destination: destino, dir_action: 'navigate' });
  if (coordenadasValidas(origen?.lat, origen?.lng)) {
    parametros.set('origin', `${Number(origen.lat)},${Number(origen.lng)}`);
  }
  if (modo !== undefined) {
    const medios = { auto: 'driving', pie: 'walking' };
    if (!Object.hasOwn(medios, modo)) throw new Error('Medio de transporte no válido.');
    parametros.set('travelmode', medios[modo]);
  }
  return `https://www.google.com/maps/dir/?${parametros}`;
}
