/**
 * The only module allowed to touch on-device storage (AsyncStorage on phones, localStorage on
 * the web). scripts/check-storage.mjs fails the build if any other file reads or writes storage
 * directly, which is how the Cookie Policy screen can list every key truthfully: it renders
 * STORAGE_KEYS below.
 *
 * "essential" keys are needed for something the person explicitly asked the app to do.
 * "optional" keys are a convenience and are only written after the person accepts optional
 * storage in the cookie banner or in Settings.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type StorageCategory = 'essential' | 'optional';
export type StorageKey = { key: string; category: StorageCategory; i18n: string };

export const STORAGE_KEYS = {
  language: { key: 'resource.language', category: 'essential', i18n: 'language' },
  textScale: { key: 'resource.textScale', category: 'essential', i18n: 'textScale' },
  location: { key: 'resource.location', category: 'essential', i18n: 'location' },
  installToken: { key: 'resource.installToken', category: 'essential', i18n: 'installToken' },
  favorites: { key: 'resource.favorites', category: 'essential', i18n: 'favorites' },
  tourSeen: { key: 'resource.tourSeen', category: 'essential', i18n: 'tourSeen' },
  alerts: { key: 'resource.alerts', category: 'essential', i18n: 'alerts' },
  age: { key: 'resource.age', category: 'essential', i18n: 'age' },
  consent: { key: 'resource.storageConsent', category: 'essential', i18n: 'consent' },
  chat: { key: 'resource.chat', category: 'optional', i18n: 'chat' },
} as const satisfies Record<string, StorageKey>;

export type StorageName = keyof typeof STORAGE_KEYS;

/** Set by the consent store. Optional keys are not written while this is false. */
let optionalAllowed = false;

export function setOptionalStorageAllowed(allowed: boolean) {
  optionalAllowed = allowed;
  if (!allowed) {
    for (const entry of Object.values(STORAGE_KEYS)) {
      if (entry.category === 'optional') void AsyncStorage.removeItem(entry.key).catch(() => undefined);
    }
  }
}

export async function readStored<T>(name: StorageName): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS[name].key);
    return raw == null ? null : (JSON.parse(raw) as T);
  } catch {
    return null; // storage blocked, or an old value in an unexpected shape
  }
}

export async function writeStored(name: StorageName, value: unknown): Promise<void> {
  const entry = STORAGE_KEYS[name];
  if (entry.category === 'optional' && !optionalAllowed) return;
  try {
    if (value == null) await AsyncStorage.removeItem(entry.key);
    else await AsyncStorage.setItem(entry.key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private browsing): the value still applies until the app closes.
  }
}

/** "Clear my data on this device": removes every key this app has written. */
export async function clearAllStored(): Promise<void> {
  try {
    await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS).map((entry) => entry.key));
  } catch {
    // Nothing more we can do; the in-memory stores are reset by the caller either way.
  }
}
