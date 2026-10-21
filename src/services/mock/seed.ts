/**
 * Fictional demo data. Every person, place, and phone number here is invented.
 * Phone numbers use the 555-01xx range reserved for fiction.
 *
 * The dataset contains all three reviewer scenarios at once:
 *   S-1041  Scenario 1, successful reunification (Mari Ortiz / Marisol Reyes)
 *   S-1042  Scenario 2, ambiguous identity (three plausible Joe/José records)
 *   R-4102  Scenario 3, protected individual (never matchable)
 *   S-1099  Control request for scenario 3: nobody matching is registered
 *   S-1043  A search for a child, routed to safeguarding
 */
import type { CaseRecord, Registration, SearchRequest, Shelter } from '../../domain/types';

export interface ActivityRecord {
  at: string;
  text: string;
  audience: 'everyone' | 'coordinator';
}

export interface Database {
  shelters: Shelter[];
  registrations: Registration[];
  requests: SearchRequest[];
  cases: Map<string, CaseRecord>;
  activity: ActivityRecord[];
  receipts: Map<string, unknown>;
  nextRegistration: number;
  nextRequest: number;
}

export const SCENARIO_REFS = {
  reunification: 'S-1041',
  ambiguous: 'S-1042',
  safeguarding: 'S-1043',
  control: 'S-1099',
  protectedRecord: 'R-4102',
} as const;

