/**
 * Privacy rules shared by the mock backend and the interface.
 *
 * In production these run on the server. The browser copy exists so the
 * interface can explain why an action is unavailable; it is never the thing
 * that keeps data private.
 */
import { isMinorAge } from './age';
import type { CandidateState, CaseStatus, Registration, SearchRequest } from './types';

/**
 * May this record appear in ordinary matching?
 * Requires an explicit yes. Unknown consent, a safety concern, or a child's
 * record all keep it out.
 */
export function isDiscoverable(registration: Registration): boolean {
  return (
    !registration.safetyConcern &&
    registration.consent.matching === 'granted' &&
    !isMinorAge(registration.age)
  );
}

/**
 * Searches for a child go to the safeguarding team. "My child" with no age
 * given is treated the same way until a coordinator confirms an adult.
 */
export function requiresSafeguarding(request: SearchRequest): boolean {
  const { age, relationship } = request.sought;
  if (isMinorAge(age)) return true;
  return (relationship === 'child' || relationship === 'grandchild') && age.kind === 'unknown';
}

/**
 * The only two things a requester can ever learn. Every reason contact can't
 * be arranged (no record, protected record, declined, still reviewing) maps to
 * 'active', so the response never reveals whether a record exists.
 */
export type RequesterStage = 'active' | 'contact_arranged';

export function requesterStage(status: CaseStatus): RequesterStage {
  return status === 'contact_authorized' || status === 'reconnected' ? 'contact_arranged' : 'active';
}

/** Contact details stay hidden from staff views until both people have agreed. */
export function canReleaseContactDetails(state: CandidateState): boolean {
  return state === 'authorized' || state === 'reconnected';
}
