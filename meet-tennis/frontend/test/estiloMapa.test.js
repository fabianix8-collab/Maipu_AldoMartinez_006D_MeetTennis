import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { crearEstiloMapa } from '../src/lib/estiloMapa.js';

test('the illustrated basemap is a valid style over real street data, with the reference palette', () => {
  const style = crearEstiloMapa();
  assert.deepEqual(validateStyleMin(style), []);
  assert.equal(style.sources.calles.url, 'https://tiles.openfreemap.org/planet');
  assert.equal(style.layers.find((l) => l.id === 'manzanas').paint['background-color'], '#e3e4e6');
  assert.equal(style.layers.find((l) => l.id === 'parques').paint['fill-color'], '#92d47a');
  assert.equal(style.layers.find((l) => l.id === 'agua').paint['fill-color'], '#98d0f5');
  for (const layer of style.layers.filter((l) => l['source-layer'] === 'transportation')) {
    assert.equal(layer.paint['line-color'], '#ffffff');
  }
  assert.ok(!style.layers.some((l) => l.type === 'fill-extrusion'), 'No 3D buildings clutter the flat map');
});

test('place and street names use real local names, remain readable and reveal minor streets only at closer zoom', () => {
  const style = crearEstiloMapa();
  assert.ok(style.glyphs.includes('/fonts/{fontstack}/{range}.pbf'));
  const avenidas = style.layers.find((l) => l.id === 'nombres-avenidas');
  const locales = style.layers.find((l) => l.id === 'nombres-calles-locales');
  const comunas = style.layers.find((l) => l.id === 'nombres-comunas');
  assert.equal(avenidas['source-layer'], 'transportation_name');
  assert.equal(comunas['source-layer'], 'place');
  assert.ok(locales.minzoom > avenidas.minzoom);
  for (const layer of style.layers.filter((l) => l.type === 'symbol')) {
    assert.deepEqual(layer.layout['text-field'], ['coalesce', ['get', 'name:es'], ['get', 'name'], '']);
    assert.equal(layer.layout['text-allow-overlap'], false);
    assert.equal(layer.paint['text-halo-color'], '#ffffff');
  }
});
