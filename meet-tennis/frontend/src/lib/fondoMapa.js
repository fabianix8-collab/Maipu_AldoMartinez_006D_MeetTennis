import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { crearEstiloMapa } from './estiloMapa.js';

setWorkerUrl(workerUrl);

export const CREDITOS_MAPA = '<a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · '
  + '<a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> · '
  + '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

export function crearFondoMapa(instancia) {
  return maplibreGL({ style: import.meta.env.VITE_MAP_STYLE_URL || crearEstiloMapa(),
    attributionControl: false, interactive: false, padding: 0.15 }).addTo(instancia);
}
