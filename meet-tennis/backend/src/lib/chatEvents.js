// Avisos del backend único de la app. Los datos del chat siguen pasando
// por las rutas que verifican la pertenencia a cada conversación.
const clientes = new Map();

export function suscribirChat(userId, enviar) {
  if (!clientes.has(userId)) clientes.set(userId, new Set());
  const conexiones = clientes.get(userId);
  conexiones.add(enviar);
  return () => {
    conexiones.delete(enviar);
    if (!conexiones.size) clientes.delete(userId);
  };
}

export function avisarChat(conversacion, tipo = 'mensaje') {
  const aviso = { tipo, conversacionId: conversacion.id };
  for (const id of new Set([conversacion.usuario1_id, conversacion.usuario2_id])) {
    for (const enviar of clientes.get(id) || []) enviar(aviso);
  }
}

export function abrirEventosChat(req, res) {
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, no-transform',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  const enviar = (aviso) => {
    if (!res.writableEnded && !res.destroyed) {
      // Un cliente demasiado lento se reconecta y recupera los datos por HTTP.
      if (!res.write(`data: ${JSON.stringify(aviso)}\n\n`)) res.end();
    }
  };
  const quitar = suscribirChat(req.user.id, enviar);
  enviar({ tipo: 'listo' });
  const latido = setInterval(() => res.write(': latido\n\n'), 20000);
  // Revalidar periódicamente la sesión y respetar la expiración del JWT
  // que requireAuth ya verificó, sin enviar credenciales en la URL.
  let duracion = 5 * 60 * 1000;
  try {
    const token = req.headers.authorization.slice(7).trim();
    const { exp } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));
    if (Number.isFinite(exp)) duracion = Math.min(duracion, Math.max(0, exp * 1000 - Date.now()));
  } catch { /* requireAuth sigue siendo la autoridad de autenticación. */ }
  const renovar = setTimeout(() => res.end(), duracion);
  res.on('close', () => {
    quitar();
    clearInterval(latido);
    clearTimeout(renovar);
  });
}
