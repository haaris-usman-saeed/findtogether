import { describe, expect, it } from 'vitest';
import { contactBlockers, emptyVerification } from './authorization';
import { requesterStage, requiresSafeguarding } from './privacy';
import type { CaseStatus, SearchRequest } from './types';

describe('requester stage', () => {
  it('collapses every reason contact isn’t happening into one response', () => {
    const neutral: CaseStatus[] = ['open', 'possible_match', 'needs_review', 'verification_pending', 'safeguarding'];
    for (const status of neutral) expect(requesterStage(status)).toBe('active');
    expect(requesterStage('contact_authorized')).toBe('contact_arranged');
  });
});

describe('safeguarding routing', () => {
  const base: SearchRequest = {
    id: 'x',
    reference: 'S-0001',
    requester: { name: 'A', shelterId: 'lincoln', contact: { channel: 'shelter_desk' } },
    sought: { name: 'B', otherNames: [], age: { kind: 'unknown' }, relationship: 'sibling' },
    createdAt: '',
    createdBy: '',
  };

  it('treats "my child" with no age as a safeguarding case', () => {
    expect(requiresSafeguarding({ ...base, sought: { ...base.sought, relationship: 'child' } })).toBe(true);
  });

  it('treats an adult child of known age as an ordinary search', () => {
    expect(requiresSafeguarding({ ...base, sought: { ...base.sought, relationship: 'child', age: { kind: 'exact', years: 30 } } })).toBe(false);
  });
});

describe('contact gate', () => {
  const registration = { safetyConcern: false, isMinor: false, consent: { matching: 'granted', contact: 'granted' } } as const;

  it('blocks contact until every step is recorded', () => {
    const blockers = contactBlockers({
      safeguarding: false,
      registration,
      review: { state: 'verifying', verification: emptyVerification() },
    });
    expect(blockers).toHaveLength(3);
  });

  it('allows contact only when relationship and both consents are recorded', () => {
    const verification = emptyVerification();
    verification.relationship.result = 'confirmed';
    verification.registeredConsent.result = 'agrees';
    verification.requesterConsent.result = 'agrees';
    expect(contactBlockers({ safeguarding: false, registration, review: { state: 'verifying', verification } })).toEqual([]);
  });

  it('always blocks safeguarding cases and protected records', () => {
    const verification = emptyVerification();
    verification.relationship.result = 'confirmed';
    verification.registeredConsent.result = 'agrees';
    verification.requesterConsent.result = 'agrees';
    const review = { state: 'verifying' as const, verification };
    expect(contactBlockers({ safeguarding: true, registration, review })).toHaveLength(1);
    expect(contactBlockers({ safeguarding: false, registration: { ...registration, safetyConcern: true }, review })).toHaveLength(1);
  });
});
