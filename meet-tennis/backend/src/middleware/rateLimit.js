// ==========================================================
// Rate limit simple en memoria (por IP).
// ==========================================================
// Limita cuántas peticiones puede hacer una misma IP dentro de una
// ventana de tiempo. Se usa para frenar fuerza bruta en login y
// registros masivos, sin necesidad de servicios externos ni
// instalaciones.
//
// Los registros viven en el proceso; si el servidor se reinicia, se
// reinician. Suficiente para la escala del proyecto.
// ==========================================================

const registros = new Map(); // ip -> [timestamp]

export function crearRateLimit({
  ventanaMs = 15 * 60 * 1000, // 15 minutos
  max = 20,
  mensaje = 'Demasiadas peticiones. Intenta de nuevo más tarde.',
}) {
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'desconocida';
    const ahora = Date.now();

    const lista = (registros.get(ip) || []).filter((t) => ahora - t < ventanaMs);

    if (lista.length >= max) {
      return res.status(429).json({
        success: false,
        data: null,
        error: mensaje,
      });
    }

    lista.push(ahora);
    registros.set(ip, lista);

    // Poda periódica para no acumular IPs inactivas.
    if (registros.size > 2000) {
      for (const [clave, tiempos] of registros) {
        const vivos = tiempos.filter((t) => ahora - t < ventanaMs);
        if (vivos.length === 0) registros.delete(clave);
        else registros.set(clave, vivos);
      }
    }

    return next();
  };
}
