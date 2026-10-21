/**
 * In-progress form input, kept in memory so a failed request or a wrong turn
 * in navigation never costs a volunteer their typing. Never written to
 * browser storage: a reload clears every draft, which is the right default
 * on a shared shelter laptop.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type Listener = (value: unknown) => void;

export class DraftStore {
  private values = new Map<string, unknown>();
  private listeners = new Map<string, Set<Listener>>();

  get<T>(key: string): T | undefined {
    return this.values.get(key) as T | undefined;
  }

  /** Written by the form that owns the draft. */
  save(key: string, value: unknown) {
    this.values.set(key, value);
  }

  /** Written from elsewhere (for example, prefilling a search). Mounted forms update. */
  replace(key: string, value: unknown) {
    this.values.set(key, value);
    this.listeners.get(key)?.forEach((listener) => listener(value));
  }

  discard(key: string) {
    this.values.delete(key);
  }

  subscribe(key: string, listener: Listener): () => void {
    const set = this.listeners.get(key) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(key, set);
    return () => {
      set.delete(listener);
    };
  }
}

const DraftContext = createContext<DraftStore | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new DraftStore());
  return <DraftContext.Provider value={store}>{children}</DraftContext.Provider>;
}

export function useDraftStore(): DraftStore {
  const store = useContext(DraftContext);
  if (!store) throw new Error('useDraftStore must be used inside DraftProvider');
  return store;
}

export function useDraft<T>(key: string, create: () => T) {
  const store = useDraftStore();
  const [value, setValue] = useState<T>(() => store.get<T>(key) ?? create());
  const createRef = useRef(create);
  createRef.current = create;

  useEffect(() => {
    store.save(key, value);
  }, [store, key, value]);

  useEffect(() => store.subscribe(key, (next) => setValue(next as T)), [store, key]);

  const reset = useCallback(() => setValue(createRef.current()), []);
  const discard = useCallback(() => store.discard(key), [store, key]);

  return { value, setValue, reset, discard };
}
