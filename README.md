# FindTogether

**A consent-first family reunification app for the DALI Fullstack Challenge 26F.**

**[Open the live demo](https://findtogether-haaris.quietyak18.chatgpt.site)**

## Overview

After an evacuation, finding someone is only half the problem. The other half is making sure they want to be found—and that the person searching is someone they actually want to contact.

FindTogether focuses on the shelter desk. A volunteer can register a displaced person, record a search for a family member, and print a reference slip. A coordinator can review possible matches, confirm a relationship, record both people's agreement, and arrange contact.

The app does not automatically reunite people or publish a directory of evacuees. It helps staff decide what to do next.

**Demo note:** All starting records are fictional. Anyone can try either staff role in their own isolated demo workspace. This role selector is for evaluation, not production staff authentication. Please do not enter real personal information.

### Screenshots

These screenshots are from the original frontend prototype. The deployed app retains its design and adds a session selector, a demo entry screen, and location withholding before contact authorization.

![Volunteer dashboard](docs/screenshots/dashboard.png)
![Reviewing ambiguous matches](docs/screenshots/ambiguous.png)
![Relationship and consent verification](docs/screenshots/verification.png)

## Try the demo

1. Choose **Coordinator**, open **Cases**, and select **S-1041**. Someone searching for “Mari Ortiz” has a possible match registered as “Marisol Reyes.” Review the evidence; a name match alone is not verification.
2. Start verification. Record the relationship as confirmed, then record both people's agreement. Select a contact method and authorize contact. Only then are the candidate's shelter and contact details released. These buttons record staff actions; they do not place a call or independently verify anyone.
3. Open **S-1042** to see multiple plausible Joe/José matches. Staff can rule out candidates or flag the case for further review.
4. Open **S-1043** to see a child's case routed out of the ordinary matching workflow.
5. Switch to **Volunteer**, register a fictional person, and create a search request. Refresh the page to check that saved records persist.
6. Search for **Ana Ruiz**. Her protected registration does not appear as a match. A requester receives no indication that a protected record exists.

Role changes retain the current workspace. The demo token is kept in the browser tab; refresh preserves it, but closing the tab can end access. A cookie may also retain access where supported. An unrelated browser starts a separate workspace. Sessions expire after seven days; expired data is cleaned when a subsequent session is created.

## The full picture

### What I chose to build, and why

I chose the workflow from **shelter intake to staff-mediated contact**. It addresses people who have no phone, no ID, or incomplete information, while keeping a person involved in decisions that software should not make alone.

The implemented workflow includes:

- Registration with a name, nickname, or description, plus explicit consent choices.
- Family search requests and printable reference slips.
- Explainable possible matches, duplicate hints, and human review.
- Relationship verification and separate contact agreements from both people.
- Contact authorization, contact-made status, and case history.
- A real HTTP backend, persistent SQL storage, and server-enforced access rules.

### Where it fits in a larger response

A real response would connect vetted staff across shelters and participating agencies to a shared incident database. Hotels and relatives' homes could be represented through agency contact points, without publishing private addresses.

Paper intake would remain available during outages. Staff would later enter those forms, reconcile duplicates, and update transfers between shelters. Safeguarding specialists would handle children and other cases requiring additional protection. Interpreters and accessible intake options would help people who cannot use the standard process.

Those operational pieces are not built here. In particular, the safeguarding status does **not** send a referral to an actual agency, and the app does **not** automatically contact family members.

## Design

### Who uses it

| User | What they need | Design response |
| --- | --- | --- |
| Displaced person | Help without a phone, ID, or willingness to share a legal name | Staff-assisted registration, optional identity details, consent choices, printed reference |
| Shelter volunteer | A clear next step while handling a long queue | Focused intake/search forms, validation, receipts, simple request status |
| Reunification coordinator | Enough evidence to review a possible match safely | Evidence comparisons, review flags, verification steps, controlled contact release |

### Edge cases and assumptions

| Situation | Implemented behavior or limitation |
| --- | --- |
| Someone does not want to be found | Safety concerns override consent. Protected records are excluded before matching. |
| Consent is missing | Unknown matching consent does not permit discovery. |
| A child is involved | Child registrations do not enter ordinary matching; child searches route to safeguarding. Unknown age still requires staff judgment. |
| Names differ or information is incomplete | Normalization, nickname rules, approximate ages, and visible evidence support review. No automatic identity decision is made. Description-only registration is supported, but automatic discovery from descriptions is not. |
| Someone claims a relationship | Staff must record confirmation before either contact-consent step. The software records the process; it cannot establish the truth of the claim. |
| Contact is declined or permission withdrawn | A declined pair cannot restart verification. Withdrawing consent invalidates active authorizations. Previously viewed information cannot be made unseen. |
| A requester checks progress | The response shows only active or contact arranged, without revealing matches, locations, protection flags, or refusal. |
| Connection fails | Unsaved form contents remain in memory while the page stays open. There is no offline synchronization; paper intake is the proposed fallback. |
| A submission is retried | A submission key returns the original receipt. Reusing it with different data is rejected. |
| Two updates happen together | A database revision check prevents one update silently overwriting the other. |

A reference slip identifies a request; it is not proof of identity. Volunteers are assigned to one shelter at a time. The Demo shelter selector lets reviewers switch that assignment among the four fictional locations; switching clears unsaved forms. Volunteer intake fields use the assigned shelter, while coordinators can select any shelter in each form. A person has one current shelter per registration, not multiple simultaneous locations. The deployment is a prototype, not a system validated for real disaster response.

## Technical choices

| Part | Choice | Why |
| --- | --- | --- |
| Frontend | React, TypeScript, Tailwind, React Router | Preserve the supplied interface and keep forms, components, and data access separate |
| Backend | TypeScript HTTP endpoints served through Vinext on a Cloudflare Worker | Serve the frontend and API from one origin using the available deployment environment |
| Database | Cloudflare D1, a SQLite-based SQL database | Persist records across page reloads and server requests |
| Schema and input checks | Drizzle migrations and Zod validation | Version the database structure and validate requests on the server |
| Matching | Explainable name and age rules | Give staff inspectable evidence rather than an unexplained identity score |

The browser calls `/api/*`. The server loads records, checks the session's role, runs matching, enforces consent, and returns only the permitted view. Hiding a field in the UI is not the privacy boundary.

An opaque demo token is sent in `X-Findtogether-Session` and stored in sessionStorage, with an in-memory fallback. This avoids relying on cookies in embedded browsers. Tokens are hashed in the database, expire, and rotate on role changes. The token is JavaScript-accessible, so this is a demo workspace mechanism, not production staff authentication. Production would require vetted accounts and real shelter assignments.

API responses are not cached. Writes check origin, and SQL-backed rate limits apply per session and hashed IP address. These measures do not constitute a complete security audit or a guarantee against timing side channels.

### Biggest tradeoff

Each small demo workspace is stored as a JSON snapshot inside a SQL row. Sessions and rate limits have separate tables. This makes a complete workflow update atomic and keeps the implementation manageable, but every update rewrites the snapshot and matching scans the records.

**This storage design is not intended for a region of 400,000 people.** The demo allows roughly 500 records per workspace. At operational scale, I would separate registrations, searches, pair reviews, verification steps, and audit events into indexed tables, then introduce an asynchronous matching pipeline. Case history here is append-only through the app, not a tamper-evident audit system.

## Running locally

Use **Node 24** and **pnpm**. From the project directory:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
```

After the first build, initialize the local database:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_rare_bug.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_tiresome_loa.sql
pnpm dev
```

Apply each migration only once to each database. Local and hosted databases are separate. The hosted deployment uses the checked-in hosting configuration and migration files; managed publishing applies the hosted migrations and deploys the Worker and frontend assets.

### Important files

- `src/screens/`, `src/components/`: interface and forms.
- `src/services/http/`: frontend API client.
- `src/domain/`: matching and consent rules.
- `server/engine.ts`: server-side case workflow.
- `server/handler.ts`: HTTP routing, sessions, access checks, and database updates.
- `server/validation.ts`: request schemas.
- `db/schema.ts`, `drizzle/`: SQL schema and migrations.
- `docs/API.md`: endpoint contract and integration notes.
- `src/services/mock/`: original mock implementation and tests, retained for comparison; not the deployed data source.

## Testing and verification

Automated tests cover matching, privacy, form validation, server-side roles, invalid inputs, persistent writes, workspace isolation, concurrent writes, retry deduplication, contact gating, consent withdrawal, and children's cases.

Backend integration tests execute the generated migrations against real SQLite through a small D1 adapter. A regression test uses the real HTTP client without cookies to check navigation requests, registration, role switching, and session expiry. TypeScript and production-build checks passed during implementation.

Deployment has succeeded. Automated browser verification of the hosted app was unavailable in the development environment, so manual browser testing remains part of the submission check. The app has not been load-tested at disaster scale or tested with actual response staff.

## AI process

I split the work between Claude for the initial frontend and ChatGPT for backend integration and deployment.

- **Claude:** frontend screens, forms, domain rules, mock API, initial tests, API contract, and prototype screenshots.
- **ChatGPT:** server workflow, persistent API and database integration, demo sessions, backend validation, regression tests, deployment, and this README.
- **Review changes:** withheld candidate shelter locations until contact authorization and invalidated authorizations when consent is withdrawn.
- **Debugging:** after I reported repeated session errors in the hosted app, ChatGPT replaced the cookie-only dependency with an explicit demo token and added a cookie-free regression test.
- **Stack adjustment:** the initial plan used Express/PostgreSQL; the implementation uses a Worker and D1 to fit the available hosting environment while retaining the React frontend.

The central product decision was to prioritize a small, consent-based staff workflow and explain the missing operational pieces, rather than claim to solve the entire reunification system.

## Vercel frontend deployment

The repository also supports a Vercel frontend while the existing Cloudflare/D1 backend remains hosted at the original live URL above. `vercel.json` selects the separate Vite build (`npm run build:frontend`) and `dist-frontend` output. The original `npm run build` remains the backend's Vinext build.

Import `haaris-usman-saeed/findtogether` into Vercel, use the repository root, and choose Node.js 24.x. Keep the build settings supplied by `vercel.json`. No database credentials or frontend environment variables are needed. Once deployed, use the actual Vercel production URL as the submission link; a Vercel URL has not yet been verified here.

Browser requests stay on `/api` on the Vercel domain. A small Node function (`api/proxy.ts`) forwards requests to the fixed backend, preserving session tokens, idempotency keys, status codes, and JSON bodies. It checks the incoming origin before setting the upstream origin, does not forward browser cookies, and disables API caching. Client-side page URLs fall back to `index.html` so refreshes work.

The database is not migrated or copied. Existing demo sessions on the original domain do not transfer automatically because session storage is scoped to each domain; choose a demo role again on Vercel. The backend must remain published. This split adds a network hop and the backend's IP rate limit may be shared by visitors using a Vercel egress address; it is suitable for the evaluation demo, not regional emergency traffic.

After deployment, open the production URL in a private browser window, choose each demo role, change shelters, register a fictional person, refresh a nested page, and confirm the record persists. Check `/api/health` returns `{"ok":true,"storage":"sql"}`. Local tests validate proxy behavior and the production frontend build, but do not establish connectivity from Vercel to the live backend.

AI process note: Codex prepared this separate frontend build and API proxy, keeping Claude's interface and the existing database backend.
