import { useLanguage } from '../lib/i18n.js';
import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCircle2, ChevronRight, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { haceCuanto, iniciales } from '../lib/formato.js';

function AvatarAviso({ jugador }) {
  if (jugador?.avatar_url) {
    return (
      <img
        src={jugador.avatar_url}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full border-2 border-slate-900 object-cover"
      />
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-emerald-300">
      {iniciales(jugador?.nombre, jugador?.apellido)}
    </span>
  );
}

function FilaAviso({ aviso, onElegir }) {
  const { t } = useLanguage();
  const icono =
    aviso.tipo === 'info' &&
    (aviso.positivo ? (
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
    ) : (
      <XCircle className="h-4 w-4 shrink-0 text-red-400" />
    ));

  return (
    <li>
      <button
        type="button"
        onClick={() => onElegir(aviso)}
        className={`flex w-full items-start gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-slate-800 ${
          aviso.tipo === 'accion' ? 'bg-amber-500/5' : ''
        }`}
      >
        <AvatarAviso jugador={aviso.jugador} />
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-1.5 text-sm text-slate-200">
            {icono}
            <span>{t(aviso.texto)}</span>
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">{t(haceCuanto(aviso.fecha))}</span>
        </span>
        {aviso.tipo === 'accion' ? (
          <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-amber-300" />
        ) : (
          aviso.nuevo && (
            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-label={t("Nuevo")} />
          )
        )}
      </button>
    </li>
  );
}

// Aviso para confirmar asistencia: se responde ahí mismo. "No puedo"
// pide una segunda confirmación porque cancela el partido.
function FilaAsistencia({ aviso, onAsistencia, onElegir }) {
  const { t } = useLanguage();
  const [paso, setPaso] = useState('inicio');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const responder = async (asiste) => {
    setEnviando(true);
    setError('');
    const mensaje = await onAsistencia(aviso.asistencia, asiste);
    if (mensaje) {
      setError(mensaje);
      setEnviando(false);
    }
  };

  const boton =
    'flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors disabled:opacity-60';

  return (
    <li className="flex items-start gap-3 rounded-xl bg-amber-500/5 p-2.5">
      <AvatarAviso jugador={aviso.jugador} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onElegir(aviso)}
          className="text-left text-sm text-slate-200 transition-colors hover:text-emerald-300"
        >
          {t(aviso.texto)}
          <span className="mt-1 block text-xs font-semibold text-emerald-400">{t("Ver partido →")}</span>
        </button>

        {paso === 'inicio' ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={enviando}
              onClick={() => responder(true)}
              className={`${boton} bg-emerald-600 text-slate-100 hover:bg-emerald-700`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />{t("Confirmo")}</button>
            <button
              type="button"
              disabled={enviando}
              onClick={() => setPaso('seguro')}
              className={`${boton} border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20`}
            >
              <XCircle className="h-3.5 w-3.5" />{t("No puedo")}</button>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-xs text-red-300">{t("Se cancelará el partido y avisaremos a tu rival.")}</p>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={enviando}
                onClick={() => responder(false)}
                className={`${boton} bg-red-600 text-slate-100 hover:bg-red-700`}
              >{t("Sí, cancelar")}</button>
              <button
                type="button"
                disabled={enviando}
                onClick={() => setPaso('inicio')}
                className={`${boton} border border-slate-700/50 bg-slate-800/70 text-slate-300 hover:text-slate-100`}
              >{t("Volver")}</button>
            </div>
          </div>
        )}

        {error && <p className="mt-1.5 text-xs text-red-400">{t(error)}</p>}
      </div>
    </li>
  );
}

// Campana con los avisos del jugador. Al abrirla se avisa al padre
// (onAbrir) para marcar las novedades como vistas. onAsistencia(id, asiste)
// responde una confirmación de asistencia y devuelve un mensaje si falla.
function NotificationBell({ avisos, noLeidos, onAbrir, onAsistencia }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef(null);

  // Cierra al hacer clic fuera o al presionar Escape.
  useEffect(() => {
    if (!abierto) return undefined;

    const alClicFuera = (event) => {
      if (!contenedor.current?.contains(event.target)) setAbierto(false);
    };
    const alEscape = (event) => {
      if (event.key === 'Escape') setAbierto(false);
    };

    document.addEventListener('mousedown', alClicFuera);
    document.addEventListener('keydown', alEscape);
    return () => {
      document.removeEventListener('mousedown', alClicFuera);
      document.removeEventListener('keydown', alEscape);
    };
  }, [abierto]);

  const alternar = () => {
    if (!abierto) onAbrir();
    setAbierto((valor) => !valor);
  };

  const elegir = (aviso) => {
    setAbierto(false);
    navigate(aviso.destino);
  };

  const accion = avisos.filter((a) => a.tipo === 'accion');
  const info = avisos.filter((a) => a.tipo === 'info');

  return (
    <div ref={contenedor}>
      <button
        type="button"
        onClick={alternar}
        aria-label={noLeidos > 0 ? t("Avisos: {0} sin leer", { 0: t(noLeidos) }) : t('Avisos')}
        aria-expanded={abierto}
        className={`relative rounded-xl border bg-slate-800/60 p-2.5 shadow-2xl backdrop-blur-md transition-colors hover:border-emerald-500/50 hover:text-emerald-300 ${
          abierto ? 'border-emerald-500/50 text-emerald-300' : 'border-slate-700/50 text-slate-400'
        }`}
      >
        <Bell className="h-5 w-5" />
        {noLeidos > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white shadow-lg">
            {noLeidos > 9 ? '9+' : t(noLeidos)}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute left-1/2 top-12 z-50 w-[22rem] max-w-full -translate-x-1/2 rounded-2xl border border-slate-700/50 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-md">
          <h2 className="px-1 text-sm font-semibold text-slate-100">{t("Avisos")}</h2>

          {avisos.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-slate-500">{t("No tienes avisos por ahora.")}</p>
          ) : (
            <div className="mt-2 max-h-[60vh] overflow-y-auto overscroll-contain">
              {accion.length > 0 && (
                <>
                  <p className="px-1 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-amber-300">{t("Requieren tu respuesta")}</p>
                  <ul className="grid gap-1">
                    {accion.map((aviso) =>
                      aviso.asistencia ? (
                        <FilaAsistencia
                          key={aviso.id}
                          aviso={aviso}
                          onAsistencia={onAsistencia}
                          onElegir={elegir}
                        />
                      ) : (
                        <FilaAviso key={aviso.id} aviso={aviso} onElegir={elegir} />
                      ),
                    )}
                  </ul>
                </>
              )}
              {info.length > 0 && (
                <>
                  <p className="px-1 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{t("Novedades")}</p>
                  <ul className="grid gap-1">
                    {info.map((aviso) => (
                      <FilaAviso key={aviso.id} aviso={aviso} onElegir={elegir} />
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
