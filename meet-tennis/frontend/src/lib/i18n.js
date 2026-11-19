import { useSyncExternalStore } from 'react';
import { english } from './translations/en.js';

export const LANGUAGE_KEY = 'meettennis_language';
export const SUPPORTED_LANGUAGES = ['es', 'en'];
const listeners = new Set();

export function resolveLanguage(saved, browserLanguage = 'es') {
  if (SUPPORTED_LANGUAGES.includes(saved)) return saved;
  return /^en(?:-|$)/i.test(browserLanguage) ? 'en' : 'es';
}

function readPreference() {
  try {
    return resolveLanguage(globalThis.localStorage?.getItem(LANGUAGE_KEY), globalThis.navigator?.language);
  } catch {
    return resolveLanguage(null, globalThis.navigator?.language);
  }
}

let language = readPreference();
export const getLanguage = () => language;
export const getLocale = () => language === 'en' ? 'en-GB' : 'es-CL';

function syncDocument() {
  if (typeof document !== 'undefined') document.documentElement.lang = language;
}
syncDocument();

export function setLanguage(next) {
  if (!SUPPORTED_LANGUAGES.includes(next)) return;
  language = next;
  try { globalThis.localStorage?.setItem(LANGUAGE_KEY, next); } catch { /* Session-only preference when storage is unavailable. */ }
  syncDocument();
  listeners.forEach((listener) => listener());
}

export function subscribeLanguage(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== LANGUAGE_KEY && event.key !== null) return;
    language = readPreference();
    syncDocument();
    listeners.forEach((listener) => listener());
  });
}

const normalize = (text) => text.replace(/\s+/g, ' ').trim();
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = Object.entries(english)
  .filter(([key]) => /\{\d+\}/.test(key))
  .sort(([a], [b]) => b.replace(/\{\d+\}/g, '').length - a.replace(/\{\d+\}/g, '').length)
  .map(([key, value]) => {
    const indexes = [...key.matchAll(/\{(\d+)\}/g)].map((m) => m[1]);
    const pattern = key.split(/\{\d+\}/).map(escapeRegExp).join('(.*?)');
    return { key, value, indexes, regex: new RegExp(`^${pattern}$`, 'u') };
  });

const aliases = {
  'Failed to fetch': 'No se pudo conectar con el servidor.',
  'NetworkError when attempting to fetch resource.': 'No se pudo conectar con el servidor.',
  'Invalid login credentials': 'Credenciales inválidas.',
  'Email not confirmed': 'Confirma tu correo electrónico antes de iniciar sesión.',
};

function interpolate(text, values) {
  return text.replace(/\{(\d+)\}/g, (placeholder, index) => values[index] == null ? placeholder : String(values[index]));
}

// Translate interface text at render time. Names, addresses, chat and review
// content do not pass through this function. Stored API enums stay in Spanish.
export function translate(text, values, selectedLanguage = language) {
  if (typeof text !== 'string' || !text) return text;
  const key = aliases[normalize(text)] || normalize(text);
  const leading = text.match(/^\s*/)[0];
  const trailing = text.match(/\s*$/)[0];
  if (selectedLanguage === 'es') return values ? interpolate(text, values) : (aliases[key] || aliases[normalize(text)] || text);
  if (Object.hasOwn(english, key)) return leading + interpolate(english[key], values || {}) + trailing;
  if (values) return interpolate(text, values);
  for (const pattern of patterns) {
    const match = pattern.regex.exec(key);
    if (!match) continue;
    const parameters = Object.fromEntries(pattern.indexes.map((index, i) => [index, match[i + 1]]));
    // These two parameters are application labels; all player names stay intact.
    if (pattern.key === '¿Confirmas tu partido de {0} con {1} a las {2}?' || pattern.key.startsWith('¡Ascendiste')) {
      parameters[0] = translate(parameters[0], undefined, selectedLanguage);
    }
    return leading + interpolate(pattern.value, parameters) + trailing;
  }
  // Availability displays weekday lists; translate each label, preserving order.
  const parts = key.split(', ');
  if (parts.length > 1 && parts.every((part) => Object.hasOwn(english, part))) {
    return leading + parts.map((part) => english[part]).join(', ') + trailing;
  }
  return text;
}

export function useLanguage() {
  const current = useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
  return { language: current, locale: current === 'en' ? 'en-GB' : 'es-CL', setLanguage,
    t: (text, values) => translate(text, values, current) };
}
