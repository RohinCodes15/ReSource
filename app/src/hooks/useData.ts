import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../lib/api';

export type DataState<T> = {
  data: T | null;
  loading: boolean;
  /** Set only when there is nothing to show: the request failed and there is no bundled copy. */
  error: ApiError | null;
  /** True when `data` is the copy bundled with the app because the API could not be reached. */
  bundled: boolean;
  reload: () => void;
};

const STALE_MS = 30_000;

/**
 * Loads data from the API. If the API is unreachable and `fallback` is given, the screen gets
 * the bundled copy instead, so it never shows a dead end. Reloads when the screen is focused
 * again after `staleMs`, so a tab left open does not show old posts or counts.
 */
export function useApi<T>(fetcher: () => Promise<T>, fallback?: () => T, deps: unknown[] = [], staleMs: number = STALE_MS): DataState<T> {
  const [state, setState] = useState<Omit<DataState<T>, 'reload'>>({ data: null, loading: true, error: null, bundled: false });
  const lastLoad = useRef(0);
  const run = useRef(0);
  const latest = useRef({ fetcher, fallback });
  useEffect(() => { latest.current = { fetcher, fallback }; });

  /** Starts a request. State only changes when it settles, so this is safe to call from an effect. */
  const fetchNow = useCallback(() => {
    const id = ++run.current;
    lastLoad.current = Date.now();
    latest.current.fetcher().then(
      (data) => {
        if (id === run.current) setState({ data, loading: false, error: null, bundled: false });
      },
      (reason: unknown) => {
        if (id !== run.current) return;
        const error = reason instanceof ApiError ? reason : new ApiError(0, 'network');
        const bundle = latest.current.fallback;
        if (bundle && (error.isNetwork || error.status >= 500)) setState({ data: bundle(), loading: false, error: null, bundled: true });
        else setState((previous) => ({ ...previous, loading: false, error }));
      },
    );
  }, []);

  /** For buttons such as "Try again": shows the loading state first when there is nothing on screen. */
  const reload = useCallback(() => {
    setState((previous) => ({ ...previous, loading: previous.data === null, error: null }));
    fetchNow();
  }, [fetchNow]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fetchNow, deps);
  useFocusEffect(
    useCallback(() => {
      if (lastLoad.current && Date.now() - lastLoad.current > staleMs) fetchNow();
    }, [fetchNow, staleMs]),
  );

  return { ...state, reload };
}
