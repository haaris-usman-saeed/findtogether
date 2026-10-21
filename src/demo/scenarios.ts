/**
 * Reviewer scenarios. Demo-only: nothing in the product imports this file.
 * Each scenario resets the in-memory data, so it can be replayed at will.
 */
import type { Role } from '../domain/types';
import { emptySearchDraft, type SearchDraft } from '../forms/searchForm';
import { SCENARIO_REFS } from '../services/mock/seed';

export type ScenarioId = 1 | 2 | 3;

export interface Scenario {
  id: ScenarioId;
  title: string;
  summary: string;
  role: Role;
  start: string;
  steps: string[];
  prefillSearch?: () => SearchDraft;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 1,
    title: 'Successful reunification',
    summary: 'Daniel is looking for his sister “Mari Ortiz.” She registered at another shelter as Marisol Reyes.',
    role: 'coordinator',
    start: `/cases/${SCENARIO_REFS.reunification}`,
    steps: [
      'Read the evidence, including what differs.',
      'Begin verification. Try to authorize contact early: it stays blocked.',
      'Record each conversation, then authorize contact.',
      'Record that contact happened.',
    ],
  },
  {
    id: 2,
    title: 'Ambiguous identity',
    summary: 'Inés is looking for her father, “Joe” or “José” Martinez. Three records fit, and two may be one man.',
    role: 'coordinator',
    start: `/cases/${SCENARIO_REFS.ambiguous}`,
    steps: [
      'Compare the three records and what each is missing.',
      'Notice the possible duplicate warning.',
      'Send the case for additional review instead of picking one.',
    ],
  },
  {
    id: 3,
    title: 'Protected individual',
    summary: 'Ana Ruiz is registered and asked not to be found. Victor, at the desk, asks to search for her.',
    role: 'volunteer',
    start: '/search',
    steps: [
      'Save the prefilled search request as a volunteer would.',
      'Choose “Check this request” on the confirmation screen.',
      'Compare responses below: Victor’s request and one for a person nobody registered.',
    ],
    prefillSearch: () => ({
      ...emptySearchDraft('lincoln'),
      soughtName: 'Ana Ruiz',
      soughtOtherNames: 'Ana Lucía',
      age: { mode: 'approximate', years: '', band: '30to44' },
      relationship: 'spouse_partner',
      lastKnown: 'Bayview',
      requesterName: 'Victor Ruiz',
      contactChannel: 'phone',
      contactDetail: '555-0187',
    }),
  },
];
