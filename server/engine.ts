/**
 * In-memory stand-in for the FindTogether backend.
 *
 * It behaves like a server on purpose: it checks the caller's role, runs
 * matching and redaction itself, enforces the contact gate, and returns
 * copies rather than live objects. Nothing is written to localStorage,
 * sessionStorage, or any other browser storage; a reload resets everything.
 */
import { ageLabel, isMinorAge } from '../src/domain/age';
import { contactBlockers, emptyVerification, stepLockedReason } from '../src/domain/authorization';
import { CONTACT_METHOD_LABEL, METHOD_LABEL, REVIEW_REASON_LABEL } from '../src/domain/labels';
import { findCandidates, findPossibleDuplicates, type MatchResult } from '../src/domain/matching';
import { canReleaseContactDetails, isDiscoverable, requesterStage, requiresSafeguarding } from '../src/domain/privacy';
import { NEEDS_STAFF, STATUS_PRIORITY, deriveCaseStatus } from '../src/domain/status';
import type {
  CandidateReview,
  CaseRecord,
  ConsentDecisions,
  PersonNames,
  Registration,
  SearchRequest,
} from '../src/domain/types';
import { normalizeReference } from '../src/lib/reference';
import {
  ApiError,
  type CandidateView,
  type CaseDetail,
  type CaseSummary,
  type FindTogetherApi,
  type RegistrationInput,
  type RegistrationReceipt,
  type SearchReceipt,
  type SearchRequestInput,
  type Session,
} from '../src/services/contracts';
import { type Database } from '../src/services/mock/seed';

export function displayName(names: PersonNames): string {
  return names.preferred ?? names.full ?? 'Name not given';
}

const conflict = (message: string) => new ApiError('conflict', message);
const ACTIVE_STATES = new Set(['verifying', 'authorized', 'reconnected']);
async function transport<T>(work: () => T): Promise<T> { return structuredClone(work()); }

function validateRegistrationInput(input: RegistrationInput, db: Database): Record<string, string> | null {
  const errors: Record<string, string> = {};
  if (!input.names.preferred?.trim() && !input.recognizableDetails?.trim()) {
    errors.preferredName = 'A name or a description is required.';
  }
  if (input.age.kind === 'exact' && (input.age.years < 0 || input.age.years > 120)) errors.ageYears = 'Age must be between 0 and 120.';
  if (!db.shelters.some((s) => s.id === input.shelterId)) errors.shelterId = 'Unknown shelter.';
  return Object.keys(errors).length > 0 ? errors : null;
}

function validateSearchInput(input: SearchRequestInput, db: Database): Record<string, string> | null {
  const errors: Record<string, string> = {};
  if (!input.sought.name.trim()) errors.soughtName = 'A name or nickname is required.';
  if (!input.requester.name.trim()) errors.requesterName = 'The requester\u2019s name is required.';
  if (!db.shelters.some((s) => s.id === input.requester.shelterId)) errors.requesterShelterId = 'Unknown shelter.';
  return Object.keys(errors).length > 0 ? errors : null;
}

