// ==========================================================
// MeetTennis - Escenario de demostración
// ==========================================================
// Crea (o vuelve a crear) dos cuentas de demo con historial,
// disponibilidad y avisos listos para mostrar en vivo:
//   - Martina (4ta): con los requisitos para ascender, una solicitud
//     por responder, un resultado por confirmar y novedades.
//   - Diego (4ta): su rival de la demo. Tienen un partido aceptado
//     para MAÑANA, así ambos ven el aviso de confirmar asistencia.
// Si el ranking general tiene pocos partidos, agrega partidos
// confirmados entre los demás jugadores para que la tabla tenga vida.
//
// Ejecutarlo de nuevo borra las cuentas de demo (y en cascada todo lo
// suyo) y las crea otra vez con fechas actualizadas.
//
// Uso (desde la carpeta backend; la contraseña de ambas cuentas va en
// DEMO_PASSWORD para que no quede escrita en el repositorio):
//   DEMO_PASSWORD=... node scripts/seed_demo.js             → muestra qué haría
//   DEMO_PASSWORD=... node scripts/seed_demo.js --confirmar → lo aplica
// ==========================================================
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { categoriaEfectiva } from '../src/lib/ranking.js';
import { hoyChile, sumarDias } from '../src/lib/utils.js';

dotenv.config({ quiet: true });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const confirmar = process.argv.includes('--confirmar');
const password = process.env.DEMO_PASSWORD;

if (!password || password.length < 8) {
  console.error('Define DEMO_PASSWORD (mínimo 8 caracteres) para las cuentas de demo.');
  process.exit(1);
}

const DEMO = {
  martina: {
    email: 'martina.demo@meettennis.cl',
    nombre: 'Martina',
    apellido: 'Fuentes',
    genero: 'Mujer',
    nivel: '4ta Categoría',
    fecha_nacimiento: '1999-04-12',
  },
  diego: {
    email: 'diego.demo@meettennis.cl',
    nombre: 'Diego',
    apellido: 'Rojas',
    genero: 'Hombre',
    nivel: '4ta Categoría',
    fecha_nacimiento: '1998-08-03',
  },
};

// Bajo este número de partidos confirmados se agregan partidos de fondo.
const MINIMO_PARTIDOS_FONDO = 40;
const CANCHA_DEMO = 1; // Club de Tenis Maipú

const hoy = hoyChile();
const hace = (dias) => sumarDias(hoy, -dias);
const horasAtras = (horas) => new Date(Date.now() - horas * 3600000).toISOString();
const aleatorio = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];

function marcadorGanador() {
  return [0, 1].map(() => `${elegir([6, 6, 6, 7])}-${aleatorio(0, 4)}`).join(' ');
}

const invertir = (marcador) => marcador.replace(/(\d+)-(\d+)/g, '$2-$1');

// Partido confirmado registrado por j1. Sin respondido_at para que el
// historial no genere avisos (salvo que se indique).
function partido(j1, j2, ganaJ1, fecha, extra = {}) {
  const marcador = marcadorGanador();
  return {
    jugador1_id: j1.id,
    jugador2_id: j2.id,
    ganador_id: ganaJ1 ? j1.id : j2.id,
    categoria_j1: categoriaEfectiva(j1.nivel),
    categoria_j2: categoriaEfectiva(j2.nivel),
    marcador: ganaJ1 ? marcador : invertir(marcador),
    fecha,
    cancha_id: CANCHA_DEMO,
    estado: 'confirmado',
    confirmado_at: new Date(`${fecha}T21:00:00-03:00`).toISOString(),
    ...extra,
  };
}

async function buscarCuenta(email) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const usuario = data.users.find((u) => u.email === email);
    if (usuario || data.users.length < 200) return usuario || null;
  }
}

async function insertar(tabla, filas) {
  const { error } = await supabase.from(tabla).insert(filas);
  if (error) throw new Error(`${tabla}: ${error.message}`);
}

// ----------------------------------------------------------
// Rivales para el escenario (jugadores ya registrados)
// ----------------------------------------------------------
const { data: jugadores, error } = await supabase
  .from('usuario')
  .select('id, nombre, apellido, nivel');

if (error) {
  console.error('No se pudo leer la tabla usuario:', error.message);
  process.exit(1);
}

const correosDemo = Object.values(DEMO).map((d) => d.email);
const existentes = await Promise.all(correosDemo.map(buscarCuenta));
const idsDemoPrevios = existentes.filter(Boolean).map((u) => u.id);
const otros = jugadores.filter((j) => !idsDemoPrevios.includes(j.id));

const de = (categoria) => otros.filter((j) => categoriaEfectiva(j.nivel) === categoria);
const rivales4ta = de('4ta Categoría');
const rivales3ra = de('3ra Categoría');

if (rivales4ta.length < 3 || rivales3ra.length < 1) {
  console.error('Se necesitan al menos 3 jugadores de 4ta y 1 de 3ra registrados.');
  process.exit(1);
}

const { count: confirmados } = await supabase
  .from('partidos')
  .select('id', { count: 'exact', head: true })
  .eq('estado', 'confirmado')
  .not('jugador1_id', 'in', `(${idsDemoPrevios.join(',') || '00000000-0000-0000-0000-000000000000'})`)
  .not('jugador2_id', 'in', `(${idsDemoPrevios.join(',') || '00000000-0000-0000-0000-000000000000'})`);
const conFondo = (confirmados ?? 0) < MINIMO_PARTIDOS_FONDO;

console.log(`Cuentas de demo existentes que se recrearán: ${idsDemoPrevios.length}`);
console.log(`Partidos de fondo: ${conFondo ? 'se agregan' : 'no (ya hay suficientes)'}`);