export function createDatabase(now = Date.now()): Database {
  const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

  const shelters: Shelter[] = [
    { id: 'lincoln', name: 'Lincoln High School', area: 'North Harbor' },
    { id: 'westside', name: 'Westside Community Center', area: 'Westside' },
    { id: 'fairgrounds', name: 'County Fairgrounds Hall', area: 'Eastfield' },
    { id: 'riverside', name: 'Riverside Church Hall', area: 'Riverside' },
  ];

  let n = 0;
  const reg = (r: Omit<Registration, 'id' | 'contact' | 'createdBy'> & Partial<Pick<Registration, 'contact' | 'createdBy'>>): Registration => ({
    id: `reg_${++n}`,
    contact: { channel: 'shelter_desk' },
    createdBy: 'Amara Diallo',
    ...r,
  });

  const registrations: Registration[] = [
    // Scenario 1: registered as "Marisol Reyes"; her brother searches for "Mari Ortiz".
    reg({
      reference: 'R-2210',
      names: { preferred: 'Marisol Reyes', full: 'Marisol Reyes Ortiz', others: [] },
      age: { kind: 'exact', years: 43 },
      shelterId: 'lincoln',
      lastKnownArea: 'Bayview, Harbor Road',
      recognizableDetails: 'Works at the bakery on Harbor Road',
      familyNotes: 'Separated from her brother Danny during the evacuation',
      contact: { channel: 'phone', detail: '555-0119' },
      consent: { matching: 'granted', contact: 'unknown' },
      safetyConcern: false,
      createdAt: ago(620),
    }),
    reg({
      reference: 'R-1987',
      names: { preferred: 'Danny Ortiz', full: 'Daniel Ortiz', others: [] },
      age: { kind: 'exact', years: 39 },
      shelterId: 'westside',
      lastKnownArea: 'Bayview',
      consent: { matching: 'granted', contact: 'granted' },
      safetyConcern: false,
      createdAt: ago(540),
      createdBy: 'Chris Novak',
    }),
    // Scenario 2: three plausible records for "Joe / José Martinez".
    reg({
      reference: 'R-3307',
      names: { preferred: 'José Martínez', others: [] },
      age: { kind: 'approximate', band: '65to79' },
      shelterId: 'fairgrounds',
      lastKnownArea: 'Pine Street',
      consent: { matching: 'granted', contact: 'unknown' },
      safetyConcern: false,
      createdAt: ago(900),
    }),
    reg({
      reference: 'R-3412',
      names: { preferred: 'Joe Martin', full: 'Joseph Martin', others: [] },
      age: { kind: 'exact', years: 74 },
      shelterId: 'lincoln',
      lastKnownArea: 'Old Mill Road',
      consent: { matching: 'granted', contact: 'granted' },
      safetyConcern: false,
      createdAt: ago(700),
    }),
    reg({
      reference: 'R-3519',
      names: { preferred: 'J. Martinez', others: [] },
      age: { kind: 'unknown' },
      shelterId: 'riverside',
      lastKnownArea: 'Pine Street area',
      recognizableDetails: 'Uses a walker, gray cap',
      consent: { matching: 'granted', contact: 'unknown' },
      safetyConcern: false,
      createdAt: ago(300),
      createdBy: 'Chris Novak',
    }),
    // Scenario 3: protected. Never matched, never acknowledged.
    reg({
      reference: 'R-4102',
      names: { preferred: 'Ana Ruiz', full: 'Ana Luc\u00EDa Ruiz', others: [] },
      age: { kind: 'exact', years: 34 },
      shelterId: 'riverside',
      lastKnownArea: 'Bayview',
      consent: { matching: 'declined', contact: 'declined' },
      safetyConcern: true,
      createdAt: ago(400),
    }),
    // A child. Children never enter ordinary matching.
    reg({
      reference: 'R-5001',
      names: { preferred: 'Kayla', others: [] },
      age: { kind: 'approximate', band: '5to12' },
      shelterId: 'lincoln',
      accompanyingAdult: 'Diane Holt, says she is a neighbor',
      consent: { matching: 'unknown', contact: 'unknown' },
      safetyConcern: false,
      createdAt: ago(200),
    }),
    // Lincoln High School residents whose answer hasn't been recorded yet.
    reg({
      reference: 'R-2290',
      names: { preferred: 'Mr. Okafor', others: [] },
      age: { kind: 'approximate', band: '80plus' },
      shelterId: 'lincoln',
      consent: { matching: 'unknown', contact: 'unknown' },
      safetyConcern: false,
      createdAt: ago(95),
      createdBy: 'Jordan Lee',
    }),
    reg({
      reference: 'R-2301',
      names: { preferred: 'Lena', others: [] },
      age: { kind: 'unknown' },
      shelterId: 'lincoln',
      recognizableDetails: 'Arrived with a small brown dog',
      consent: { matching: 'unknown', contact: 'unknown' },
      safetyConcern: false,
      createdAt: ago(40),
      createdBy: 'Jordan Lee',
    }),
    // For live testing: search for "Robert Tran" to see a nickname match form.
    reg({
      reference: 'R-2950',
      names: { preferred: 'Bobby Tran', others: [] },
      age: { kind: 'approximate', band: '30to44' },
      shelterId: 'westside',
      lastKnownArea: 'Old Mill',
      consent: { matching: 'granted', contact: 'granted' },
      safetyConcern: false,
      createdAt: ago(480),
      createdBy: 'Chris Novak',
    }),
    reg({
      reference: 'R-3001',
      names: { preferred: 'Liz Okonkwo', full: 'Elizabeth Okonkwo', others: [] },
      age: { kind: 'exact', years: 52 },
      shelterId: 'fairgrounds',
      consent: { matching: 'granted', contact: 'unknown' },
      safetyConcern: false,
      createdAt: ago(360),
    }),
  ];

  let m = 0;
  const req = (r: Omit<SearchRequest, 'id'>): SearchRequest => ({ id: `req_${++m}`, ...r });

  const requests: SearchRequest[] = [
    req({
      reference: 'S-1041',
      requester: { name: 'Daniel Ortiz', shelterId: 'westside', contact: { channel: 'shelter_desk' }, registrationReference: 'R-1987' },
      sought: {
        name: 'Mari Ortiz',
        otherNames: [],
        age: { kind: 'approximate', band: '30to44' },
        relationship: 'sibling',
        lastKnown: 'Bayview, near the harbor',
      },
      createdAt: ago(180),
      createdBy: 'Chris Novak',
    }),
    req({
      reference: 'S-1042',
      requester: { name: 'In\u00E9s Martinez', shelterId: 'lincoln', contact: { channel: 'phone', detail: '555-0142' } },
      sought: {
        name: 'Joe Martinez',
        otherNames: ['Jos\u00E9'],
        age: { kind: 'approximate', band: '65to79' },
        relationship: 'parent',
        lastKnown: 'Pine Street, Riverside district',
        details: 'Uses a walker',
      },
      createdAt: ago(140),
      createdBy: 'Jordan Lee',
    }),
    req({
      reference: 'S-1043',
      requester: { name: 'Marcus Brooks', shelterId: 'fairgrounds', contact: { channel: 'shelter_desk' } },
      sought: {
        name: 'Kayla Brooks',
        otherNames: [],
        age: { kind: 'approximate', band: '5to12' },
        relationship: 'child',
        lastKnown: 'Eastfield Elementary',
      },
      createdAt: ago(75),
      createdBy: 'Amara Diallo',
    }),
    req({
      reference: 'S-1099',
      requester: { name: 'Paul Lind', shelterId: 'westside', contact: { channel: 'shelter_desk' } },
      sought: {
        name: 'Teresa Lind',
        otherNames: [],
        age: { kind: 'exact', years: 61 },
        relationship: 'spouse_partner',
        lastKnown: 'Old Mill',
      },
      createdAt: ago(260),
      createdBy: 'Chris Novak',
    }),
  ];

  const shelterName = (id: string) => shelters.find((s) => s.id === id)?.name ?? 'a shelter';
  const cases = new Map<string, CaseRecord>();
  for (const r of requests) {
    cases.set(r.id, {
      requestId: r.id,
      reviews: {},
      history: [{ at: r.createdAt, actor: r.createdBy, text: `Search request saved at ${shelterName(r.requester.shelterId)}` }],
      updatedAt: r.createdAt,
    });
  }

  const activity: ActivityRecord[] = [
    ...registrations.map((r) => ({
      at: r.createdAt,
      text: `Registration ${r.reference} saved at ${shelterName(r.shelterId)}`,
      audience: 'everyone' as const,
    })),
    ...requests.map((r) => ({
      at: r.createdAt,
      text: `Search request ${r.reference} saved at ${shelterName(r.requester.shelterId)}`,
      audience: 'everyone' as const,
    })),
    { at: ago(70), text: 'S-1043 referred to the safeguarding team', audience: 'coordinator' as const },
  ].sort((a, b) => b.at.localeCompare(a.at));

  return {
    shelters,
    registrations,
    requests,
    cases,
    activity,
    receipts: new Map(),
    nextRegistration: 4800,
    nextRequest: 1100,
  };
}
