import type { Relationship } from '../domain/types';
import { newClientRequestId } from '../lib/id';
import { isReference, normalizeReference } from '../lib/reference';
import type { SearchRequestInput } from '../services/contracts';
import {
  ageFromDraft,
  contactFromDraft,
  emptyAge,
  optional,
  splitList,
  validateAge,
  validateContact,
  type AgeDraft,
  type ContactDraft,
  type FieldErrors,
} from './common';

export interface SearchDraft extends ContactDraft {
  clientRequestId: string;
  soughtName: string;
  soughtOtherNames: string;
  age: AgeDraft;
  relationship: Relationship | '';
  lastKnown: string;
  details: string;
  requesterName: string;
  requesterShelterId: string;
  requesterRegistrationRef: string;
}

export type SearchField =
  | 'soughtName'
  | 'relationship'
  | 'age'
  | 'ageYears'
  | 'ageBand'
  | 'requesterName'
  | 'requesterShelterId'
  | 'requesterRegistrationRef'
  | 'contactDetail';

export const SEARCH_FIELD_ORDER: SearchField[] = [
  'soughtName',
  'relationship',
  'age',
  'ageYears',
  'ageBand',
  'requesterName',
  'requesterShelterId',
  'requesterRegistrationRef',
  'contactDetail',
];

export function emptySearchDraft(shelterId: string): SearchDraft {
  return {
    clientRequestId: newClientRequestId(),
    soughtName: '',
    soughtOtherNames: '',
    age: emptyAge(),
    relationship: '',
    lastKnown: '',
    details: '',
    requesterName: '',
    requesterShelterId: shelterId,
    requesterRegistrationRef: '',
    contactChannel: 'shelter_desk',
    contactDetail: '',
  };
}

export function validateSearch(d: SearchDraft): FieldErrors<SearchField> {
  const errors: FieldErrors<SearchField> = {};
  if (!d.soughtName.trim()) errors.soughtName = 'Enter any name or nickname they might use';
  if (!d.relationship) errors.relationship = 'Choose how they\u2019re related';
  Object.assign(errors, validateAge(d.age, false));
  if (!d.requesterName.trim()) errors.requesterName = 'Enter the name of the person asking';
  if (!d.requesterShelterId) errors.requesterShelterId = 'Choose where the person asking is staying';
  if (d.requesterRegistrationRef.trim() && !isReference(d.requesterRegistrationRef, 'R')) {
    errors.requesterRegistrationRef = 'References look like R-2210. Leave this blank if they don\u2019t have one.';
  }
  Object.assign(errors, validateContact(d));
  return errors;
}

export function toSearchInput(d: SearchDraft): SearchRequestInput {
  return {
    clientRequestId: d.clientRequestId,
    requester: {
      name: d.requesterName.trim(),
      shelterId: d.requesterShelterId,
      contact: contactFromDraft(d),
      registrationReference: d.requesterRegistrationRef.trim() ? normalizeReference(d.requesterRegistrationRef) : undefined,
    },
    sought: {
      name: d.soughtName.trim(),
      otherNames: splitList(d.soughtOtherNames),
      age: ageFromDraft(d.age),
      relationship: d.relationship || 'other_family',
      lastKnown: optional(d.lastKnown),
      details: optional(d.details),
    },
  };
}