export function createServerEngine(db: Database): FindTogetherApi {
  let latestCreatedRequest: string | null = null;

  const now = () => new Date().toISOString();
  const shelterName = (id: string) => db.shelters.find((s) => s.id === id)?.name ?? 'Unknown shelter';

  function requireCoordinator(session: Session) {
    if (session.role !== 'coordinator') {
      throw new ApiError('forbidden', 'Only reunification coordinators can review cases.');
    }
  }

  function findRequest(reference: string): SearchRequest {
    const ref = normalizeReference(reference);
    const request = db.requests.find((r) => r.reference === ref);
    if (!request) throw new ApiError('not_found', `No search request has the reference ${ref}.`);
    return request;
  }

  function caseOf(request: SearchRequest): CaseRecord {
    const record = db.cases.get(request.id);
    if (!record) throw new ApiError('not_found', 'Case not found.');
    return record;
  }

  function log(record: CaseRecord, session: Session, text: string) {
    const at = now();
    record.history.unshift({ at, actor: session.staffName, text });
    record.updatedAt = at;
  }

  function addActivity(text: string, audience: 'everyone' | 'coordinator') {
    db.activity.unshift({ at: now(), text, audience });
  }

  function evaluate(request: SearchRequest) {
    const record = caseOf(request);
    const safeguarding = requiresSafeguarding(request);
    const matches = findCandidates(request, db.registrations);
    const reviewOf = (m: MatchResult): CandidateReview => record.reviews[m.registration.id] ?? { state: 'possible' };
    const status = deriveCaseStatus({
      safeguarding,
      reviewFlag: record.reviewFlag,
      candidateStates: matches.map((m) => reviewOf(m).state),
    });
    return { record, safeguarding, matches, reviewOf, status };
  }

  function findCandidate(request: SearchRequest, registrationReference: string) {
    const evaluation = evaluate(request);
    const ref = normalizeReference(registrationReference);
    const match = evaluation.matches.find((m) => m.registration.reference === ref);
    if (!match) throw new ApiError('not_found', 'That record is not a possible match for this case.');
    return { ...evaluation, match, review: evaluation.reviewOf(match) };
  }

  function summarize(request: SearchRequest): CaseSummary {
    const { record, safeguarding, matches, reviewOf, status } = evaluate(request);
    return {
      reference: request.reference,
      status,
      soughtName: request.sought.name,
      relationship: request.sought.relationship,
      requesterShelterName: shelterName(request.requester.shelterId),
      updatedAt: record.updatedAt,
      possibleMatchCount: safeguarding
        ? 0
        : matches.filter((m) => !['ruled_out', 'declined'].includes(reviewOf(m).state)).length,
    };
  }

  function candidateView(m: MatchResult, review: CandidateReview, duplicates: Map<string, string[]>): CandidateView {
    const r = m.registration;
    return {
      registrationReference: r.reference,
      displayName: displayName(r.names),
      fullName: r.names.full,
      otherNames: r.names.others,
      age: ageLabel(r.age),
      shelterName: canReleaseContactDetails(review.state) ? shelterName(r.shelterId) : "Withheld until contact is authorized",
      registeredAt: r.createdAt,
      lastKnownArea: r.lastKnownArea,
      recognizableDetails: r.recognizableDetails,
      familyNotes: r.familyNotes,
      consent: r.consent,
      evidence: m.evidence,
      review,
      possibleDuplicateOf: duplicates.get(r.reference) ?? [],
      contact: canReleaseContactDetails(review.state) ? r.contact : undefined,
    };
  }

  function detail(request: SearchRequest): CaseDetail {
    const { record, safeguarding, matches, reviewOf, status } = evaluate(request);
    const duplicates = findPossibleDuplicates(matches.map((m) => m.registration));
    const released = matches.some((m) => canReleaseContactDetails(reviewOf(m).state));
    const { sought, requester } = request;
    return {
      reference: request.reference,
      status,
      safeguarding,
      request: {
        soughtName: sought.name,
        soughtOtherNames: sought.otherNames,
        soughtAge: ageLabel(sought.age),
        relationship: sought.relationship,
        lastKnown: sought.lastKnown,
        details: sought.details,
        requesterName: requester.name,
        requesterShelterName: shelterName(requester.shelterId),
        requesterRegistrationReference: requester.registrationReference,
        requesterContactChannel: requester.contact.channel,
        requesterContactDetail: released ? requester.contact.detail : undefined,
        submittedAt: request.createdAt,
      },
      candidates: matches.map((m) => candidateView(m, reviewOf(m), duplicates)),
      reviewFlag: record.reviewFlag,
      history: record.history,
      updatedAt: record.updatedAt,
    };
  }

  const api: FindTogetherApi = {
    getShelters: () => transport(() => db.shelters),

    createRegistration: (input, session) =>
      transport(() => {
        const previous = db.receipts.get(input.clientRequestId);
        if (previous) return previous as RegistrationReceipt;
        const errors = validateRegistrationInput(input, db);
        if (errors) throw new ApiError('validation', 'Some details need fixing.', errors);

        const minor = isMinorAge(input.age);
        const reference = `R-${db.nextRegistration++}`;
        const registration: Registration = {
          id: `reg_${reference}`,
          reference,
          names: { preferred: input.names.preferred, full: input.names.full, others: input.names.others },
          age: input.age,
          shelterId: input.shelterId,
          lastKnownArea: input.lastKnownArea,
          recognizableDetails: input.recognizableDetails,
          familyNotes: input.familyNotes,
          contact: input.contact,
          // The server, not the form, decides what a safety concern or a child's record implies.
          consent: input.safetyConcern
            ? { matching: 'declined', contact: 'declined' }
            : minor
              ? { matching: 'unknown', contact: 'unknown' }
              : input.consent,
          safetyConcern: input.safetyConcern,
          accompanyingAdult: input.accompanyingAdult,
          createdAt: now(),
          createdBy: session.staffName,
        };
        db.registrations.push(registration);
        if (isDiscoverable(registration)) addActivity(`Registration ${reference} saved`, 'coordinator');
        const receipt: RegistrationReceipt = {
          reference,
          createdAt: registration.createdAt,
          shelterName: shelterName(registration.shelterId),
          discoverable: isDiscoverable(registration),
          routedToSafeguarding: minor,
        };
        db.receipts.set(input.clientRequestId, receipt);
        return receipt;
      }),

    recordConsent: (registrationReference, consent, session) =>
      transport(() => {
        const ref = normalizeReference(registrationReference);
        const registration = db.registrations.find((r) => r.reference === ref);
        // One response for "doesn't exist", "another shelter", and "protected", so references can't be probed.
        if (
          !registration ||
          registration.safetyConcern ||
          (session.role === 'volunteer' && registration.shelterId !== session.shelterId)
        ) {
          throw new ApiError('not_found', 'No record with that reference at this shelter.');
        }
        if (isMinorAge(registration.age)) {
          throw new ApiError('forbidden', 'Children\u2019s records are managed by the safeguarding team.');
        }
        registration.consent = { ...consent };
        for (const record of db.cases.values()) {
          const review = record.reviews[registration.id];
          if (review && (consent.matching !== 'granted' || consent.contact !== 'granted') && ACTIVE_STATES.has(review.state)) {
            record.reviews[registration.id] = { ...review, state: 'declined' };
            log(record, session, 'Contact permission withdrawn; prior authorization ended');
          }
        }
        addActivity(`Family search answer recorded for ${registration.reference}`, 'everyone');
      }),

    createSearchRequest: (input, session) =>
      transport(() => {
        const previous = db.receipts.get(input.clientRequestId);
        if (previous) return previous as SearchReceipt;
        const errors = validateSearchInput(input, db);
        if (errors) throw new ApiError('validation', 'Some details need fixing.', errors);

        const reference = `S-${db.nextRequest++}`;
        const request: SearchRequest = {
          id: `req_${reference}`,
          reference,
          requester: input.requester,
          sought: input.sought,
          createdAt: now(),
          createdBy: session.staffName,
        };
        db.requests.push(request);
        const record: CaseRecord = { requestId: request.id, reviews: {}, history: [], updatedAt: request.createdAt };
        db.cases.set(request.id, record);
        log(record, session, `Search request saved at ${shelterName(input.requester.shelterId)}`);
        addActivity(`Search request ${reference} saved at ${shelterName(input.requester.shelterId)}`, 'everyone');

        const routedToSafeguarding = requiresSafeguarding(request);
        if (routedToSafeguarding) {
          log(record, session, 'Referred to the safeguarding team');
          addActivity(`${reference} referred to the safeguarding team`, 'coordinator');
        }
        latestCreatedRequest = reference;
        const receipt: SearchReceipt = { reference, createdAt: request.createdAt, routedToSafeguarding };
        db.receipts.set(input.clientRequestId, receipt);
        return receipt;
      }),

    getRequesterStatus: (requestReference, _session) =>
      transport(() => {
        // A miss reveals only that no request has this reference. It says nothing about the person sought.
        const request = findRequest(requestReference);
        return { reference: request.reference, stage: requesterStage(evaluate(request).status) };
      }),

    getDashboard: (session) =>
      transport(() => {
        const waiting = db.requests
          .map(summarize)
          .filter((c) => NEEDS_STAFF.has(c.status))
          .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] || b.updatedAt.localeCompare(a.updatedAt));
        return {
          shelterName: shelterName(session.shelterId),
          reviewQueue: {
            count: waiting.length,
            cases: session.role === 'coordinator' ? waiting.slice(0, 5) : null,
          },
          awaitingConsent: db.registrations
            .filter(
              (r) =>
                r.shelterId === session.shelterId &&
                !r.safetyConcern &&
                !isMinorAge(r.age) &&
                r.consent.matching === 'unknown',
            )
            .map((r) => ({ reference: r.reference, name: displayName(r.names), registeredAt: r.createdAt })),
          activity: db.activity
            .filter((a) => a.audience === 'everyone' || session.role === 'coordinator')
            .slice(0, 8)
            .map(({ at, text }) => ({ at, text })),
        };
      }),

    listCases: (session) =>
      transport(() => {
        requireCoordinator(session);
        return db.requests
          .map(summarize)
          .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] || b.updatedAt.localeCompare(a.updatedAt));
      }),

    getCase: (requestReference, session) =>
      transport(() => {
        requireCoordinator(session);
        return detail(findRequest(requestReference));
      }),

    submitReviewDecision: (requestReference, decision, session) =>
      transport(() => {
        requireCoordinator(session);
        const request = findRequest(requestReference);
        const record = caseOf(request);
        if (requiresSafeguarding(request)) {
          throw new ApiError('forbidden', 'Safeguarding cases are handled by the safeguarding team.');
        }

        switch (decision.type) {
          case 'begin_verification': {
            const { match, review, matches, reviewOf } = findCandidate(request, decision.registrationReference);
            if (review.state !== 'possible') throw conflict('This record is not waiting for review.');
            const busy = matches.find((m) => m !== match && ACTIVE_STATES.has(reviewOf(m).state));
            if (busy) throw conflict(`Finish with ${busy.registration.reference} before verifying another record.`);
            record.reviews[match.registration.id] = { state: 'verifying', verification: emptyVerification() };
            log(record, session, `Verification started for ${match.registration.reference}`);
            break;
          }
          case 'stop_verification': {
            const { match, review } = findCandidate(request, decision.registrationReference);
            if (review.state !== 'verifying') throw conflict('This record is not being verified.');
            record.reviews[match.registration.id] = { state: 'possible' };
            log(record, session, `Verification stopped for ${match.registration.reference}`);
            break;
          }
          case 'rule_out': {
            const { match, review } = findCandidate(request, decision.registrationReference);
            const reason = decision.reason.trim();
            if (!reason) throw new ApiError('validation', 'Give a reason.', { reason: 'Give a reason.' });
            if (review.state !== 'possible' && review.state !== 'verifying') throw conflict('This record can\u2019t be ruled out now.');
            record.reviews[match.registration.id] = { state: 'ruled_out', ruledOutReason: reason };
            log(record, session, `Ruled out ${match.registration.reference}: ${reason}`);
            break;
          }
          case 'flag_for_review': {
            const note = decision.note.trim();
            const fieldErrors: Record<string, string> = {};
            if (decision.reasons.length === 0) fieldErrors.reasons = 'Choose at least one reason.';
            if (!note) fieldErrors.note = 'Say what would settle this.';
            if (Object.keys(fieldErrors).length > 0) throw new ApiError('validation', 'Some details need fixing.', fieldErrors);
            record.reviewFlag = { reasons: decision.reasons, note, raisedBy: session.staffName, raisedAt: now() };
            log(record, session, `Sent for additional review: ${decision.reasons.map((r) => REVIEW_REASON_LABEL[r].toLowerCase()).join('; ')}`);
            break;
          }
          case 'clear_review_flag': {
            if (!record.reviewFlag) throw conflict('This case is not waiting for additional review.');
            record.reviewFlag = undefined;
            log(record, session, 'Additional review marked complete');
            break;
          }
          case 'record_contact_made': {
            const { match, review } = findCandidate(request, decision.registrationReference);
            if (review.state !== 'authorized') throw conflict('Contact has not been authorized for this record.');
            record.reviews[match.registration.id] = { ...review, state: 'reconnected' };
            log(record, session, `Contact made with ${match.registration.reference}`);
            addActivity(`${request.reference}: contact made`, 'coordinator');
            break;
          }
        }
        return detail(request);
      }),

    recordVerificationStep: (requestReference, registrationReference, input, session) =>
      transport(() => {
        requireCoordinator(session);
        const request = findRequest(requestReference);
        const record = caseOf(request);
        const { match, review } = findCandidate(request, registrationReference);
        if (review.state !== 'verifying' || !review.verification) throw conflict('Start verification before recording steps.');
        const locked = stepLockedReason(input.step, review.verification);
        if (locked) throw conflict(locked);
        if (!METHOD_LABEL[input.method]) throw new ApiError('validation', 'Say how you reached them.', { method: 'Say how you reached them.' });

        const stamp = {
          method: input.method,
          note: input.note?.trim() || undefined,
          recordedBy: session.staffName,
          recordedAt: now(),
        };
        const v = review.verification;
        const registration = match.registration;
        const ref = registration.reference;
        const how = METHOD_LABEL[input.method].toLowerCase();

        if (input.step === 'relationship') {
          v.relationship = { result: input.result, ...stamp };
          if (input.result !== 'confirmed') {
            v.registeredConsent = { result: 'pending' };
            v.requesterConsent = { result: 'pending' };
          }
          const text = {
            confirmed: `Relationship confirmed with ${ref} (${how})`,
            not_confirmed: `Relationship not confirmed with ${ref} (${how})`,
            unreachable: `Couldn\u2019t reach ${ref} to confirm the relationship`,
          }[input.result];
          log(record, session, text);
        } else if (input.step === 'registered_consent') {
          v.registeredConsent = { result: input.result, ...stamp };
          if (input.result === 'agrees') registration.consent.contact = 'granted';
          if (input.result === 'declines') {
            registration.consent.contact = 'declined';
            review.state = 'declined';
          }
          const text = {
            agrees: `${ref} agreed to contact (${how})`,
            declines: `${ref} declined contact`,
            unreachable: `Couldn\u2019t reach ${ref} about contact`,
          }[input.result];
          log(record, session, text);
        } else {
          v.requesterConsent = { result: input.result, ...stamp };
          if (input.result === 'declines') review.state = 'declined';
          const text = {
            agrees: `Person searching confirmed contact (${how})`,
            declines: 'Person searching declined contact',
            unreachable: 'Couldn\u2019t reach the person searching',
          }[input.result];
          log(record, session, text);
        }
        record.reviews[registration.id] = review;
        return detail(request);
      }),

    requestContactCoordination: (requestReference, registrationReference, method, session) =>
      transport(() => {
        requireCoordinator(session);
        const request = findRequest(requestReference);
        const record = caseOf(request);
        const { match, review, safeguarding } = findCandidate(request, registrationReference);
        // The same gate the interface shows. Enforced here regardless of what the browser displayed.
        const registration = match.registration;
        if (record.reviewFlag) throw conflict('Resolve the additional review flag before authorizing contact.');
        const blockers = contactBlockers({
          safeguarding,
          registration: { safetyConcern: registration.safetyConcern, isMinor: isMinorAge(registration.age), consent: registration.consent },
          review,
        });
        if (blockers.length > 0) {
          throw new ApiError('consent_required', `Contact can\u2019t be authorized yet. Still needed: ${blockers.join('; ')}.`);
        }
        if (!CONTACT_METHOD_LABEL[method]) {
          throw new ApiError('validation', 'Choose how contact will happen.', { method: 'Choose how contact will happen.' });
        }
        record.reviews[match.registration.id] = { ...review, state: 'authorized', contactMethod: method };
        log(record, session, `Contact coordination authorized for ${match.registration.reference}: ${CONTACT_METHOD_LABEL[method].label.toLowerCase()}`);
        addActivity(`${request.reference}: contact coordination authorized`, 'coordinator');
        return detail(request);
      }),

  };
  return api;
}
