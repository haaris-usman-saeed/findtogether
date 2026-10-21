import { beforeEach, describe, expect, it } from 'vitest';
import { emptyRegistrationDraft, toRegistrationInput } from '../../forms/registrationForm';
import { emptySearchDraft, toSearchInput } from '../../forms/searchForm';
import type { Session } from '../contracts';
import { createMockApi } from './mockApi';
import { networkSimulation } from './networkSimulation';

const volunteer: Session = { role: 'volunteer', staffName: 'Test Volunteer', shelterId: 'lincoln', shelterName: 'Lincoln High School' };
const coordinator: Session = { ...volunteer, role: 'coordinator', staffName: 'Test Coordinator' };

beforeEach(() => {
  networkSimulation.set({ mode: 'normal', instant: true });
});

const victorSearch = () =>
  toSearchInput({
    ...emptySearchDraft('lincoln'),
    soughtName: 'Ana Ruiz',
    relationship: 'spouse_partner',
    age: { mode: 'approximate', years: '', band: '30to44' },
    lastKnown: 'Bayview',
    requesterName: 'Victor Ruiz',
  });

describe('privacy boundaries', () => {
  it('gives a protected person’s searcher the same response as a search for nobody', async () => {
    const api = createMockApi();
    const receipt = await api.createSearchRequest(victorSearch(), volunteer);
    const victor = await api.getRequesterStatus(receipt.reference, volunteer);
    const control = await api.getRequesterStatus('S-1099', volunteer);
    expect({ ...victor, reference: 'same' }).toEqual({ ...control, reference: 'same' });
    expect(Object.keys(victor).sort()).toEqual(['reference', 'stage']);
  });

  it('keeps protected records out of what coordinators see', async () => {
    const api = createMockApi();
    const receipt = await api.createSearchRequest(victorSearch(), volunteer);
    const detail = await api.getCase(receipt.reference, coordinator);
    expect(detail.candidates).toHaveLength(0);
    expect(JSON.stringify(detail)).not.toContain('R-4102');
  });

  it('refuses case data to volunteers at the service, not just in the interface', async () => {
    const api = createMockApi();
    await expect(api.getCase('S-1041', volunteer)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(api.listCases(volunteer)).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('withholds contact details until contact is authorized', async () => {
    const api = createMockApi();
    const detail = await api.getCase('S-1042', coordinator);
    expect(detail.request.requesterContactDetail).toBeUndefined();
    for (const candidate of detail.candidates) expect(candidate.contact).toBeUndefined();
  });

  it('keeps case progress out of the volunteer activity feed', async () => {
    const api = createMockApi();
    const forVolunteer = await api.getDashboard(volunteer);
    const forCoordinator = await api.getDashboard(coordinator);
    expect(forVolunteer.activity.some((a) => a.text.includes('safeguarding'))).toBe(false);
    expect(forCoordinator.activity.some((a) => a.text.includes('safeguarding'))).toBe(true);
    expect(forVolunteer.reviewQueue.cases).toBeNull();
  });
});

describe('contact gate', () => {
  const step = (s: 'relationship' | 'registered_consent' | 'requester_consent', result: string) =>
    ({ step: s, result, method: 'in_person' }) as never;

  it('blocks authorization until relationship and both consents are recorded', async () => {
    const api = createMockApi();
    await api.submitReviewDecision('S-1041', { type: 'begin_verification', registrationReference: 'R-2210' }, coordinator);
    await expect(api.requestContactCoordination('S-1041', 'R-2210', 'supervised_call', coordinator)).rejects.toMatchObject({
      code: 'consent_required',
    });

    await api.recordVerificationStep('S-1041', 'R-2210', step('relationship', 'confirmed'), coordinator);
    await api.recordVerificationStep('S-1041', 'R-2210', step('registered_consent', 'agrees'), coordinator);
    await expect(api.requestContactCoordination('S-1041', 'R-2210', 'supervised_call', coordinator)).rejects.toMatchObject({
      code: 'consent_required',
    });
    expect((await api.getRequesterStatus('S-1041', volunteer)).stage).toBe('active');

    await api.recordVerificationStep('S-1041', 'R-2210', step('requester_consent', 'agrees'), coordinator);
    const detail = await api.requestContactCoordination('S-1041', 'R-2210', 'supervised_call', coordinator);
    expect(detail.status).toBe('contact_authorized');
    expect(detail.candidates[0].contact).toEqual({ channel: 'phone', detail: '555-0119' });
    expect((await api.getRequesterStatus('S-1041', volunteer)).stage).toBe('contact_arranged');
  });

  it('won’t record consent before the relationship is confirmed', async () => {
    const api = createMockApi();
    await api.submitReviewDecision('S-1041', { type: 'begin_verification', registrationReference: 'R-2210' }, coordinator);
    await expect(
      api.recordVerificationStep('S-1041', 'R-2210', step('registered_consent', 'agrees'), coordinator),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('closes the door when the registered person declines, and the requester learns nothing', async () => {
    const api = createMockApi();
    await api.submitReviewDecision('S-1041', { type: 'begin_verification', registrationReference: 'R-2210' }, coordinator);
    await api.recordVerificationStep('S-1041', 'R-2210', step('relationship', 'confirmed'), coordinator);
    const detail = await api.recordVerificationStep('S-1041', 'R-2210', step('registered_consent', 'declines'), coordinator);
    expect(detail.candidates[0].review.state).toBe('declined');
    expect(detail.status).toBe('open');
    await expect(api.requestContactCoordination('S-1041', 'R-2210', 'supervised_call', coordinator)).rejects.toMatchObject({
      code: 'consent_required',
    });
    expect(await api.getRequesterStatus('S-1041', volunteer)).toEqual({ reference: 'S-1041', stage: 'active' });
  });

  it('records ambiguity without forcing a conclusion', async () => {
    const api = createMockApi();
    const detail = await api.submitReviewDecision(
      'S-1042',
      { type: 'flag_for_review', reasons: ['possible_duplicate'], note: 'Ask Inés for his middle name.' },
      coordinator,
    );
    expect(detail.status).toBe('needs_review');
    expect(detail.candidates.every((c) => c.review.state === 'possible')).toBe(true);
  });
});

describe('failure handling', () => {
  const draft = () => ({
    ...emptyRegistrationDraft('lincoln'),
    preferredName: 'Robbie T',
    age: { mode: 'unknown' as const, years: '', band: '' as const },
    safety: 'none' as const,
    matching: 'unknown' as const,
    contact: 'unknown' as const,
  });

  it('saves nothing when a request fails, and a retry never creates a duplicate', async () => {
    const api = createMockApi();
    const input = toRegistrationInput(draft());
    const before = (await api.getDashboard(volunteer)).awaitingConsent.length;

    networkSimulation.set({ mode: 'failing' });
    await expect(api.createRegistration(input, volunteer)).rejects.toMatchObject({ code: 'server_unavailable' });
    networkSimulation.set({ mode: 'normal' });
    expect((await api.getDashboard(volunteer)).awaitingConsent.length).toBe(before);

    const first = await api.createRegistration(input, volunteer);
    const retry = await api.createRegistration(input, volunteer);
    expect(retry.reference).toBe(first.reference);
    expect((await api.getDashboard(volunteer)).awaitingConsent.length).toBe(before + 1);
  });

  it('fails fast and honestly when offline', async () => {
    const api = createMockApi();
    networkSimulation.set({ mode: 'offline' });
    await expect(api.createSearchRequest(victorSearch(), volunteer)).rejects.toMatchObject({ code: 'network_unavailable' });
  });

  it('matches a new registration against a nickname search', async () => {
    const api = createMockApi();
    const receipt = await api.createSearchRequest(
      toSearchInput({ ...emptySearchDraft('lincoln'), soughtName: 'Robert Tran', relationship: 'sibling', requesterName: 'Kim Tran' }),
      volunteer,
    );
    const detail = await api.getCase(receipt.reference, coordinator);
    expect(detail.candidates.map((c) => c.registrationReference)).toEqual(['R-2950']);
  });
});
