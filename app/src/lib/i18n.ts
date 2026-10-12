/**
 * Translations for the ReSource app.
 *
 * - Strings live in app/src/locales/<code>.json, one file per language, all with the same keys
 *   (scripts/check-i18n.mjs fails the build when a key is missing anywhere).
 * - `useTranslation()` gives a screen `t('home.tagline')`, the current language and `isRTL`.
 * - The choice is saved on the device and starts from the device language.
 * - Dari is right-to-left. The root layout mirrors the whole app from `isRTL`; components only
 *   need `dirIcon()` for arrows and chevrons that point "forward".
 */
import { getLocales } from 'expo-localization';
import { useCallback } from 'react';
import { Platform } from 'react-native';
import type { LanguageCode } from '../../../shared/types';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fa from '../locales/fa.json';
import vi from '../locales/vi.json';
import zh from '../locales/zh.json';
import { createStore } from '../state/stores';

export type { LanguageCode };

export type LanguageOption = { code: LanguageCode; label: string; english: string; rtl: boolean; locale: string };

/** `label` is the language's own name for itself. No flags: a language is not a country. */
export const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', english: 'English', rtl: false, locale: 'en-US' },
  { code: 'es', label: 'Español', english: 'Spanish', rtl: false, locale: 'es-US' },
  { code: 'fa', label: 'دری', english: 'Dari', rtl: true, locale: 'fa-AF' },
  { code: 'zh', label: '中文', english: 'Mandarin', rtl: false, locale: 'zh-CN' },
  { code: 'vi', label: 'Tiếng Việt', english: 'Vietnamese', rtl: false, locale: 'vi-VN' },
];

type Dictionary = { [key: string]: string | Dictionary };
const DICTIONARIES: Record<LanguageCode, Dictionary> = { en, es, fa, zh, vi };

const isLanguage = (value: unknown): value is LanguageCode => typeof value === 'string' && value in DICTIONARIES;

/** The device's language if we support it, otherwise English. */
function deviceLanguage(): LanguageCode {
  try {
    const code = (getLocales()[0]?.languageCode ?? '').toLowerCase();
    if (code === 'prs' || code === 'ps') return 'fa'; // Dari; Pashto readers can usually read Dari
    if (isLanguage(code)) return code;
  } catch {
    // Locale unavailable: fall through to English.
  }
  return 'en';
}

export const languageStore = createStore<LanguageCode>(deviceLanguage(), 'language');

export const getLanguage = () => languageStore.get();
export const languageOption = (code: LanguageCode) => LANGUAGES.find((option) => option.code === code) ?? LANGUAGES[0];

/** Keeps <html lang dir> in step on the web so screen readers and the browser use the right rules. */
export function applyDocumentLanguage(code: LanguageCode) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.documentElement.lang = code === 'fa' ? 'fa-AF' : code === 'zh' ? 'zh-Hans' : code;
  document.documentElement.dir = languageOption(code).rtl ? 'rtl' : 'ltr';
}

export function setLanguage(code: LanguageCode) {
  if (!isLanguage(code)) return;
  languageStore.set(code);
  applyDocumentLanguage(code);
}

function lookup(dictionary: Dictionary, key: string): string | undefined {
  let node: string | Dictionary | undefined = dictionary;
  for (const part of key.split('.')) {
    if (typeof node !== 'object') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export type Vars = Record<string, string | number>;

/** Looks up `key`, falls back to English, then to the key. `{{name}}` is replaced from `vars`. */
export function translate(language: LanguageCode, key: string, vars?: Vars): string {
  const template = lookup(DICTIONARIES[language], key) ?? lookup(DICTIONARIES.en, key) ?? key;
  return vars ? template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole)) : template;
}

/** True when the key exists in English, for labels built from data values. */
export const hasKey = (key: string) => lookup(DICTIONARIES.en, key) !== undefined;

const MIRRORED: Record<string, string> = {
  'chevron-right': 'chevron-left',
  'chevron-left': 'chevron-right',
  'arrow-right': 'arrow-left',
  'arrow-left': 'arrow-right',
  'open-in-new': 'open-in-new',
};

export function useTranslation() {
  const language = languageStore.use();
  const option = languageOption(language);
  const t = useCallback((key: string, vars?: Vars) => translate(language, key, vars), [language]);
  /** `tx('category', value)` translates a data value, or shows it unchanged if we have no label. */
  const tx = useCallback(
    (group: string, value: string) => (hasKey(`${group}.${value}`) ? translate(language, `${group}.${value}`) : value),
    [language],
  );
  /** Flips direction-pointing icons in right-to-left languages. */
  const dirIcon = useCallback(<T extends string>(name: T): T => (option.rtl && MIRRORED[name] ? (MIRRORED[name] as T) : name), [option.rtl]);
  return { t, tx, language, setLanguage, isRTL: option.rtl, locale: option.locale, languages: LANGUAGES, dirIcon };
}

/** "March 30, 2026" in the reader's language. Accepts YYYY-MM-DD, YYYY-MM or an ISO timestamp. */
export function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return '';
  const monthOnly = /^\d{4}-\d{2}$/.test(value);
  const date = new Date(/^\d{4}-\d{2}(-\d{2})?$/.test(value) ? `${value}${monthOnly ? '-01' : ''}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return new Intl.DateTimeFormat(locale, monthOnly ? { year: 'numeric', month: 'long' } : { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
  } catch {
    return value;
  }
}

/** "$3.8 million" style amounts, kept in Western digits so they match the source documents. */
export function formatMoney(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${amount}`;
}
