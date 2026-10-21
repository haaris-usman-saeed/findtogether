# FindTogether

A privacy-first family reunification tool for shelter volunteers after a disaster, built as the frontend for DALI Lab's Fullstack Challenge 26F.

> **Demonstration only.** Every person, shelter, and phone number is fictional. Identity verification and authorization are simulated in the browser. This is not an emergency response system.

![Dashboard](docs/screenshots/dashboard.png)

## Overview

A hurricane has displaced about 400,000 people. Many have no phone, no ID, and only a nickname for the relative they're looking for. Some people must not be found. FindTogether helps shelter volunteers record incomplete information. It helps coordinators review possible family connections, and arrange contact only when both people agree.

The core journey: **register an evacuee, record a family search, review possible matches, coordinate authorized contact.**

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest: matching, privacy filtering, contact gate, validation, failure handling
npm run build      # Type check, then production build
```

Use **Reviewer tools** in the bottom-right corner to load a scenario, switch between the volunteer and coordinator roles, or simulate slow, failing, or offline networks. That panel is demo-only and is not rendered in HTTP mode.

| Scenario | What it shows |
| --- | --- |
| 1. Successful reunification | Daniel searches for "Mari Ortiz." She registered elsewhere as Marisol Reyes. Walk the case from possible match through verification to contact made. Trying to authorize early stays blocked. |
| 2. Ambiguous identity | Three plausible records for "Joe" or "José" Martinez, two of which may be one man registered twice. The right move is to send the case for review, not pick one. |
| 3. Protected individual | Ana Ruiz asked not to be found. Victor's search gets exactly the response a search for an unregistered person gets. The reviewer panel shows both payloads side by side. |

To watch a match form live, search for "Robert Tran." He is registered as Bobby.

## Product reasoning

The hard part isn't finding matches. It's finding them without ever revealing someone who doesn't want to be found. So I built one workflow end to end and spent most of the effort on the moment of truth: a coordinator looking at a possible match and deciding what to do.

Three principles drive the decisions:

1. **Accessibility over assumptions.** Required to register: a name or alias (or a description if they won't give one), an age guess, and their answers about search and contact. No ID, phone, or legal name.
2. **Simplicity under pressure.** Two big actions on the home screen. Optional fields stay closed. Errors say exactly how to fix them.
3. **Safety before disclosure.** A match is evidence, not permission. Nothing about either person is shared until the relationship is confirmed and both agree.

## Design decisions

**For volunteers at 2 a.m.**
- The home screen answers "what can I do now": register, search, and a short list of people who haven't been asked about family search yet.
- Required fields come first and optional sections are collapsed. The minimum registration is five answers: name, age, and three questions.
- Errors appear in a summary at the top and next to each field. Each summary item links to its field.
- After saving, the person gets a printable reference slip, because many have no phone.
- "What to tell them" gives volunteers a script for the hardest sentence: no news doesn't mean anything.

**For coordinators**
- Each possible match has a three-column evidence ledger: *Agrees*, *Differs*, and *Not recorded*. It uses plain sentences like "Mari is often short for Marisol." There is no confidence score, because these records can't support one.
- Verification is four ordered steps. Each one records an outcome, how it was reached, and who recorded it. There is no "verified" checkbox to tick.
- The authorize button lists what is still missing. The mock server enforces the same rule independently.
- Ambiguity has a dedicated exit, "Send for additional review," which records what information would settle it.

**Visual system**
- **Type:** Public Sans, the typeface designed for US government services, bundled locally rather than loaded from a CDN, since shelters have unreliable internet. It is a 16 px base on a small scale, with tabular figures for reference numbers.
- **Color:** a warm neutral page (`#F3F2EE`), white for working surfaces, and one deep teal accent (`#1D5568`) for primary actions. Amber, green, red, and violet appear only as status colors, always alongside an icon and a label.
- **Structure:** borders instead of shadows, small radii, and a left-aligned single column for forms.
- **Focus:** one 3 px dark outline everywhere.
- **Motion:** only spinners and a disclosure chevron, both disabled under reduced motion.

## Privacy model

The rules in `src/domain/privacy.ts` and `src/domain/authorization.ts` are the heart of the product:

- **Discoverable means an explicit yes.** "Couldn't ask yet" is stored as `unknown`, and `unknown` is treated exactly like `declined`.
- **Protected records are removed before matching**, so coordinators never see them either.
- **The person searching can learn exactly two things:** the request is open, or contact is being arranged. No match, protected, declined, and still reviewing all produce the same response. A test asserts this.
- **Children never enter ordinary matching.** A search for a child, or for "my child" with no age, goes to safeguarding. A stated parental relationship is never enough.
- **Contact details stay hidden from staff views** until contact is authorized.
- **Volunteers see counts, not case progress.** Their activity feed shows no case progress, and duplicate warnings are coordinator-only, because either would let someone at a desk probe whether a person is registered.
- **Mistakes and probes get the same error:** a reference that doesn't exist, belongs to another shelter, or is protected.

