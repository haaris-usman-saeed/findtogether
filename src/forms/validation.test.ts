import { describe, expect, it } from 'vitest';
import { emptyRegistrationDraft, toRegistrationInput, validateRegistration, type RegistrationDraft } from './registrationForm';
import { emptySearchDraft, validateSearch } from './searchForm';

const aliasOnly = (): RegistrationDraft => ({
  ...emptyRegistrationDraft('lincoln'),
  preferredName: 'Big Mike',
  age: { mode: 'approximate', years: '', band: '45to64' },
  safety: 'none',
  matching: 'granted',
  contact: 'unknown',
});

describe('registration validation', () => {
  it('accepts an alias and an approximate age with no ID or phone', () => {
    const draft = aliasOnly();
    expect(validateRegistration(draft)).toEqual({});
    const input = toRegistrationInput(draft);
    expect(input.contact).toEqual({ channel: 'shelter_desk' });
    expect(input.names.full).toBeUndefined();
  });

  it('requires an explicit answer about family search and contact', () => {
    const errors = validateRegistration({ ...aliasOnly(), matching: '', contact: '' });
    expect(errors.matching).toBeTruthy();
    expect(errors.contact).toBeTruthy();
  });

  it('records "couldn’t ask yet" as unknown, never as permission', () => {
    const input = toRegistrationInput({ ...aliasOnly(), matching: 'unknown' });
    expect(input.consent.matching).toBe('unknown');
  });

  it('treats a safety concern as declined, whatever else was chosen', () => {
    const input = toRegistrationInput({ ...aliasOnly(), safety: 'concern', matching: 'granted', contact: 'granted' });
    expect(input.safetyConcern).toBe(true);
    expect(input.consent).toEqual({ matching: 'declined', contact: 'declined' });
  });

  it('allows a person with no name if they are described', () => {
    const draft = { ...aliasOnly(), preferredName: '', nameWithheld: true };
    expect(validateRegistration(draft).recognizableDetails).toBeTruthy();
    expect(validateRegistration({ ...draft, recognizableDetails: 'Red jacket, arrived on bus 4' })).toEqual({});
  });

  it('asks for a number only when phone contact is chosen', () => {
    expect(validateRegistration({ ...aliasOnly(), contactChannel: 'phone' }).contactDetail).toBeTruthy();
    expect(validateRegistration({ ...aliasOnly(), contactChannel: 'phone', contactDetail: '555-0100' })).toEqual({});
  });

  it('does not ask children for consent and leaves it unknown', () => {
    const child = { ...aliasOnly(), age: { mode: 'exact' as const, years: '9', band: '' as const }, matching: '' as const, contact: '' as const };
    expect(validateRegistration(child)).toEqual({});
    expect(toRegistrationInput(child).consent).toEqual({ matching: 'unknown', contact: 'unknown' });
  });

  it('rejects impossible ages', () => {
    expect(validateRegistration({ ...aliasOnly(), age: { mode: 'exact', years: '140', band: '' } }).ageYears).toBeTruthy();
  });
});

describe('search validation', () => {
  it('accepts a nickname, a relationship, and the requester’s name', () => {
    expect(
      validateSearch({ ...emptySearchDraft('lincoln'), soughtName: 'Mari', relationship: 'sibling', requesterName: 'Danny' }),
    ).toEqual({});
  });

  it('checks the requester’s reference format', () => {
    const errors = validateSearch({
      ...emptySearchDraft('lincoln'),
      soughtName: 'Mari',
      relationship: 'sibling',
      requesterName: 'Danny',
      requesterRegistrationRef: '12',
    });
    expect(errors.requesterRegistrationRef).toBeTruthy();
  });
});
