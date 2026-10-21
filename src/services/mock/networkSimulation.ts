/** Demo-only network conditions for the mock backend. Has no effect in HTTP mode. */

export type NetworkMode = 'normal' | 'slow' | 'failing' | 'offline';

interface SimulationState {
  mode: NetworkMode;
  /** Tests skip artificial latency. */
  instant: boolean;
}

let state: SimulationState = { mode: 'normal', instant: false };
const listeners = new Set<() => void>();

export const networkSimulation = {
  get: (): SimulationState => state,
  set(patch: Partial<SimulationState>) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
