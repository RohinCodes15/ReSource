/**
 * App-wide state that outlives a single screen. Each store is a few lines of plain state with
 * a React hook (`store.use()`), and the persisted ones save through lib/storage.ts.
 *
 * Everything here stays on the device. Nothing in this file talks to the network.
 */
import * as Crypto from 'expo-crypto';
import { useSyncExternalStore } from 'react';
import type { AlertCategory, AreaCode, ChatTurn } from '../../../shared/types';
import { FREMONT_CENTER, zipTable } from '../data';
import { clearAllStored, readStored, setOptionalStorageAllowed, type StorageName, writeStored } from '../lib/storage';
import type { LatLng } from '../utils/geo';

type Listener = () => void;

export function createStore<T>(initial: T, persist?: StorageName) {
  let state = initial;
  const listeners = new Set<Listener>();
  const notify = () => listeners.forEach((listener) => listener());
  const get = () => state;
  const subscribe = (listener: Listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  };
  return {
    get,
    subscribe,
    set(next: T | ((previous: T) => T)) {
      state = typeof next === 'function' ? (next as (previous: T) => T)(state) : next;
      if (persist) void writeStored(persist, state);
      notify();
    },
    /** Load the saved value once at startup. */
    async hydrate() {
      if (!persist) return;
      const saved = await readStored<T>(persist);
      if (saved != null) {
        state = typeof initial === 'object' && initial !== null && !Array.isArray(initial) ? { ...initial, ...saved } : saved;
        notify();
      }
    },
    reset() {
      state = initial;
      notify();
    },
    use: () => useSyncExternalStore(subscribe, get, get),
  };
}

// ---- Location: chosen by the person (GPS or ZIP), kept on this device only -------------------

export type AppLocation = {
  kind: 'gps' | 'zip';
  label: string;
  lat: number;
  lng: number;
  zip?: string;
  area?: AreaCode;
  /** True when a GPS fix was only accurate to more than a kilometer. */
  lowAccuracy?: boolean;
};

export const locationStore = createStore<AppLocation | null>(null, 'location');

export type ZipLookup = { ok: true; location: AppLocation } | { ok: false; reason: 'format' | 'outside' };

/** Validates a typed ZIP and finds it in the bundled Fremont table. Works with no network. */
export function lookupZip(input: string): ZipLookup {
  const digits = input.replace(/\D/g, '');
  // Accept ZIP+4 ("94538-1234") by keeping the first five digits.
  if (!/^\d{5}(\d{4})?$/.test(digits) || !/^\s*\d{5}([\s-]?\d{4})?\s*$/.test(input)) return { ok: false, reason: 'format' };
  const zip = digits.slice(0, 5);
  const match = zipTable.zips.find((entry) => entry.zip === zip);
  if (!match) return { ok: false, reason: 'outside' };
  return { ok: true, location: { kind: 'zip', label: `${match.label} (${zip})`, lat: match.lat, lng: match.lng, zip, area: match.area } };
}

/** The point distances are measured from: the chosen location, or Fremont City Hall. */
export function useOrigin(): { origin: LatLng; location: AppLocation | null } {
  const location = locationStore.use();
  return { origin: location ? { latitude: location.lat, longitude: location.lng } : FREMONT_CENTER, location };
}

// ---- Preferences ---------------------------------------------------------------------------

export const TEXT_SCALES = [1, 1.15, 1.3] as const;
export const textScaleStore = createStore<number>(1, 'textScale');

export const favoritesStore = createStore<string[]>([], 'favorites');
export const toggleFavorite = (id: string) =>
  favoritesStore.set((ids) => (ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id]));

export type AlertPrefs = { subscribed: boolean; categories: AlertCategory[]; areas: AreaCode[]; notifications: boolean; read: string[]; notified: string[] };
export const alertPrefsStore = createStore<AlertPrefs>({ subscribed: false, categories: [], areas: [], notifications: false, read: [], notified: [] }, 'alerts');

// ---- Consent and age -----------------------------------------------------------------------

/** `choice` is null until the person answers the storage banner. */
export type StorageConsent = { choice: 'all' | 'essential' | null; decidedAt: string | null };
export const consentStore = createStore<StorageConsent>({ choice: null, decidedAt: null }, 'consent');

export function setStorageConsent(choice: 'all' | 'essential') {
  setOptionalStorageAllowed(choice === 'all');
  consentStore.set({ choice, decidedAt: new Date().toISOString() });
  if (choice === 'essential') chatStore.set([]); // drop anything kept under the optional category
}

/** 'under13' switches the app to browse-only: no forms that send data are shown. */
export const ageStore = createStore<'over13' | 'under13' | null>(null, 'age');

// ---- Chat history (optional storage) -------------------------------------------------------

export type ChatMessage = ChatTurn & { id: string; sources?: string[]; mode?: 'ai' | 'basic'; failed?: boolean };
export const chatStore = createStore<ChatMessage[]>([], 'chat');

// ---- Not persisted -------------------------------------------------------------------------

/** True after a request could not reach the API; cleared by the next one that does. */
export const offlineStore = createStore<boolean>(false);
/** Admin passcode, held in memory only so it disappears when the app or tab closes. */
export const adminTokenStore = createStore<string>('');
/** Supabase session token when someone has signed in; memory only. */
export const authTokenStore = createStore<string>('');
/** Email address of the signed-in account, or '' when signed out; memory only. */
export const authEmailStore = createStore<string>('');

// ---- Install token -------------------------------------------------------------------------

let installToken: Promise<string> | null = null;

/**
 * A random id created on this device the first time it is needed. The server stores only a
 * keyed hash of it, which is enough to let you delete your own posts and vote once.
 */
export function getInstallToken(): Promise<string> {
  // One shared promise: the first requests of a fresh install start together, and each must
  // not make up its own token.
  installToken ??= (async () => {
    const saved = await readStored<string>('installToken');
    const token = saved && /^[A-Za-z0-9_-]{16,64}$/.test(saved) ? saved : Crypto.randomUUID().replace(/-/g, '');
    if (token !== saved) await writeStored('installToken', token);
    return token;
  })();
  return installToken;
}

// ---- Startup and reset ---------------------------------------------------------------------

const persisted = [locationStore, textScaleStore, favoritesStore, alertPrefsStore, consentStore, ageStore];

/** Load everything saved on the device. Called once before the first screen renders. */
export async function hydrateStores(): Promise<void> {
  await Promise.all(persisted.map((store) => store.hydrate()));
  setOptionalStorageAllowed(consentStore.get().choice === 'all');
  await chatStore.hydrate();
}

/** "Clear my data on this device": wipes storage and returns every store to its default. */
export async function resetDeviceData(): Promise<void> {
  await clearAllStored();
  installToken = null;
  setOptionalStorageAllowed(false);
  [...persisted, chatStore, adminTokenStore, authTokenStore, authEmailStore].forEach((store) => store.reset());
}
