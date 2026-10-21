import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { connection, type ConnectionHealth } from '../services/connection';
import { ApiError, toApiError } from '../services/contracts';

interface LoadState<T> {
  key: string;
  data?: T;
  error?: ApiError;
  loading: boolean;
}

/**
 * Load data and keep it while refreshing. When the inputs change (for example
 * the signed-in role), old data is dropped immediately so one role's view is
 * never shown under another.
 */
export function useAsync<T>(load: () => Promise<T>, deps: readonly unknown[]) {
  const key = JSON.stringify(deps);
  const [state, setState] = useState<LoadState<T>>({ key, loading: true });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let active = true;
    setState((s) => ({ key, data: s.key === key ? s.data : undefined, loading: true }));
    loadRef.current().then(
      (data) => {
        if (active) setState({ key, data, loading: false });
      },
      (error: unknown) => {
        if (active) setState((s) => ({ key, data: s.key === key ? s.data : undefined, error: toApiError(error), loading: false }));
      },
    );
    return () => {
      active = false;
    };
  }, [key, attempt]);

  const current = state.key === key ? state : { key, loading: true };
  return {
    data: current.data,
    error: current.error,
    loading: current.loading,
    reload: useCallback(() => setAttempt((a) => a + 1), []),
    setData: useCallback((data: T) => setState({ key, data, loading: false }), [key]),
  };
}

/** Run a request on demand. Errors are kept so the screen can explain them and offer a retry. */
export function useMutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const inFlight = useRef(false);

  const run = useCallback(async (...args: A): Promise<R | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      return await fnRef.current(...args);
    } catch (caught) {
      setError(toApiError(caught));
      return undefined;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, []);

  return { run, pending, error, clearError: useCallback(() => setError(null), []) };
}

export function useConnection(): ConnectionHealth {
  return useSyncExternalStore(connection.subscribe, connection.getSnapshot, connection.getSnapshot);
}
