/**
 * The contact gate. The mock backend calls this before authorizing contact,
 * and the interface calls the same function to explain what is still needed.
 * A real backend must run its own equivalent; the browser copy is advisory.
 */
import type { CandidateReview, ConsentDecisions, Verification } from './types';

export interface ContactGateInput {
  safeguarding: boolean;
  registration: { safetyConcern: boolean; isMinor: boolean; consent: ConsentDecisions };
  review: CandidateReview;
}

export function contactBlockers({ safeguarding, registration, review }: ContactGateInput): string[] {
  if (safeguarding || registration.isMinor) {
    return ['Cases involving a child are handled by the safeguarding team, not this workflow.'];
  }
  if (registration.safetyConcern) return ['This record can\u2019t be used for contact.'];

  const blockers: string[] = [];
  const v = review.verification;
  if (review.state !== 'verifying') blockers.push('Verification in progress for this record');
  if (v?.relationship.result !== 'confirmed') blockers.push('Relationship confirmed with the registered person');
  if (v?.registeredConsent.result !== 'agrees' || registration.consent.contact !== 'granted') {
    blockers.push('Registered person agrees to contact');
  }
  if (v?.requesterConsent.result !== 'agrees') blockers.push('Person searching confirms contact');
  return blockers;
}

export type VerificationStep = 'relationship' | 'registered_consent' | 'requester_consent';

/** Steps happen in order: nobody is asked about contact until the relationship is confirmed. */
export function stepLockedReason(step: VerificationStep, verification: Verification | undefined): string | null {
  if (step === 'relationship') return null;
  if (verification?.relationship.result !== 'confirmed') return 'Confirm the relationship first.';
  return null;
}

export function emptyVerification(): Verification {
  return {
    relationship: { result: 'pending' },
    registeredConsent: { result: 'pending' },
    requesterConsent: { result: 'pending' },
  };
}
