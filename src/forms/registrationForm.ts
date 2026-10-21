import type { ConsentState } from '../domain/types';
import { newClientRequestId } from '../lib/id';
import type { RegistrationInput } from '../services/contracts';
import {
  ageFromDraft,
  contactFromDraft,
  emptyAge,
  isMinorDraft,
  optional,
  splitList,
  validateAge,
  validateContact,
  type AgeDraft,
  type ContactDraft,
  type FieldErrors,
} from './common';

export interface RegistrationDraft extends ContactDraft {
  clientRequestId: string;
  preferredName: string;
  nameWithheld: boolean;
  fullName: string;
  otherNames: string;
  age: AgeDraft;
  shelterId: string;
  safety: '' | 'none' | 'concern';
  matching: '' | ConsentState;
  contact: '' | ConsentState;
  lastKnownArea: string;
  recognizableDetails: string;
  familyNotes: string;
  accompanyingAdult: string;
}

export type RegistrationField =
  | 'preferredName'
  | 'recognizableDetails'
  | 'age'
  | 'ageYears'
  | 'ageBand'
  | 'shelterId'
  | 'safety'
  | 'matching'
  | 'contact'
  | 'contactDetail';

/** Order errors appear in the summary: the same order as the form. */
export const REGISTRATION_FIELD_ORDER: RegistrationField[] = [
  'preferredName',
  'recognizableDetails',
  'age',
  'ageYears',
  'ageBand',
  'shelterId',
  'safety',
  'matching',
  'contact',
  'contactDetail',
];

export function emptyRegistrationDraft(shelterId: string): RegistrationDraft {
  return {
    clientRequestId: newClientRequestId(),
    preferredName: '',
    nameWithheld: false,
    fullName: '',
    otherNames: '',
    age: emptyAge(),
    shelterId,
    safety: '',
    matching: '',
    contact: '',
    lastKnownArea: '',
    recognizableDetails: '',
    familyNotes: '',
    contactChannel: 'shelter_desk',
    contactDetail: '',
    accompanyingAdult: '',
  };
}

export function validateRegistration(d: RegistrationDraft): FieldErrors<RegistrationField> {
  const errors: FieldErrors<RegistrationField> = {};
  if (!d.nameWithheld) {
    if (!d.preferredName.trim()) errors.preferredName = 'Enter the name they go by, or tick \u201CThey can\u2019t or won\u2019t give a name\u201D';
    else if (d.preferredName.trim().length > 80) errors.preferredName = 'Keep the name under 80 characters';
  } else if (!d.recognizableDetails.trim()) {
    errors.recognizableDetails = 'Describe them so staff can find this record later';
  }
  Object.assign(errors, validateAge(d.age, true));
  if (!d.shelterId) errors.shelterId = 'Choose the shelter they\u2019re staying at';
  if (!d.safety) errors.safety = 'Ask whether there\u2019s anyone they don\u2019t want to be found by';
  if (d.safety === 'none' && !isMinorDraft(d.age)) {
    if (!d.matching) errors.matching = 'Record their answer. Choose \u201CCouldn\u2019t ask yet\u201D if you haven\u2019t asked.';
    if (!d.contact) errors.contact = 'Record their answer about contact';
  }
  Object.assign(errors, validateContact(d));
  return errors;
}

export function toRegistrationInput(d: RegistrationDraft): RegistrationInput {
  const protectedRecord = d.safety === 'concern';
  const minor = isMinorDraft(d.age);
  return {
    clientRequestId: d.clientRequestId,
    names: {
      preferred: d.nameWithheld ? undefined : d.preferredName.trim(),
      full: d.nameWithheld ? undefined : optional(d.fullName),
      others: d.nameWithheld ? [] : splitList(d.otherNames),
    },
    age: ageFromDraft(d.age),
    shelterId: d.shelterId,
    lastKnownArea: optional(d.lastKnownArea),
    recognizableDetails: optional(d.recognizableDetails),
    familyNotes: optional(d.familyNotes),
    contact: contactFromDraft(d),
    consent:
      protectedRecord
        ? { matching: 'declined', contact: 'declined' }
        : minor
          ? { matching: 'unknown', contact: 'unknown' }
          : { matching: d.matching || 'unknown', contact: d.contact || 'unknown' },
    safetyConcern: protectedRecord,
    accompanyingAdult: minor ? optional(d.accompanyingAdult) : undefined,
  };
}
