# FindTogether REST API contract

This is the contract the frontend expects. `src/services/contracts.ts` holds the same shapes as TypeScript types, and `src/services/http/httpApi.ts` is a client written against this document.

All paths are relative to `VITE_API_BASE_URL` (default `/api`). Bodies are JSON.

## Ground rules for the server

The browser enforces nothing. Every rule below must be enforced by the server on every request.

1. **Identity comes from the session.** Role (`volunteer` or `coordinator`) and assigned shelter come from the authenticated session. Ignore any role the client claims.
2. **Silence is not permission.** A registration enters matching only when `consent.matching` is `granted`, `safetyConcern` is false, and the person is not a child. `unknown` behaves exactly like `declined`.
3. **Protected records do not exist to anyone searching.** Exclude them before matching runs, not after. No endpoint may return different status codes, payloads, or noticeably different timing depending on whether a protected record exists.
4. **Children go to safeguarding.** Child records never enter ordinary matching. A search for a child, or for "my child" with no age, returns `safeguarding: true` and no candidates to ordinary coordinators.
5. **Contact details are withheld** from every view until contact is authorized for that pair.
6. **The contact gate runs on the server.** Contact can be authorized only after the relationship is confirmed and both people agree (see `contactBlockers` in `src/domain/authorization.ts`).
7. **Writes are idempotent.** POSTs that create records accept an `Idempotency-Key` header. A retry with the same key returns the original result instead of creating a duplicate.
8. **Everything is audited.** Each review decision and verification step records who, when, and how. Case history is append-only.

## Errors

Every error response looks like this:

```json
{ "error": { "code": "consent_required", "message": "Human-readable explanation.", "fieldErrors": { "field": "message" } } }
```

| Status | `code` | Meaning |
| --- | --- | --- |
| 400 or 422 | `validation` | Input rejected. `fieldErrors` keys match form field names. |
| 401 | `unauthenticated` | No valid session. |
| 403 | `forbidden` | Role not allowed (for example, a volunteer requesting a case). |
| 404 | `not_found` | No such reference, or not visible to this caller. Use 404, not 403, wherever a 403 would confirm that something exists. |
| 409 | `conflict` | Invalid state transition (for example, consent recorded before the relationship is confirmed). |
| 409 | `consent_required` | The contact gate is not satisfied. |
| 5xx | (any) | The client tells the user nothing was saved and offers a retry. |

The client treats network failure, timeout, and 5xx as retryable and resends with the same idempotency key.

## Endpoints

### `GET /shelters`
Any role. Returns `Shelter[]`: `{ id, name, area }`.

### `POST /registrations`
Any role. Header: `Idempotency-Key`. Body is `RegistrationInput` without `clientRequestId`:

```json
{
  "names": { "preferred": "Big Mike", "full": null, "others": [] },
  "age": { "kind": "approximate", "band": "45to64" },
  "shelterId": "lincoln",
  "lastKnownArea": "Bayview",
  "recognizableDetails": null,
  "familyNotes": null,
  "contact": { "channel": "shelter_desk" },
  "consent": { "matching": "granted", "contact": "unknown" },
  "safetyConcern": false,
  "accompanyingAdult": null
}
```

`age.kind` is `exact` (with `years`), `approximate` (with `band`), or `unknown`. The server must override consent: if `safetyConcern` is true, both answers become `declined`; for a child, both become `unknown` and safeguarding takes over.

`201` returns `RegistrationReceipt`: `{ reference, createdAt, shelterName, discoverable, routedToSafeguarding }`. Never tell the caller that a similar record already exists. Flag likely duplicates for coordinators instead.

### `POST /registrations/{reference}/consent`
Records a person's answer after registration. Volunteers may only update records at their own shelter. Body: `ConsentDecisions` `{ matching, contact }`. Returns `204`. Return 404 for a missing record, another shelter's record, or a protected record.

### `POST /search-requests`
Any role. Header: `Idempotency-Key`. Body:

```json
{
  "requester": { "name": "Daniel Ortiz", "shelterId": "westside", "contact": { "channel": "shelter_desk" }, "registrationReference": "R-1987" },
  "sought": { "name": "Mari Ortiz", "otherNames": [], "age": { "kind": "approximate", "band": "30to44" }, "relationship": "sibling", "lastKnown": "Bayview, near the harbor", "details": null }
}
```

`201` returns `SearchReceipt`: `{ reference, createdAt, routedToSafeguarding }`. `routedToSafeguarding` is based only on what the requester said.

### `GET /search-requests/{reference}/status`
Any role. This is the requester-facing view. Returns exactly:

```json
{ "reference": "S-1041", "stage": "active" }
```

`stage` is `active` or `contact_arranged`. No match, a protected record, a declined contact, and "still reviewing" all return `active`. Add no other fields. Rate-limit this endpoint per session and per IP.

