// Reglas del ranking. Son la única fuente de verdad: las rutas y el
// frontend (que las recibe desde /api/ranking) usan estos valores.

// Categorías ordenadas de MAYOR a MENOR nivel competitivo.
// En el tenis cada categoría es un circuito separado: los jugadores
// compiten dentro de su categoría y solo ascienden al demostrar un
// nivel sostenido (puntos acumulados + victorias válidas).
export const CATEGORIAS = [
  { nombre: '1ra Categoría', orden: 1 },
  { nombre: '2da Categoría', orden: 2 },
  { nombre: '3ra Categoría', orden: 3 },
  { nombre: '4ta Categoría', orden: 4 },
  { nombre: '5ta Categoría', orden: 5 },
];

export const NOMBRES_CATEGORIAS = CATEGORIAS.map((c) => c.nombre);

// Los jugadores sin categoría compiten en la más baja.
export const CATEGORIA_BASE = '5ta Categoría';

// Puntos según el resultado y la categoría del rival respecto al jugador.
// Ganar a alguien de categoría superior vale más que ganar a uno inferior.
export const PUNTOS_RESULTADO = {
  Ganado: { superior: 40, igual: 25, inferior: 10 },
  Perdido: { superior: -5, igual: -15, inferior: -25 },
};

const ORDEN_POR_CATEGORIA = Object.fromEntries(
  CATEGORIAS.map((c) => [c.nombre, c.orden]),
);

export function categoriaEfectiva(nivel) {
  return ORDEN_POR_CATEGORIA[nivel] ? nivel : CATEGORIA_BASE;
}

// La categoría inmediatamente superior, o null si ya está en 1ra.
export function categoriaSuperior(nivel) {
  const indice = NOMBRES_CATEGORIAS.indexOf(categoriaEfectiva(nivel));
  return indice > 0 ? NOMBRES_CATEGORIAS[indice - 1] : null;
}

// Relación de la categoría del rival respecto a la del jugador.
export function relacionCategorias(miCategoria, rivalCategoria) {
  const mi = ORDEN_POR_CATEGORIA[miCategoria];
  const rival = ORDEN_POR_CATEGORIA[rivalCategoria];
  if (mi == null || rival == null || rival === mi) return 'igual';
  return rival < mi ? 'superior' : 'inferior';
}

// Un partido visto desde un jugador: su categoría y la del rival al
// jugarlo (guardadas en el partido, porque la categoría cambia), si
// ganó, y los puntos que vale según las reglas.
export function partidoDesde(partido, userId) {
  const soyJ1 = partido.jugador1_id === userId;
  const miCategoria = soyJ1 ? partido.categoria_j1 : partido.categoria_j2;
  const rivalCategoria = soyJ1 ? partido.categoria_j2 : partido.categoria_j1;
  const gano = partido.ganador_id === userId;
  const relacion = relacionCategorias(miCategoria, rivalCategoria);

  return {
    miCategoria,
    rivalCategoria,
    gano,
    relacion,
    puntos: PUNTOS_RESULTADO[gano ? 'Ganado' : 'Perdido'][relacion],
    victoriaValida: gano && relacion !== 'inferior',
  };
}

// Resumen competitivo de un jugador en su categoría actual, a partir de
// sus partidos CONFIRMADOS. Los partidos jugados en otra categoría no
// suman: al ascender el desafío parte desde cero, como en el tenis real.
// `partidos` debe venir ordenado del más reciente al más antiguo.
export function resumenJugador(userId, nivel, partidos) {
  const categoria = categoriaEfectiva(nivel);
  const enCategoria = partidos
    .map((p) => partidoDesde(p, userId))
    .filter((p) => p.miCategoria === categoria);

  const total = enCategoria.reduce((suma, p) => suma + p.puntos, 0);
  const ganados = enCategoria.filter((p) => p.gano).length;

  // Partidos válidos para el ascenso: jugados en la categoría actual
  // contra rivales de igual o superior categoría.
  const partidosValidos = enCategoria.filter((p) => p.relacion !== 'inferior');
  const victoriasValidas = partidosValidos.filter((p) => p.gano).length;

  let racha = null;
  if (enCategoria.length > 0) {
    const primero = enCategoria[0].gano;
    let cantidad = 0;
    for (const p of enCategoria) {
      if (p.gano !== primero) break;
      cantidad += 1;
    }
    racha = { resultado: primero ? 'Ganado' : 'Perdido', cantidad };
  }

  const proximaCategoria = categoriaSuperior(categoria);
  const puntos = Math.max(0, total);
  const puedeAscender = Boolean(
    proximaCategoria &&
      partidosValidos.length >= 10 &&
      victoriasValidas / partidosValidos.length >= 0.85,
  );

  return {
    categoria,
    puntos,
    victoriasValidas,
    jugados: enCategoria.length,
    ganados,
    perdidos: enCategoria.length - ganados,
    efectividad:
      enCategoria.length > 0 ? Math.round((ganados / enCategoria.length) * 100) : 0,
    racha,
    proximaCategoria,
    puedeAscender,
  };
}
