/**
 * Translations for the ReSource app.
 *
 * - The strings live in app/locales/<code>.json, one file per language, all with the same keys.
 * - `useTranslation()` gives a screen the `t('home.tagline')` lookup function plus the current
 *   language, and re-renders the screen when the language changes.
 * - The chosen language is shared by the whole app (it is module state, not per-screen state)
 *   and is sent to the backend with each chat message so the AI answers in the same language.
 */
import { useCallback, useSyncExternalStore } from 'react';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fa from '../locales/fa.json';
import vi from '../locales/vi.json';
import zh from '../locales/zh.json';
import type { LanguageCode } from '../../shared/types';

export type { LanguageCode };

export type LanguageOption = { code: LanguageCode; label: string; flag: string; rtl: boolean };

/** Languages offered in the selector. `label` is the language's own name for itself. */
export const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', flag: '🇺🇸', rtl: false },
  { code: 'es', label: 'Español', flag: '🇲🇽', rtl: false },
  { code: 'fa', label: 'دری', flag: '🇦🇫', rtl: true },
  { code: 'zh', label: '中文', flag: '🇨🇳', rtl: false },
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳', rtl: false },
];

type Dictionary = { [key: string]: string | Dictionary };
const DICTIONARIES: Record<LanguageCode, Dictionary> = { en, es, fa, zh, vi };
const STORAGE_KEY = 'resource.language';

const isLanguage = (value: unknown): value is LanguageCode =>
  typeof value === 'string' && value in DICTIONARIES;

/** Browser storage on web; undefined on phones, where the choice lasts until the app restarts. */
function webStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/** Start in the language saved earlier, else the device's language, else English. */
function initialLanguage(): LanguageCode {
  const saved = webStorage()?.getItem(STORAGE_KEY);
  if (isLanguage(saved)) return saved;
  try {
    const base = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().split(/[-_]/)[0];
    if (base === 'prs') return 'fa'; // "prs" is the language code for Dari
    if (isLanguage(base)) return base;
  } catch {
    // Intl unavailable: fall through to English.
  }
  return 'en';
}

let currentLanguage: LanguageCode = initialLanguage();
const listeners = new Set<() => void>();

export const getLanguage = () => currentLanguage;

export function setLanguage(language: LanguageCode) {
  if (language === currentLanguage) return;
  currentLanguage = language;
  try {
    webStorage()?.setItem(STORAGE_KEY, language);
  } catch {
    // Storage full or blocked: the choice still applies for this session.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function lookup(dictionary: Dictionary, key: string): string | undefined {
  let node: string | Dictionary | undefined = dictionary;
  for (const part of key.split('.')) {
    if (typeof node !== 'object') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Looks up `key` (e.g. "chat.placeholder"). Falls back to English, then to the key itself. */
export function translate(language: LanguageCode, key: string): string {
  return lookup(DICTIONARIES[language], key) ?? lookup(DICTIONARIES.en, key) ?? key;
}

export function useTranslation() {
  const language = useSyncExternalStore(subscribe, getLanguage, getLanguage);
  const t = useCallback((key: string) => translate(language, key), [language]);
  const isRTL = LANGUAGES.find((option) => option.code === language)?.rtl ?? false;
  return { t, language, setLanguage, isRTL, languages: LANGUAGES };
}
