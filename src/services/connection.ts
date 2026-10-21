/**
 * Connection health, derived from what actually happened to recent requests
 * plus the browser's online flag. It reports; it does not queue or sync.
 * FindTogether has no offline mode, and the interface says so.
 */

export type ConnectionHealth = 'online' | 'slow' | 'unstable' | 'offline';

const SLOW_MS = 2000;

let browserOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
let lastWasOffline = false;
let consecutiveFailures = 0;
let lastLatencyMs = 0;
let health: ConnectionHealth = compute();
const listeners = new Set<() => void>();

function compute(): ConnectionHealth {
  if (!browserOnline || lastWasOffline) return 'offline';
  if (consecutiveFailures > 0) return 'unstable';
  if (lastLatencyMs > SLOW_MS) return 'slow';
  return 'online';
}

function update() {
  const next = compute();
  if (next !== health) {
    health = next;
    listeners.forEach((listener) => listener());
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    browserOnline = true;
    update();
  });
  window.addEventListener('offline', () => {
    browserOnline = false;
    update();
  });
}

export const connection = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot(): ConnectionHealth {
    return health;
  },
  isBrowserOffline(): boolean {
    return !browserOnline;
  },
  reportSuccess(latencyMs: number) {
    lastWasOffline = false;
    consecutiveFailures = 0;
    lastLatencyMs = latencyMs;
    update();
  },
  reportFailure(kind: 'offline' | 'error') {
    lastWasOffline = kind === 'offline';
    if (kind === 'error') consecutiveFailures++;
    update();
  },
};
