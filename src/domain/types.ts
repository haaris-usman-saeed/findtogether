/**
 * Domain model: records as a server would store them.
 *
 * Components never receive these types directly. They receive role-specific
 * views from the service layer (src/services/contracts.ts), so the privacy
 * boundary between "what is stored" and "what a viewer may see" is visible
 * in the type system.
 */

export type Role = 'volunteer' | 'coordinator';

/**
 * Silence is never permission. 'unknown' is treated exactly like 'declined'
 * by every matching and contact gate; it only differs in how the interface
 * prompts staff to follow up.
 */
export type ConsentState = 'unknown' | 'granted' | 'declined';

export interface ConsentDecisions {
  /** May this person be checked against family search requests? */
  matching: ConsentState;
  /** If a match is confirmed, may a coordinator arrange contact? */
  contact: ConsentState;
}

export const AGE_BANDS = ['under5', '5to12', '13to17', '18to29', '30to44', '45to64', '65to79', '80plus'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export type AgeInfo =
  | { kind: 'exact'; years: number }
  | { kind: 'approximate'; band: AgeBand }
  | { kind: 'unknown' };

export type ContactChannel = 'shelter_desk' | 'phone' | 'email' | 'caseworker';

export interface ContactPreference {
  channel: ContactChannel;
  /** Phone number, email address, or caseworker name. Absent for the shelter desk. */
  detail?: string;
}

export const RELATIONSHIPS = [
  'spouse_partner',
  'parent',
  'child',
  'sibling',
  'grandparent',
  'grandchild',
  'other_family',
  'friend',
] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export interface Shelter {
  id: string;
  name: string;
  area: string;
}

export interface PersonNames {
  /** The name they go by. Absent when the person can't or won't give one. */
  preferred?: string;
  full?: string;
  others: string[];
}

export interface Registration {
  id: string;
  reference: string;
  names: PersonNames;
  age: AgeInfo;
  shelterId: string;
  lastKnownArea?: string;
  recognizableDetails?: string;
  familyNotes?: string;
  contact: ContactPreference;
  consent: ConsentDecisions;
  /**
   * The person said someone must not find them, or would not say. The record
   * is never matched and its existence is never acknowledged to anyone searching.
   */
  safetyConcern: boolean;
  /** For children: who they arrived with, as stated. Not verified. */
  accompanyingAdult?: string;
  createdAt: string;
  createdBy: string;
}

export interface SoughtPerson {
  name: string;
  otherNames: string[];
  age: AgeInfo;
  /** What the sought person is to the requester. */
  relationship: Relationship;
  lastKnown?: string;
  details?: string;
}

export interface Requester {
  name: string;
  shelterId: string;
  contact: ContactPreference;
  /** The requester's own registration, if they have one. */
  registrationReference?: string;
}

export interface SearchRequest {
  id: string;
  reference: string;
  requester: Requester;
  sought: SoughtPerson;
  createdAt: string;
  createdBy: string;
}

/** Review state of one registration as a possible match for one search request. */
export type CandidateState = 'possible' | 'verifying' | 'ruled_out' | 'declined' | 'authorized' | 'reconnected';

export type RelationshipResult = 'pending' | 'confirmed' | 'not_confirmed' | 'unreachable';
export type ConsentResult = 'pending' | 'agrees' | 'declines' | 'unreachable';
export type ConfirmationMethod = 'in_person' | 'phone' | 'caseworker';

export interface RecordedStep<R extends string> {
  result: R;
  method?: ConfirmationMethod;
  note?: string;
  recordedBy?: string;
  recordedAt?: string;
}

export interface Verification {
  relationship: RecordedStep<RelationshipResult>;
  registeredConsent: RecordedStep<ConsentResult>;
  requesterConsent: RecordedStep<ConsentResult>;
}

export type ContactMethod = 'supervised_call' | 'relayed_message' | 'staffed_meeting';

export interface CandidateReview {
  state: CandidateState;
  verification?: Verification;
  contactMethod?: ContactMethod;
  ruledOutReason?: string;
}

export type ReviewReason = 'distinguishing_detail' | 'possible_duplicate' | 'conflicting_details' | 'senior_review';

export interface ReviewFlag {
  reasons: ReviewReason[];
  note: string;
  raisedBy: string;
  raisedAt: string;
}

export interface CaseEvent {
  at: string;
  actor: string;
  text: string;
}

/** Staff-side review state for one search request. Candidates are computed, not stored. */
export interface CaseRecord {
  requestId: string;
  /** Keyed by registration id. A registration with no entry is a fresh possible match. */
  reviews: Record<string, CandidateReview>;
  reviewFlag?: ReviewFlag;
  history: CaseEvent[];
  updatedAt: string;
}

export type CaseStatus =
  | 'open'
  | 'possible_match'
  | 'needs_review'
  | 'verification_pending'
  | 'contact_authorized'
  | 'reconnected'
  | 'safeguarding';

export type EvidenceKind = 'agrees' | 'differs' | 'missing';

export interface Evidence {
  kind: EvidenceKind;
  text: string;
}
