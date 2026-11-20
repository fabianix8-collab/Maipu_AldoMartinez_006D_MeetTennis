// Lee SSE usando fetch para conservar Authorization y la renovación de apiFetch.
export async function leerEventosChat(response, onEvent, onActivity = () => {}) {
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
    throw new Error('No se pudo abrir el chat en vivo.');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pendiente = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      onActivity();
      pendiente = (pendiente + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');
      let fin;
      while ((fin = pendiente.indexOf('\n\n')) !== -1) {
        const bloque = pendiente.slice(0, fin);
        pendiente = pendiente.slice(fin + 2);
        const datos = bloque.split('\n').filter((linea) => linea.startsWith('data:'))
          .map((linea) => linea.slice(5).trimStart()).join('\n');
        if (datos) onEvent(JSON.parse(datos));
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function unirMensajes(anteriores, recibidos) {
  const porId = new Map(anteriores.map((mensaje) => [mensaje.id, mensaje]));
  for (const mensaje of recibidos) porId.set(mensaje.id, mensaje);
  return [...porId.values()].sort((a, b) =>
    a.created_at.localeCompare(b.created_at) || Number(a.id) - Number(b.id));
}

export function cercaDelFinal(elemento) {
  return !elemento || elemento.scrollHeight - elemento.clientHeight - elemento.scrollTop <= 64;
}
