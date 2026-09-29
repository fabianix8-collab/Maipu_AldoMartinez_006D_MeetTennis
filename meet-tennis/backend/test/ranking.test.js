import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  categoriaEfectiva,
  categoriaSuperior,
  partidoDesde,
  relacionCategorias,
  resumenJugador,
} from '../src/lib/ranking.js';

const YO = 'yo';
const RIVAL = 'rival';

// Partido confirmado donde YO es jugador1 (quien lo registró).
function partido({ gano, miCategoria = '5ta Categoría', rivalCategoria = '5ta Categoría' }) {
  return {
    jugador1_id: YO,
    jugador2_id: RIVAL,
    ganador_id: gano ? YO : RIVAL,
    categoria_j1: miCategoria,
    categoria_j2: rivalCategoria,
  };
}

test('los jugadores sin categoría compiten en 5ta', () => {
  assert.equal(categoriaEfectiva(null), '5ta Categoría');
  assert.equal(categoriaEfectiva('Principiante'), '5ta Categoría');
  assert.equal(categoriaEfectiva('3ra Categoría'), '3ra Categoría');
});

test('la categoría superior de 1ra no existe', () => {
  assert.equal(categoriaSuperior('5ta Categoría'), '4ta Categoría');
  assert.equal(categoriaSuperior(null), '4ta Categoría');
  assert.equal(categoriaSuperior('1ra Categoría'), null);
});

test('relación entre categorías (1ra es la más alta)', () => {
  assert.equal(relacionCategorias('5ta Categoría', '4ta Categoría'), 'superior');
  assert.equal(relacionCategorias('4ta Categoría', '5ta Categoría'), 'inferior');
  assert.equal(relacionCategorias('4ta Categoría', '4ta Categoría'), 'igual');
});

test('puntos por resultado según la categoría del rival', () => {
  assert.equal(partidoDesde(partido({ gano: true, rivalCategoria: '4ta Categoría' }), YO).puntos, 40);
  assert.equal(partidoDesde(partido({ gano: true }), YO).puntos, 25);
  assert.equal(
    partidoDesde(partido({ gano: true, miCategoria: '4ta Categoría' }), YO).puntos,
    10,
  );
  assert.equal(partidoDesde(partido({ gano: false }), YO).puntos, -15);
});

test('el mismo partido se ve al revés desde el rival', () => {
  const p = partido({ gano: true, rivalCategoria: '4ta Categoría' });
  const rival = partidoDesde(p, RIVAL);
  assert.equal(rival.gano, false);
  assert.equal(rival.miCategoria, '4ta Categoría');
  assert.equal(rival.relacion, 'inferior');
  assert.equal(rival.puntos, -25);
});

test('ganar a una categoría inferior no es victoria válida', () => {
  const p = partido({ gano: true, miCategoria: '4ta Categoría', rivalCategoria: '5ta Categoría' });
  assert.equal(partidoDesde(p, YO).victoriaValida, false);
});

test('los puntos nunca bajan de 0', () => {
  const resumen = resumenJugador(YO, '5ta Categoría', [partido({ gano: false })]);
  assert.equal(resumen.puntos, 0);
  assert.equal(resumen.perdidos, 1);
});

test('solo suman los partidos jugados en la categoría actual', () => {
  const partidos = [
    partido({ gano: true, miCategoria: '4ta Categoría', rivalCategoria: '4ta Categoría' }),
    partido({ gano: true, miCategoria: '5ta Categoría' }),
  ];
  const resumen = resumenJugador(YO, '4ta Categoría', partidos);
  assert.equal(resumen.jugados, 1);
  assert.equal(resumen.puntos, 25);
});

test('estadísticas y racha (partidos del más reciente al más antiguo)', () => {
  const partidos = [
    partido({ gano: true }),
    partido({ gano: true }),
    partido({ gano: false }),
    partido({ gano: true }),
  ];
  const resumen = resumenJugador(YO, '5ta Categoría', partidos);
  assert.equal(resumen.jugados, 4);
  assert.equal(resumen.ganados, 3);
  assert.equal(resumen.efectividad, 75);
  assert.deepEqual(resumen.racha, { resultado: 'Ganado', cantidad: 2 });
  assert.equal(resumen.puntos, 25 * 3 - 15);
});

test('para ascender se necesitan puntos Y victorias válidas', () => {
  // 5 victorias contra 4ta = 200 pts, pero solo 5 de 10 victorias.
  const cinco = Array.from({ length: 5 }, () =>
    partido({ gano: true, rivalCategoria: '4ta Categoría' }),
  );
  assert.equal(resumenJugador(YO, '5ta Categoría', cinco).puedeAscender, false);

  // 10 victorias en 5ta = 250 pts y 10 victorias válidas.
  const diez = Array.from({ length: 10 }, () => partido({ gano: true }));
  const resumen = resumenJugador(YO, '5ta Categoría', diez);
  assert.equal(resumen.puedeAscender, true);
  assert.equal(resumen.proximaCategoria, '4ta Categoría');
});

test('en 1ra categoría no hay ascenso', () => {
  const resumen = resumenJugador(YO, '1ra Categoría', []);
  assert.equal(resumen.requisito, null);
  assert.equal(resumen.puedeAscender, false);
});
