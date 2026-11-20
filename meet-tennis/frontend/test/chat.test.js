import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cercaDelFinal, leerEventosChat, unirMensajes } from '../src/lib/chatStream.js';

test('los avisos SSE sobreviven a cortes entre bloques, bytes UTF-8 y latidos', async () => {
  const bytes = new TextEncoder().encode(': latido\n\ndata: {"tipo":"listo"}\n\ndata: {"tipo":"mensaje","texto":"¡Llegó!"}\n\n');
  const stream = new ReadableStream({ start(controller) {
    for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
    controller.close();
  } });
  const avisos = [];
  await leerEventosChat(new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }), (aviso) => avisos.push(aviso));
  assert.deepEqual(avisos, [{ tipo: 'listo' }, { tipo: 'mensaje', texto: '¡Llegó!' }]);
});

test('un proxy que responde HTML o un error no se confunde con una conexión en vivo', async () => {
  for (const response of [new Response('HTML'), new Response('', { status: 503 })]) {
    await assert.rejects(leerEventosChat(response, () => {}));
  }
});

test('acepta saltos CRLF separados entre chunks y detecta actividad en los latidos', async () => {
  const chunks = [': latido\r', '\n\r', '\ndata: {"tipo":"listo"}\r', '\n\r\n'];
  let actividad = 0;
  const avisos = [];
  const stream = new ReadableStream({ start(controller) {
    for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
    controller.close();
  } });
  await leerEventosChat(new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }), (aviso) => avisos.push(aviso), () => actividad++);
  assert.deepEqual(avisos, [{ tipo: 'listo' }]);
  assert.equal(actividad, chunks.length);
});

test('enviar y recibir el mismo mensaje no lo duplica ni elimina el historial cargado', () => {
  const m = (id, hora) => ({ id, contenido: 'Mensaje ' + id, created_at: '2026-11-19T' + hora + ':00Z' });
  const historial = [m(1, '09:00'), m(2, '10:00'), m(4, '12:00')];
  assert.deepEqual(unirMensajes(historial, [m(3, '11:00'), m(4, '12:00')]).map((m) => m.id), [1, 2, 3, 4]);
  assert.deepEqual(historial.map((m) => m.id), [1, 2, 4]);
});

test('solo sigue el final cuando se está cerca, conservando la lectura más arriba', () => {
  assert.equal(cercaDelFinal({ scrollTop: 1400, clientHeight: 500, scrollHeight: 1900 }), true);
  assert.equal(cercaDelFinal({ scrollTop: 200, clientHeight: 500, scrollHeight: 1900 }), false);
  assert.equal(cercaDelFinal(null), true);
});