### `GET /dashboard`
Any role. Returns `DashboardView`. For volunteers, `reviewQueue.cases` is `null` (count only) and `activity` excludes case progress.

### `GET /cases`
Coordinator only. Returns `CaseSummary[]`: `{ reference, status, soughtName, relationship, requesterShelterName, updatedAt, possibleMatchCount }`. `possibleMatchCount` is 0 for safeguarding cases.

### `GET /cases/{reference}`
Coordinator only. Returns `CaseDetail` without `candidates`. `status` is derived on the server from candidate states. It is one of `open`, `possible_match`, `needs_review`, `verification_pending`, `contact_authorized`, `reconnected`, or `safeguarding`.

### `GET /cases/{reference}/matches`
Coordinator only. Returns `CandidateView[]`: authorized potential matches only, already filtered by the rules above. Each candidate carries `evidence: { kind: "agrees" | "differs" | "missing", text }[]`. No numeric score. `contact` is present only once authorized.

### `POST /cases/{reference}/decisions`
Coordinator only. Body is one of:

```json
{ "type": "begin_verification", "registrationReference": "R-2210" }
{ "type": "stop_verification", "registrationReference": "R-2210" }
{ "type": "rule_out", "registrationReference": "R-3412", "reason": "Relationship not confirmed" }
{ "type": "flag_for_review", "reasons": ["possible_duplicate"], "note": "Ask for a middle name." }
{ "type": "clear_review_flag" }
{ "type": "record_contact_made", "registrationReference": "R-2210" }
```

Only one candidate per case may be in verification or beyond at a time. Returns the updated `CaseDetail` with `candidates`.

### `POST /cases/{reference}/matches/{registrationReference}/verification`
Coordinator only. Body:

```json
{ "step": "relationship", "result": "confirmed", "method": "in_person", "note": "Optional" }
```

| `step` | Allowed `result` values |
| --- | --- |
| `relationship` | `confirmed`, `not_confirmed`, `unreachable` |
| `registered_consent` | `agrees`, `declines`, `unreachable` |
| `requester_consent` | `agrees`, `declines`, `unreachable` |

`method` is `in_person`, `phone`, or `caseworker`. Both consent steps return `409 conflict` until the relationship is confirmed. A `declines` result ends contact for that pair permanently and must not change what the requester sees.

### `POST /cases/{reference}/matches/{registrationReference}/contact-coordination`
Coordinator only. Body: `{ "method": "supervised_call" | "relayed_message" | "staffed_meeting" }`. Returns `409 consent_required` with the outstanding items in `message` unless the gate is satisfied. On success the candidate becomes `authorized` and contact details are released to coordinators.

## Swapping the mock for this API

1. Set `VITE_API_MODE=http` and `VITE_API_BASE_URL` in `.env.local`.
2. The deployed app uses the HttpOnly cookie issued by `/api/session`; no browser token is needed.
3. Nothing in components changes. They only import `api` from `src/services`.
4. The reviewer tools disappear automatically in HTTP mode.

The domain types in `src/domain/types.ts` translate directly into tables: `registrations`, `search_requests`, `case_reviews` (one row per request and registration pair), `verification_steps` (append-only), and `case_events` (append-only). Keep matching and redaction (`src/domain/matching.ts`, `src/domain/privacy.ts`) on the server. The browser copies are there for explanation only.

## Implemented demo session layer

`GET /api/session` returns the active server-derived session or 401. `POST /api/session` accepts `{ "role": "volunteer" | "coordinator" }`, creates an isolated fictional workspace on first use, and rotates an HttpOnly cookie when switching roles. Role selection is intentionally open in the demo, not real staff authentication. Sessions last seven days. Cross-origin writes are rejected. All business endpoints require a session and use its workspace. `/api/health` reports SQL availability without exposing records.

The deployed candidate view withholds `shelterName` until contact authorization. Consent withdrawal invalidates active verification/authorization for the affected registration. The deployed storage uses an atomic SQL snapshot rather than the normalized tables originally proposed above; see README for scale limitations. API throttling returns 429 with Retry-After. Creation endpoints return 409 if an idempotency key is reused with a different payload.

Session creation also returns `demoToken`. The frontend keeps it in sessionStorage and sends `X-Findtogether-Session` on all requests including role switches. The cookie is a compatibility fallback, not a requirement. A 401 returns the UI to demo entry instead of leaving authenticated-looking screens active.

`POST /api/session` optionally accepts `shelterId` (lincoln, westside, fairgrounds, riverside) to switch the assigned demo shelter. Omitting it retains the assignment. The server persists and returns the assignment, rotates the demo token, and preserves the workspace. The client clears unsaved forms when switching. Production users would not be allowed to self-assign roles or shelters.
