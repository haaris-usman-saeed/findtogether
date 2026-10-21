import type {
  ConfirmationMethod,
  ConsentState,
  ContactChannel,
  ContactMethod,
  Relationship,
  ReviewReason,
} from './types';

export const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  spouse_partner: 'Spouse or partner',
  parent: 'Parent',
  child: 'Child',
  sibling: 'Brother or sister',
  grandparent: 'Grandparent',
  grandchild: 'Grandchild',
  other_family: 'Other family',
  friend: 'Friend or neighbor',
};

/**
 * What the requester is to the sought person, phrased for a question:
 * "Ask whether they're looking for ___."
 */
export const RELATIONSHIP_INVERSE: Record<Relationship, string> = {
  spouse_partner: 'a spouse or partner',
  parent: 'a son or daughter',
  child: 'a parent',
  sibling: 'a brother or sister',
  grandparent: 'a grandchild',
  grandchild: 'a grandparent',
  other_family: 'a relative',
  friend: 'a friend or neighbor',
};

export const CONTACT_CHANNEL_LABEL: Record<ContactChannel, string> = {
  shelter_desk: 'Through the shelter desk',
  phone: 'Phone',
  email: 'Email',
  caseworker: 'Through a caseworker',
};

export const CONSENT_LABEL: Record<'matching' | 'contact', Record<ConsentState, string>> = {
  matching: { granted: 'Family search allowed', declined: 'Family search declined', unknown: 'Not yet asked about family search' },
  contact: { granted: 'Agreed to contact', declined: 'Declined contact', unknown: 'Not yet asked about contact' },
};

export const METHOD_LABEL: Record<ConfirmationMethod, string> = {
  in_person: 'In person',
  phone: 'By phone',
  caseworker: 'Through a caseworker',
};

export const CONTACT_METHOD_LABEL: Record<ContactMethod, { label: string; description: string }> = {
  supervised_call: { label: 'Supervised call', description: 'A coordinator connects them by phone from a shelter.' },
  relayed_message: { label: 'Relayed message', description: 'A coordinator passes messages. No locations are shared.' },
  staffed_meeting: { label: 'Meeting with staff present', description: 'They meet at a shelter with a coordinator.' },
};

export const REVIEW_REASON_LABEL: Record<ReviewReason, string> = {
  distinguishing_detail: 'Need a detail that tells the records apart',
  possible_duplicate: 'Two records may be the same person',
  conflicting_details: 'Details conflict',
  senior_review: 'Needs a senior coordinator',
};
