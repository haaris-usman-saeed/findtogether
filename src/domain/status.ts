import type { CandidateState, CaseStatus, ReviewFlag } from './types';

export type Tone = 'neutral' | 'accent' | 'warning' | 'success' | 'guarded';

export const CASE_STATUS: Record<CaseStatus, { label: string; description: string; tone: Tone }> = {
  open: {
    label: 'Searching',
    description: 'No possible matches to review right now.',
    tone: 'neutral',
  },
  possible_match: {
    label: 'Possible match',
    description: 'One or more records may be the person. Nothing is confirmed.',
    tone: 'accent',
  },
  needs_review: {
    label: 'Needs additional review',
    description: 'The records can\u2019t be told apart yet. More information is needed.',
    tone: 'warning',
  },
  verification_pending: {
    label: 'Verification pending',
    description: 'A coordinator is checking the relationship and asking both people about contact.',
    tone: 'accent',
  },
  contact_authorized: {
    label: 'Contact authorized',
    description: 'Both people agreed. A coordinator is arranging contact.',
    tone: 'success',
  },
  reconnected: {
    label: 'Contact made',
    description: 'The coordinator recorded that contact happened.',
    tone: 'success',
  },
  safeguarding: {
    label: 'Safeguarding review',
    description: 'This search involves a child. It is handled by the safeguarding team.',
    tone: 'guarded',
  },
};

/** Statuses that need a coordinator to act. */
export const NEEDS_STAFF: ReadonlySet<CaseStatus> = new Set<CaseStatus>([
  'possible_match',
  'needs_review',
  'verification_pending',
  'contact_authorized',
  'safeguarding',
]);

/** Lower sorts first in work queues. */
export const STATUS_PRIORITY: Record<CaseStatus, number> = {
  contact_authorized: 0,
  verification_pending: 1,
  needs_review: 2,
  possible_match: 3,
  safeguarding: 4,
  open: 5,
  reconnected: 6,
};

/** Case status is derived from candidate states, never stored separately, so it can't drift. */
export function deriveCaseStatus(input: {
  safeguarding: boolean;
  reviewFlag?: ReviewFlag;
  candidateStates: CandidateState[];
}): CaseStatus {
  if (input.safeguarding) return 'safeguarding';
  const states = input.candidateStates;
  if (states.includes('reconnected')) return 'reconnected';
  if (states.includes('authorized')) return 'contact_authorized';
  if (states.includes('verifying')) return 'verification_pending';
  if (input.reviewFlag) return 'needs_review';
  if (states.includes('possible')) return 'possible_match';
  return 'open';
}