## Edge cases considered

- No name at all (described instead)
- Nicknames, misspellings, missing accents, and initials
- Unknown or approximate ages
- Registered under a different family name
- The requester's own registration showing up as a match (excluded)
- Two records for one person
- Several plausible candidates
- No candidates
- Someone declining partway through verification
- A requester changing their mind
- A child arriving with an unverified adult
- Slow, failing, and offline networks
- A retry after a timeout (idempotency keys prevent duplicates)
- Double-clicking submit
- Losing typed work to a failed request (it is kept in memory)

## Technical architecture

React 19, TypeScript, Vite, Tailwind CSS 3, React Router 7, and Lucide icons. There are no other runtime dependencies.

```
src/
  domain/      Types, matching, privacy rules, the contact gate, status. Pure functions, unit tested.
  forms/       Drafts, validation, conversion to API inputs.
  services/
    contracts.ts   The API interface, role-specific view types, ApiError.
    mock/          In-memory backend that behaves like a server.
    http/          fetch client for the same interface (see docs/API.md).
    connection.ts  Connection health derived from real request outcomes.
  state/       Session, in-memory drafts, async hooks, shelters.
  components/  UI kit and shared inputs.
  features/    Registration, search, and case review pieces.
  pages/       One file per route.
  demo/        Reviewer tools and scenarios. Nothing in the product imports this.
```

Components only call `api` from `src/services`. Case status is derived from candidate states and never stored, so it can't drift. Nothing is written to localStorage, sessionStorage, or IndexedDB. A reload clears all data and drafts.

See [docs/API.md](docs/API.md) for endpoints, request and response shapes, errors, the server rules, and how to switch from the mock to HTTP.

## Tradeoffs

- **No offline mode.** Doing it honestly means encrypted local storage, sync, and conflict resolution on a shared laptop. The app says plainly that it doesn't work offline, rather than implying it does.
- **No real authentication.** The role switch is simulated. The mock refuses coordinator data to volunteers, but only a server can make that real.
- **Simple matching.** A small nickname table and Jaro-Winkler string similarity. That's enough to demonstrate honest uncertainty, but not production-grade multilingual name matching.
- **Safeguarding is a referral, not a workflow.** It's real enough to show the routing, and deliberately out of scope beyond that.
- **One coordinator role.** Production would separate safeguarding leads, records staff, and senior reviewers.
- **Tailwind 3, not 4.** The build and visual checks were done against Tailwind 3.4.

## Limitations

- Verification steps record what a coordinator says happened. They don't verify anything.
- Matching and redaction run in the browser against mock data. The real backend must run them server-side, and should consider timing side channels on the status endpoint.
- Retention, data deletion, audit review, and staff vetting are operational decisions this demo doesn't make.
- Screenshots in `docs/screenshots` were rendered with a system fallback font, because Public Sans couldn't load in the offline build environment.

## Verification performed

What was actually run, and where:

- **Type check:** `tsc` with TypeScript 6.0.3 under strict settings passed with no errors. React, React Router, Lucide, and Vite types were stand-ins written for an offline sandbox. Run `npm run build` to confirm against the real packages.
- **Tests:** 39 tests across 5 files passed, run with a minimal Vitest-compatible runner. Breaking the privacy rules on purpose made the relevant tests fail, so the tests do check something. Run `npm test` to confirm under real Vitest.
- **Browser:**
  - Bundled with esbuild and Tailwind 3.4, then driven in headless Chromium.
  - Covered all three scenarios end to end, failed saves (input kept, success never claimed, retry), the offline banner, and the volunteer being refused case data.
  - A registration was completed using only the keyboard.
  - Checked that nothing overflows at 390, 820, and 1280 px wide, and that every control is at least 44 px tall on mobile.
- **Not run:** `vite build` itself, real Vitest, and a screen reader.

## AI-assisted development

> **Complete this section yourself before submitting. It must be accurate.**

- **What AI did:** The frontend code, tests, and documentation were generated by Claude (Anthropic) from a detailed specification I wrote. That includes the domain model, matching, privacy rules, UI, mock backend, and verification harness.
- **What I reviewed or changed:** *Describe what you read, tested, rewrote, or decided differently, and why.*
- **What I'd do differently or still doubt:** *Your honest assessment.*
