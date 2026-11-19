// Las solicitudes y los resultados tienen ID independientes: nunca se mezcla
// "solicitud-42" con "partido-42" al abrir un aviso.
export function referenciaPartido(hash) {
  const referencia = /^#(solicitud|partido)-([1-9]\d*)$/.exec(hash);
  return referencia
    ? { tipo: referencia[1], id: referencia[2], ancla: referencia[0].slice(1) }
    : null;
}

export const SECCIONES_PARTIDOS = {
  solicitudes: {
    ruta: '/solicitudes',
    titulo: 'Solicitudes',
    descripcion: 'Revisa tus invitaciones recibidas y enviadas',
  },
  proximos: {
    ruta: '/proximos-partidos',
    titulo: 'Próximos partidos',
    descripcion: 'Consulta los encuentros que ya aceptaron',
  },
  resultados: {
    ruta: '/mis-partidos',
    titulo: 'Mis partidos',
    descripcion: 'Registra resultados, confírmalos y revisa tu historial',
  },
};

// Una invitación aceptada se consulta junto a los encuentros acordados.
// Las pendientes, rechazadas y canceladas permanecen en Solicitudes.
export function rutaSolicitud(solicitud) {
  return solicitud.estado === 'aceptada'
    ? SECCIONES_PARTIDOS.proximos.ruta
    : SECCIONES_PARTIDOS.solicitudes.ruta;
}
