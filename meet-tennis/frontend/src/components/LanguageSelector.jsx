import { TennisBall } from './TennisIcons.jsx';
import { useLanguage } from '../lib/i18n.js';

export default function LanguageSelector({ className = '' }) {
  const { language, setLanguage, t } = useLanguage();
  const nextLanguage = language === 'es' ? 'en' : 'es';
  const english = language === 'en';
  const label = `${t('Cambiar idioma')}: ${nextLanguage === 'en' ? 'English' : 'Español'}`;
  return (
    <button
      type="button"
      role="switch"
      aria-label={`${t('Idioma')}: English`}
      aria-checked={english}
      title={label}
      onClick={() => setLanguage(nextLanguage)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          setLanguage(event.key === 'ArrowRight' ? 'en' : 'es');
        }
      }}
      className={`group inline-flex min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-700/50 bg-slate-800/60 px-2 py-1 text-xs font-medium backdrop-blur-md transition-colors hover:border-emerald-500/50 hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${className}`}
    >
      <span aria-hidden="true" lang="es" className={`transition-colors ${english ? 'text-slate-400' : 'text-emerald-300'}`}>ES</span>
      <span aria-hidden="true" className="relative block h-6 w-12 rounded-full bg-slate-900/70 ring-1 ring-slate-700/60 transition-colors group-hover:ring-emerald-500/30">
        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-emerald-600/25 ring-1 ring-inset ring-emerald-500/30 transition-transform duration-300 ease-in-out motion-reduce:transition-none ${english ? 'translate-x-6 rotate-[165deg]' : 'translate-x-0 rotate-0'}`}>
          <TennisBall className="h-full w-full text-emerald-300" strokeWidth="1.5" />
        </span>
      </span>
      <span aria-hidden="true" lang="en" className={`transition-colors ${english ? 'text-emerald-300' : 'text-slate-400'}`}>EN</span>
    </button>
  );
}
