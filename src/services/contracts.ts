/**
 * The contract between the interface and any backend.
 *
 * Input types are what the browser sends. View types are what each role is
 * allowed to receive. A real server must build these views itself and must
 * never send fields a role isn't allowed to see; hiding them in the browser
 * is not protection. See docs/API.md for the HTTP mapping.
 */
import type { RequesterStage } from '../domain/privacy';
import type {
  CandidateReview,
  CaseEvent,
  CaseStatus,
  ConfirmationMethod,
  ConsentDecisions,
  ConsentResult,
  ContactChannel,
  ContactMethod,
  ContactPreference,
  Evidence,
  Registration,
  Relationship,
  RelationshipResult,
  ReviewFlag,
  ReviewReason,
  Role,
  SearchRequest,
  Shelter,
} from '../domain/types';

/**
 * Who is acting. The mock reads this directly. A real server derives it from
 * the authenticated session and ignores anything the browser claims.
 */
export interface Session {
  role: Role;
  staffName: string;
  shelterId: string;
  shelterName: string;
}

// Inputs

export type RegistrationInput = Omit<Registration, 'id' | 'reference' | 'createdAt' | 'createdBy'> & {
  /** Same value on every retry of one submission, so a retry can't create a duplicate record. */
  clientRequestId: string;
};

export type SearchRequestInput = Omit<SearchRequest, 'id' | 'reference' | 'createdAt' | 'createdBy'> & {
  clientRequestId: string;
};

export type ReviewDecision =
  | { type: 'begin_verification'; registrationReference: string }
  | { type: 'stop_verification'; registrationReference: string }
  | { type: 'rule_out'; registrationReference: string; reason: string }
  | { type: 'flag_for_review'; reasons: ReviewReason[]; note: string }
  | { type: 'clear_review_flag' }
  | { type: 'record_contact_made'; registrationReference: string };

export type VerificationStepInput =
  | { step: 'relationship'; result: Exclude<RelationshipResult, 'pending'>; method: ConfirmationMethod; note?: string }
  | { step: 'registered_consent'; result: Exclude<ConsentResult, 'pending'>; method: ConfirmationMethod; note?: string }
  | { step: 'requester_consent'; result: Exclude<ConsentResult, 'pending'>; method: ConfirmationMethod; note?: string };

// Views

export interface RegistrationReceipt {
  reference: string;
  createdAt: string;
  shelterName: string;
  /** Whether the record can be checked against family searches. Shown only to the volunteer who entered it. */
  discoverable: boolean;
  routedToSafeguarding: boolean;
}

export interface SearchReceipt {
  reference: string;
  createdAt: string;
  /** Derived from what the requester told us, not from any registration. */
  routedToSafeguarding: boolean;
}

/** Everything a requester can learn. Deliberately tiny: see domain/privacy.ts. */
export interface RequesterStatusView {
  reference: string;
  stage: RequesterStage;
}

export interface ActivityItem {
  at: string;
  text: string;
}

export interface CaseSummary {
  reference: string;
  status: CaseStatus;
  soughtName: string;
  relationship: Relationship;
  requesterShelterName: string;
  updatedAt: string;
  /** Always 0 for safeguarding cases. */
  possibleMatchCount: number;
}

export interface AwaitingConsentItem {
  reference: string;
  name: string;
  registeredAt: string;
}

export interface DashboardView {
  shelterName: string;
  reviewQueue: {
    count: number;
    /** Coordinators only. Volunteers receive null and see the count. */
    cases: CaseSummary[] | null;
  };
  /** People at this shelter whose answer about family search hasn't been recorded. */
  awaitingConsent: AwaitingConsentItem[];
  /** Volunteers see registrations and requests only. Case progress is coordinator-only. */
  activity: ActivityItem[];
}

export interface RequestView {
  soughtName: string;
  soughtOtherNames: string[];
  soughtAge: string;
  relationship: Relationship;
  lastKnown?: string;
  details?: string;
  requesterName: string;
  requesterShelterName: string;
  requesterRegistrationReference?: string;
  requesterContactChannel: ContactChannel;
  /** Released only once contact is authorized. */
  requesterContactDetail?: string;
  submittedAt: string;
}

export interface CandidateView {
  registrationReference: string;
  displayName: string;
  fullName?: string;
  otherNames: string[];
  age: string;
  shelterName: string;
  registeredAt: string;
  lastKnownArea?: string;
  recognizableDetails?: string;
  familyNotes?: string;
  consent: ConsentDecisions;
  evidence: Evidence[];
  review: CandidateReview;
  possibleDuplicateOf: string[];
  /** Released only once contact is authorized. */
  contact?: ContactPreference;
}

export interface CaseDetail {
  reference: string;
  status: CaseStatus;
  safeguarding: boolean;
  request: RequestView;
  /** Empty for safeguarding cases: those candidates are visible to the safeguarding lead only. */
  candidates: CandidateView[];
  reviewFlag?: ReviewFlag;
  history: CaseEvent[];
  updatedAt: string;
}

// Errors

export type ApiErrorCode =
  | 'network_unavailable'
  | 'timeout'
  | 'server_unavailable'
  | 'validation'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'consent_required';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly fieldErrors?: Record<string, string>;

  constructor(code: ApiErrorCode, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  /** Safe to retry with the same input: nothing was saved, or the retry is idempotent. */
  get retryable(): boolean {
    return this.code === 'network_unavailable' || this.code === 'timeout' || this.code === 'server_unavailable';
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError('server_unavailable', 'Something unexpected went wrong. Nothing was saved.');
}

// The service interface

export interface FindTogetherApi {
  getShelters(session: Session): Promise<Shelter[]>;
  createRegistration(input: RegistrationInput, session: Session): Promise<RegistrationReceipt>;
  recordConsent(registrationReference: string, consent: ConsentDecisions, session: Session): Promise<void>;
  createSearchRequest(input: SearchRequestInput, session: Session): Promise<SearchReceipt>;
  getRequesterStatus(requestReference: string, session: Session): Promise<RequesterStatusView>;
  getDashboard(session: Session): Promise<DashboardView>;
  listCases(session: Session): Promise<CaseSummary[]>;
  getCase(requestReference: string, session: Session): Promise<CaseDetail>;
  submitReviewDecision(requestReference: string, decision: ReviewDecision, session: Session): Promise<CaseDetail>;
  recordVerificationStep(
    requestReference: string,
    registrationReference: string,
    step: VerificationStepInput,
    session: Session,
  ): Promise<CaseDetail>;
  requestContactCoordination(
    requestReference: string,
    registrationReference: string,
    method: ContactMethod,
    session: Session,
  ): Promise<CaseDetail>;
}
