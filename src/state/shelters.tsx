import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Shelter } from '../domain/types';
import { api } from '../services';
import { useConnection } from './async';
import { useSession } from './session';

const SheltersContext = createContext<Shelter[]>([]);

/**
 * Loads the shelter list once. Forms never wait on it: if it hasn't loaded,
 * they offer the volunteer's own shelter, which comes from the session.
 */
export function SheltersProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const health = useConnection();
  const [shelters, setShelters] = useState<Shelter[]>([]);

  useEffect(() => {
    if (shelters.length > 0 || health === 'offline') return;
    let active = true;
    api.getShelters(session).then(
      (list) => {
        if (active) setShelters(list);
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [shelters.length, health, session]);

  return <SheltersContext.Provider value={shelters}>{children}</SheltersContext.Provider>;
}

export function useShelters(): Shelter[] {
  const { session } = useSession();
  const shelters = useContext(SheltersContext);
  return shelters.length > 0 ? shelters : [{ id: session.shelterId, name: session.shelterName, area: '' }];
}
