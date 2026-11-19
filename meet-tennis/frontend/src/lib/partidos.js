// Las solicitudes y los resultados tienen ID independientes: nunca se mezcla
// "solicitud-42" con "partido-42" al abrir un aviso.
export function referenciaPartido(hash) {
  const referencia = /^#(solicitud|partido)-([1-9]\d*)$/.exec(hash);
  return referencia
    ? { tipo: referencia[1], id: referencia[2], ancla: referencia[0].slice(1) }
    : null;
}
