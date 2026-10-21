import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ScenarioId } from './scenarios';

interface DemoValue {
  /** Bumped when demo data resets, so every page remounts and reloads. */
  epoch: number;
  activeScenario: ScenarioId | null;
  restart: (scenario: ScenarioId | null) => void;
}

const DemoContext = createContext<DemoValue>({ epoch: 0, activeScenario: null, restart: () => undefined });

export function DemoProvider({ children }: { children: ReactNode }) {
  const [epoch, setEpoch] = useState(0);
  const [activeScenario, setActiveScenario] = useState<ScenarioId | null>(null);
  const value = useMemo<DemoValue>(
    () => ({
      epoch,
      activeScenario,
      restart: (scenario) => {
        setActiveScenario(scenario);
        setEpoch((e) => e + 1);
      },
    }),
    [epoch, activeScenario],
  );
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoValue {
  return useContext(DemoContext);
}
