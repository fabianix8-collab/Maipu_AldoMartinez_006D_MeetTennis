import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { apiFetch } from './api.js';
import { cercaDelFinal, unirMensajes } from './chatStream.js';

export function useChatMessages(conversacionId, miId) {
  const [mensajes, setMensajes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [nuevos, setNuevos] = useState(0);
  const contenedorRef = useRef(null);
  const control = useRef(null);
  const seguirFinal = useRef(true);
  const datos = useRef([]);
  const lectura = useRef(null);

  const confirmarLectura = useCallback(async () => {
    const actual = control.current;
    const ultimo = datos.current.at(-1);
    if (!actual || !ultimo || !seguirFinal.current || document.hidden || lectura.current === ultimo.id) return;
    lectura.current = ultimo.id;
    try {
      const response = await apiFetch(`/api/chat/conversations/${actual.id}/read`, {
        method: 'POST', signal: actual.controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje_id: ultimo.id }),
      });
      if (!response.ok && control.current === actual && lectura.current === ultimo.id) lectura.current = null;
    } catch {
      if (control.current === actual && lectura.current === ultimo.id) lectura.current = null;
    }
  }, []);

  const refrescar = useCallback(() => control.current?.cargar(), []);
  useLayoutEffect(() => {
    datos.current = [];
    lectura.current = null;
    seguirFinal.current = true;
    setMensajes([]);
    setNuevos(0);
    setError('');
    setCargando(Boolean(conversacionId));
    if (!conversacionId) { control.current = null; return; }
    let ocupado = false;
    let repetir = false;
    let inicial = true;
    const controller = new AbortController();
    const actual = { id: conversacionId, controller, cargar: async () => {
      if (ocupado) { repetir = true; return; }
      ocupado = true;
      do {
        repetir = false;
        try {
          const response = await apiFetch(`/api/chat/conversations/${conversacionId}/messages?marcarLeido=false`, { signal: controller.signal });
          const result = await response.json();
          if (controller.signal.aborted) break;
          if (!response.ok || !result.success) throw new Error(result.error || 'No se pudieron cargar los mensajes.');
          const recibidos = result.data.mensajes || [];
          const ids = new Set(datos.current.map((m) => m.id));
          if (!inicial && !seguirFinal.current) {
            const cantidad = recibidos.filter((m) => !ids.has(m.id) && m.remitente_id !== miId).length;
            if (cantidad) setNuevos((prev) => prev + cantidad);
          }
          datos.current = unirMensajes(datos.current, recibidos);
          setMensajes(datos.current);
          setError('');
          inicial = false;
        } catch (err) {
          if (!controller.signal.aborted) setError(err.message || 'No se pudieron cargar los mensajes.');
        } finally {
          if (!controller.signal.aborted) setCargando(false);
        }
      } while (repetir && !controller.signal.aborted);
      ocupado = false;
    } };
    control.current = actual;
    actual.cargar();
    return () => { controller.abort(); control.current = null; };
  }, [conversacionId, miId]);

  useLayoutEffect(() => {
    if (seguirFinal.current && contenedorRef.current) {
      contenedorRef.current.scrollTop = contenedorRef.current.scrollHeight;
      setNuevos(0);
      confirmarLectura();
    }
  }, [mensajes, confirmarLectura]);

  const alDesplazar = () => {
    seguirFinal.current = cercaDelFinal(contenedorRef.current);
    if (seguirFinal.current) { setNuevos(0); confirmarLectura(); }
  };
  const irAlFinal = () => {
    seguirFinal.current = true;
    const contenedor = contenedorRef.current;
    if (contenedor) contenedor.scrollTop = contenedor.scrollHeight;
    setNuevos(0);
    confirmarLectura();
  };
  const agregarEnviado = (mensaje, id) => {
    if (control.current?.id !== id) return;
    seguirFinal.current = true;
    datos.current = unirMensajes(datos.current, [mensaje]);
    setMensajes(datos.current);
  };
  return { mensajes, cargando, error, nuevos, contenedorRef, alDesplazar, irAlFinal, refrescar, agregarEnviado, confirmarLectura };
}
