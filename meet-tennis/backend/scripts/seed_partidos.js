// ==========================================================
// MeetTennis - Partidos de demostración
// ==========================================================
// Crea partidos CONFIRMADOS entre los jugadores registrados para
// que el ranking tenga datos en una demo. Solo se ejecuta si la
// tabla 'partidos' está vacía, así nunca se mezcla con partidos
// reales ya registrados.
//
// Uso (desde la carpeta backend):
//   node scripts/seed_partidos.js             → muestra qué haría
//   node scripts/seed_partidos.js --confirmar → inserta los partidos
// ==========================================================
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { categoriaEfectiva, NOMBRES_CATEGORIAS } from '../src/lib/ranking.js';

dotenv.config({ quiet: true });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const confirmar = process.argv.includes('--confirmar');

const aleatorio = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];

// Marcador de dos sets desde el punto de vista del ganador.
function marcadorGanador() {
  return [0, 1].map(() => `${elegir([6, 6, 6, 7])}-${aleatorio(0, 4)}`).join(' ');
}

function invertir(marcador) {
  return marcador.replace(/(\d+)-(\d+)/g, '$2-$1');
}

// Fecha de los últimos 90 días (YYYY-MM-DD).
function fechaReciente() {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - aleatorio(1, 90));
  return fecha.toISOString().slice(0, 10);
}

const { count, error: countError } = await supabase
  .from('partidos')
  .select('id', { count: 'exact', head: true });

if (countError) {
  console.error('No se pudo leer la tabla partidos:', countError.message);
  process.exit(1);
}

if (count > 0) {
  console.log(`La tabla partidos ya tiene ${count} partidos: no se agregan datos de demo.`);
  process.exit(0);
}

const { data: usuarios, error } = await supabase.from('usuario').select('id, nombre, nivel');

if (error || !usuarios || usuarios.length < 2) {
  console.error('Se necesitan al menos 2 jugadores registrados.', error?.message ?? '');
  process.exit(1);
}

const orden = (nivel) => NOMBRES_CATEGORIAS.indexOf(categoriaEfectiva(nivel));
const partidos = [];

// Cada jugador registra entre 3 y 7 partidos contra rivales al azar.
// Es más probable que gane el jugador de mejor categoría.
for (const jugador of usuarios) {
  const rivales = usuarios.filter((u) => u.id !== jugador.id);

  for (let i = 0; i < aleatorio(3, 7); i += 1) {
    const rival = elegir(rivales);
    const ventaja = orden(rival.nivel) - orden(jugador.nivel); // > 0: jugador es mejor
    const ganaJugador = Math.random() < 0.5 + 0.15 * ventaja;
    const marcador = marcadorGanador();
    const fecha = fechaReciente();

    partidos.push({
      jugador1_id: jugador.id,
      jugador2_id: rival.id,
      ganador_id: ganaJugador ? jugador.id : rival.id,
      categoria_j1: categoriaEfectiva(jugador.nivel),
      categoria_j2: categoriaEfectiva(rival.nivel),
      marcador: ganaJugador ? marcador : invertir(marcador),
      fecha,
      estado: 'confirmado',
      confirmado_at: new Date(`${fecha}T20:00:00-03:00`).toISOString(),
    });
  }
}

console.log(`Se generarían ${partidos.length} partidos confirmados entre ${usuarios.length} jugadores.`);

if (!confirmar) {
  console.log('Modo de prueba: no se insertó nada. Agrega --confirmar para insertarlos.');
  process.exit(0);
}

const { error: insertError } = await supabase.from('partidos').insert(partidos);

if (insertError) {
  console.error('Error al insertar:', insertError.message);
  process.exit(1);
}

console.log('Partidos de demostración insertados. El ranking ya tiene datos.');
