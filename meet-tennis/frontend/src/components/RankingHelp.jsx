import { CheckCircle2, Info, Loader2, Trophy } from 'lucide-react';
import { useLanguage } from '../lib/i18n.js';

const panel = 'mt-6 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-md';

export function RankingProgress({ yo, requisitos, ascendiendo, onAscender }) {
  const { t, locale } = useLanguage();
  const { partidosMinimos, porcentajeVictorias } = requisitos;
  const partidos = yo.partidosValidos;
  const porcentaje = yo.efectividadAscenso;
  // Truncar evita mostrar el objetivo cumplido al redondear un valor inferior.
  const porcentajeVisible = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
    .format(Math.floor(porcentaje * 10) / 10);
  const objetivos = [
    {
      id: 'ascenso-partidos',
      nombre: t('Partidos válidos'),
      valor: t('{0} jugados · mínimo {1}', { 0: partidos, 1: partidosMinimos }),
      progreso: partidos,
      maximo: partidosMinimos,
      cumplido: partidos >= partidosMinimos,
    },
    {
      id: 'ascenso-victorias',
      nombre: t('Victorias para ascender'),
      valor: t('{0}% · mínimo {1}%', { 0: porcentajeVisible, 1: porcentajeVictorias }),
      progreso: porcentaje,
      maximo: porcentajeVictorias,
      cumplido: porcentaje >= porcentajeVictorias,
    },
  ];

  return (
    <section className={panel} aria-labelledby="progreso-ascenso">
      <h2 id="progreso-ascenso" className="flex items-center gap-2 text-base font-semibold text-slate-100">
        <Trophy className="h-5 w-5 text-emerald-400" aria-hidden="true" />{t('Tu progreso para ascender')}
      </h2>
      {!yo.proximaCategoria ? (
        <p className="mt-3 text-sm text-slate-300">{t('Ya estás en 1ra Categoría, el nivel más alto. Sigue compitiendo por tu posición.')}</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-400">{t('Próxima categoría: {0}', { 0: t(yo.proximaCategoria) })}</p>
          <p className="mt-3 text-sm text-slate-300">{t('Cumple ambos requisitos con partidos confirmados en tu categoría actual, contra rivales de nivel igual o superior.')}</p>
          <div className="mt-4 grid gap-4">
            {objetivos.map((objetivo) => (
              <div key={objetivo.nombre}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <label htmlFor={objetivo.id} className="font-medium text-slate-200">{objetivo.nombre}</label>
                  <span className={objetivo.cumplido ? 'flex items-center gap-1.5 text-emerald-300' : 'text-slate-400'}>
                    {objetivo.cumplido && <CheckCircle2 className="h-4 w-4" aria-label={t('Requisito cumplido')} />}
                    {objetivo.valor}
                  </span>
                </div>
                <progress
                  id={objetivo.id}
                  value={Math.min(objetivo.progreso, objetivo.maximo)}
                  max={objetivo.maximo}
                  aria-valuetext={objetivo.valor}
                  className="mt-2 block h-2 w-full overflow-hidden rounded-full accent-emerald-400 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-700 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-emerald-400 [&::-moz-progress-bar]:bg-emerald-400"
                />
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-400">{t('{0} victorias en {1} partidos válidos.', { 0: yo.victoriasValidas, 1: partidos })}</p>
          <p className="mt-3 text-sm text-slate-400">{t('Los partidos contra categorías inferiores afectan tus puntos, pero no cuentan para ascender.')}</p>
          {yo.puedeAscender && (
            <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
              <p className="text-sm font-semibold text-emerald-300">{t('¡Cumples ambos requisitos! Puedes subir cuando quieras.')}</p>
              <button type="button" onClick={onAscender} disabled={ascendiendo}
                className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60">
                {ascendiendo && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
                {t('Subir a {0}', { 0: t(yo.proximaCategoria) })}
              </button>
            </div>
          )}
          <p className="mt-4 text-sm text-slate-300">{t('Al subir empiezas con cero puntos en la nueva categoría. Tu historial se conserva.')}</p>
        </>
      )}
    </section>
  );
}

export function RankingGuide({ reglas }) {
  const { t } = useLanguage();
  const relaciones = [
    ['superior', t('Superior a la tuya')],
    ['igual', t('Igual a la tuya')],
    ['inferior', t('Inferior a la tuya')],
  ];
  return (
    <section id="reglas-ranking" className={`${panel} scroll-mt-6`} aria-labelledby="titulo-reglas-ranking">
      <h2 id="titulo-reglas-ranking" className="flex items-center gap-2 text-base font-semibold text-slate-100">
        <Info className="h-5 w-5 text-emerald-400" aria-hidden="true" />{t('¿Cómo funciona el ranking?')}
      </h2>
      <p className="mt-3 text-sm text-slate-300">{t('Tus puntos definen tu posición. Tus resultados contra rivales de nivel igual o superior te permiten ascender.')}</p>
      <h3 className="mt-5 text-base font-semibold text-slate-100">{t('¿Cómo gano o pierdo puntos?')}</h3>
      <p className="mt-2 text-sm text-slate-400">{t('Solo cuentan los resultados confirmados por tu rival.')}</p>
      {reglas ? (
        <>
          <table className="mt-4 w-full text-left text-sm">
            <caption className="sr-only">{t('Puntos según la categoría del rival')}</caption>
            <thead className="text-slate-400">
              <tr className="border-b border-slate-700">
                <th scope="col" className="pb-3 pr-2 font-medium">{t('Categoría del rival')}</th>
                <th scope="col" className="px-2 pb-3 text-right font-medium">{t('Si ganas')}</th>
                <th scope="col" className="pb-3 pl-2 text-right font-medium">{t('Si pierdes')}</th>
              </tr>
            </thead>
            <tbody>
              {relaciones.map(([clave, nombre]) => (
                <tr key={clave} className="border-b border-slate-700/50">
                  <th scope="row" className="py-3 pr-2 font-medium text-slate-200">{nombre}</th>
                  <td className="px-2 py-3 text-right font-semibold text-emerald-300">+{reglas.puntosResultado.Ganado[clave]}</td>
                  <td className="py-3 pl-2 text-right font-semibold text-red-300">{reglas.puntosResultado.Perdido[clave]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-sm text-slate-400">{t('Por ejemplo, 4ta es superior a 5ta. 1ra es la categoría más alta.')}</p>
          <h3 className="mt-5 text-base font-semibold text-slate-100">{t('¿Cómo subo de categoría?')}</h3>
          <p className="mt-2 text-sm text-slate-300">{t('Juega al menos {0} partidos válidos y gana al menos el {1}% de ellos.', { 0: reglas.ascenso.partidosMinimos, 1: reglas.ascenso.porcentajeVictorias })}</p>
          <p className="mt-2 text-sm text-slate-400">{t('Un partido válido es un resultado confirmado en tu categoría actual, contra un rival de categoría igual o superior.')}</p>
          <p className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-200">{t('Por ejemplo: ganar {0} de {1} partidos válidos cumple ambos requisitos.', { 0: Math.ceil(reglas.ascenso.partidosMinimos * reglas.ascenso.porcentajeVictorias / 100), 1: reglas.ascenso.partidosMinimos })}</p>
          <p className="mt-2 text-sm text-slate-400">{t('El ascenso es opcional: cuando cumples ambos requisitos, aparece el botón para subir a la siguiente categoría.')}</p>
        </>
      ) : <p role="status" className="mt-3 text-sm text-slate-400">{t('Las reglas de puntos y ascenso se mostrarán al cargar el ranking.')}</p>}
      <details className="mt-5 border-t border-slate-700/50 pt-4 text-sm text-slate-400">
        <summary className="min-h-11 cursor-pointer rounded-lg py-2 font-semibold text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">{t('Más sobre posiciones e historial')}</summary>
        <ul className="mt-2 list-disc space-y-3 pl-5">
          <li>{t('Cada categoría tiene su propia tabla. Se ordena por puntos; en caso de empate, por más partidos jugados y luego por nombre.')}</li>
          <li>{t('Se suman y restan los puntos de tus resultados confirmados en la categoría actual. Si el total es negativo, se muestra cero.')}</li>
          <li>{t('Al subir empiezas con cero puntos en la nueva categoría. Tu historial se conserva.')}</li>
          <li>{t('La efectividad general incluye todos los rivales. El porcentaje para ascender solo incluye rivales de categoría igual o superior.')}</li>
        </ul>
      </details>
    </section>
  );
}
