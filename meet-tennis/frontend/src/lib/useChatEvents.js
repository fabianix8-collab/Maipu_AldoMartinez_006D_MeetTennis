import { useEffect, useRef } from 'react';
import { apiFetch } from './api.js';
import { leerEventosChat } from './chatStream.js';

export function useChatEvents(onEvent, onStatus) {
  const callbacks = useRef({ onEvent, onStatus });
  useEffect(() => {
    callbacks.current = { onEvent, onStatus };
  }, [onEvent, onStatus]);
  useEffect(() => {
    let cerrado = false;
    let controller;
    let timer;
    let intento = 0;
    const conectar = async () => {
      clearTimeout(timer);
      controller?.abort();
      const actual = new AbortController();
      controller = actual;
      let vigilancia;
      const vigilar = () => {
        clearTimeout(vigilancia);
        vigilancia = setTimeout(() => {
          if (cerrado || controller !== actual) return;
          callbacks.current.onStatus(false);
          actual.abort();
          timer = setTimeout(conectar, 1000);
        }, 45000);
      };
      vigilar();
      try {
        const response = await apiFetch('/api/chat/events', {
          signal: actual.signal, headers: { Accept: 'text/event-stream' }, cache: 'no-store',
        });
        await leerEventosChat(response, (aviso) => {
          if (cerrado || actual.signal.aborted) return;
          intento = 0;
          callbacks.current.onStatus(true);
          callbacks.current.onEvent(aviso);
        }, vigilar);
      } catch { /* El siguiente intento vuelve a validar la sesión. */ }
      finally { clearTimeout(vigilancia); }
      if (cerrado || actual.signal.aborted) return;
      callbacks.current.onStatus(false);
      timer = setTimeout(conectar, Math.min(30000, 1000 * 2 ** intento++));
    };
    const alVolver = () => {
      if (!document.hidden) {
        callbacks.current.onEvent({ tipo: 'sincronizar' });
        conectar();
      }
    };
    conectar();
    window.addEventListener('online', alVolver);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      cerrado = true;
      clearTimeout(timer);
      controller?.abort();
      window.removeEventListener('online', alVolver);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);
}