if (!confirmar) {
  console.log('Modo de prueba: no se modificó nada. Agrega --confirmar para aplicarlo.');
  process.exit(0);
}

try {
  // 1. Borrar las cuentas de demo anteriores (lo suyo se borra en cascada).
  for (const id of idsDemoPrevios) {
    await supabase.from('usuario').delete().eq('id', id);
    await supabase.auth.admin.deleteUser(id);
  }

  // 2. Crear las cuentas.
  const cuentas = {};
  for (const [clave, datos] of Object.entries(DEMO)) {
    const { email, ...perfil } = datos;
    const { data, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authError) throw new Error(`${email}: ${authError.message}`);
    await insertar('usuario', [{ id: data.user.id, ...perfil, avatar_url: null }]);
    cuentas[clave] = { id: data.user.id, nivel: perfil.nivel };
  }
  const { martina, diego } = cuentas;

  // 3. Disponibilidad con horarios que se cruzan.
  await insertar('disponibilidad', [
    { usuario_id: martina.id, dias: [1, 3, 5], desde: '18:00', hasta: '21:00', modalidad: 'Buscando partido', cancha_id: CANCHA_DEMO },
    { usuario_id: martina.id, dias: [6], desde: '09:00', hasta: '13:00', modalidad: 'Disponible para jugar', comuna: 'Maipú' },
    { usuario_id: diego.id, dias: [3, 5], desde: '19:00', hasta: '22:00', modalidad: 'Disponible para jugar', comuna: 'Maipú' },
    { usuario_id: diego.id, dias: [6, 7], desde: '10:00', hasta: '12:00', modalidad: 'Buscando partido', cancha_id: CANCHA_DEMO },
  ]);

  // 4. Historial de Martina: 15 victorias válidas y 2 derrotas en 4ta
  //    (405 pts), lo justo para mostrar el botón de ascenso a 3ra.
  //    La más reciente la confirmó Laura hace un día → novedad.
  const historial = [];
  const [rivalReciente, rivalPendiente, ...resto4ta] = rivales4ta;
  historial.push(
    partido(martina, rivalReciente, true, hace(1), { respondido_at: horasAtras(20) }),
  );
  for (let i = 0; i < 16; i += 1) {
    const vs3ra = i % 5 === 0; // 3 victorias contra 3ra (40 pts c/u)
    const rival = vs3ra ? elegir(rivales3ra) : elegir([...resto4ta, rivalPendiente]);
    const gana = i !== 4 && i !== 11;
    historial.push(partido(martina, rival, gana, hace(4 + i * 4)));
  }

  // Diego: 7 victorias y 4 derrotas en 4ta.
  for (let i = 0; i < 11; i += 1) {
    historial.push(partido(diego, elegir(rivales4ta), i % 3 !== 1, hace(3 + i * 6)));
  }
  await insertar('partidos', historial);

  // 5. Resultado registrado por un rival, por confirmar (Martina ganó).
  await insertar('partidos', [
    {
      jugador1_id: rivalPendiente.id,
      jugador2_id: martina.id,
      ganador_id: martina.id,
      categoria_j1: categoriaEfectiva(rivalPendiente.nivel),
      categoria_j2: martina.nivel,
      marcador: '4-6 5-7',
      fecha: hace(2),
      cancha_id: CANCHA_DEMO,
      estado: 'pendiente',
    },
  ]);

  // 6. Solicitudes: una por responder y el partido de mañana.
  const proponente = elegir(resto4ta);
  await insertar('solicitudes_partido', [
    {
      solicitante_id: proponente.id,
      receptor_id: martina.id,
      cancha_id: CANCHA_DEMO,
      fecha: sumarDias(hoy, 3),
      hora_desde: '19:00',
      hora_hasta: '20:30',
      mensaje: '¡Hola! Vi que juegas en Maipú, ¿un single el fin de semana?',
      estado: 'pendiente',
    },
    {
      solicitante_id: martina.id,
      receptor_id: diego.id,
      cancha_id: CANCHA_DEMO,
      fecha: sumarDias(hoy, 1),
      hora_desde: '18:00',
      hora_hasta: '19:30',
      mensaje: '¿Jugamos mañana después de clases?',
      estado: 'aceptada',
      respondida_at: horasAtras(3),
    },
  ]);

  // 7. Partidos de fondo entre los demás jugadores (misma categoría).
  let fondo = 0;
  if (conFondo) {
    const filas = [];
    for (const jugador of otros) {
      const mismos = de(categoriaEfectiva(jugador.nivel)).filter((j) => j.id !== jugador.id);
      if (mismos.length === 0) continue;
      for (let i = 0; i < aleatorio(2, 5); i += 1) {
        filas.push(partido(jugador, elegir(mismos), Math.random() < 0.5, hace(aleatorio(5, 90))));
      }
    }
    await insertar('partidos', filas);
    fondo = filas.length;
  }

  console.log('\nEscenario de demo listo:');
  console.log(`  ${DEMO.martina.email}  (Martina Fuentes, 4ta)`);
  console.log(`  ${DEMO.diego.email}    (Diego Rojas, 4ta)`);
  console.log(`  Partido aceptado Martina vs Diego: ${sumarDias(hoy, 1)} 18:00 en Club de Tenis Maipú`);
  console.log(`  Solicitud por responder de ${proponente.nombre} ${proponente.apellido}`);
  console.log(`  Resultado por confirmar de ${rivalPendiente.nombre} ${rivalPendiente.apellido}`);
  console.log(`  Partidos de historial: ${historial.length}; de fondo: ${fondo}`);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
