# ReliefOps Lean MVP Implementation Plan

## Status and purpose

This is the token-efficient implementation and verification copy of `docs/implementation-plan.md`. It served as the IBM Bob build specification while development credits and team time were constrained. The phases are now implemented in the repository; treat the full plan as the post-MVP roadmap and keep its additional scope out while lean MVP verification is pending.

The lean plan removes features that do not materially improve the core demonstration. It does not remove the human-safety rules, AI transparency, chat takeover, or blockchain privacy controls.

### Implementation status (2026-08-26)

The repository contains implementations for Phases 1–6. Implementation status is separate from verification status:

| Area | Current status |
| --- | --- |
| Phase implementation | Phases 1–6 implemented across `src/`, `drizzle/`, `tests/`, and the IBM Bob development log. |
| Offline checks | `pnpm lint`, `pnpm typecheck`, `pnpm test` (123 tests), and `pnpm build` pass. |
| Playwright | `pnpm test:e2e` is present but currently skips all tests when `DATABASE_URL` is unavailable; this is not an end-to-end verification pass. |
| Live integrations | Neon/Auth, local Ollama/Granite, and Stellar Testnet execution remain pending credential and runtime setup. |
| Lean definition of done | Not fully verified yet; skipped Playwright tests and pending live integrations must not be reported as completed verification. |

Do not rewrite phase requirements or add post-MVP scope to make the implementation appear more complete. Update this status only when the corresponding verification evidence exists.

The three-minute video remains outside this plan.

### Required Phase 3 pre-read

Phase 3 is not self-contained. Before delegating or implementing it, both the IBM Bob manager and its assigned worker must read `docs/chatbot-specification.md` in full. The manager must name that file in the worker task, and the worker must confirm it used the file and map the implemented prompt, schema, text-normalization rules, communication-style cues, urgency safeguards, and tests back to its sections. A summary or copied prompt excerpt is not a substitute for reading the contract.

### Scope lock: do not deviate

This document is a scope contract, not a list of suggestions. Implement only the features, routes, tables, integrations, dependencies, and validation needed to satisfy an explicitly listed phase item, gate, safety rule, test, or definition-of-done requirement.

Do not add:

- Nice-to-have features, speculative future requirements, optional integrations, or extra user roles
- Generic frameworks, provider abstractions, background services, queues, caching layers, analytics, notifications, uploads, localization, deployment automation, or design-system work unless this plan explicitly requires them
- New tables, routes, packages, configuration, UI sections, or refactors merely because they might be useful later
- Anything marked removed, deferred, post-MVP, optional later, or excluded
- Unrelated cleanup or changes outside the active phase

Every changed file must be traceable to a requirement in the active phase or its gate. When a necessary implementation detail is unspecified, choose the smallest conventional solution that preserves this architecture and does not add product scope. If the missing decision would change behavior, architecture, dependencies, data ownership, security boundaries, or scope, stop and report it; update this plan and obtain team approval before implementation. Do not silently improvise or substitute a different feature.

## 1. What the MVP must prove

The prototype is successful when one synthetic case demonstrates this flow:

1. A reporter describes a relief need through a web chatbot.
2. Local IBM Granite extracts structured facts and asks for missing information.
3. Granite suggests an urgency level with factors, confidence, rationale, and missing information.
4. A coordinator reviews the explanation and records the final urgency.
5. The coordinator can take over the chat, send a visibly human reply, and later return control to AI.
6. Granite proposes a short task checklist that the coordinator can edit, approve, and update.
7. When the first reporter message starts the conversation, the app immediately anchors a privacy-safe `CHAT_STARTED` commitment on Stellar Testnet and can later verify the recorded start time.

This is enough to demonstrate an AI co-worker, human decision authority, workflow orchestration, and tamper-evident accountability.

## 2. Non-negotiable rules

- Display AI urgency as **AI Suggested Urgency**.
- Display the coordinator decision as **Human Final Urgency**.
- Do not approve tasks until a human final urgency exists.
- AI must never set the final urgency, approve tasks, dispatch aid, or close a case.
- While chat mode is `HUMAN`, public messages are saved without invoking Ollama.
- Create exactly one `CHAT_STARTED` audit record from the first successfully saved reporter message in each conversation session.
- Never put messages, names, contacts, locations, explanations, or task details on Stellar.
- Ollama or Stellar failure must not delete or reject a case.
- Keep every secret server-only and refuse Stellar Mainnet configuration.
- Display that the prototype accepts synthetic data only and is not an emergency service.

## 3. Scope reduction from the full plan

The following items are useful for a later product but redundant for proving this MVP:

| Full-plan feature | Lean decision | Reason |
| --- | --- | --- |
| Reporter, coordinator, responder, and administrator roles | Keep reporter and coordinator only | Two roles prove intake and human oversight without four authorization surfaces. |
| Separate responder portal | Remove | Coordinators can update task status during the demo. |
| Responder ranking and assignment | Remove | An editable task-owner text field is sufficient for the workflow demonstration. |
| Resource inventory and transactional reservations | Remove | Show AI-proposed resource needs as text; do not build an inventory system. |
| Task dependency graph and cycle detection | Replace with ordered flat tasks | A checklist proves AI task organization with much less code and UI. |
| Attachments, private storage, and delivery evidence | Remove | Text-only synthetic intake avoids storage, validation, and privacy work. |
| Reporter delivery confirmation and disputes | Remove | Case and task status are sufficient for the MVP story. |
| Managed realtime subscriptions | Remove | Normal refresh after each action is acceptable in a local demo. |
| Multi-coordinator ownership, transfer, and takeover races | Remove | Use one demonstration coordinator account. |
| AI reply drafts and generated return-to-AI summary | Remove | Explicit takeover and resume controls prove the required behavior. |
| Separate `conversations`, `attachments`, `ai_runs`, `resources`, `allocations`, and audit-batch tables | Remove | Store one conversation per case and keep model metadata with its assessment. |
| watsonx provider adapter | Defer | Ollama and mock providers are the only MVP providers. |
| Merkle batching, timed batches, and a custom Soroban contract | Remove | One immediate session-start commitment through a standard Stellar `Manage Data` operation proves the required accountability claim with much less code. |
| Dozens of on-chain lifecycle events | Anchor only `CHAT_STARTED` | The requirement is evidence that a conversation began, not a blockchain copy of the workflow. |
| Large unit, integration, contract, and browser test matrix | Keep focused tests plus one browser flow | Tests cover the safety boundary without consuming the implementation budget. |

Do not reintroduce deferred features before the lean definition of done passes.

## 4. Included MVP scope

- English, text-only reporter chatbot
- Server-issued anonymous reporter session stored in an `HttpOnly` cookie
- One coordinator authenticated with Neon Auth
- Granite-powered fact extraction, follow-up questions, urgency suggestion, and task proposal
- Deterministic mock AI mode for teammates without Ollama
- Human final urgency with a required override reason when it differs from AI
- Explicit human chat takeover and resume-AI controls
- Editable flat task checklist with `TODO`, `DOING`, and `DONE` states
- Exactly one privacy-safe Stellar Testnet `CHAT_STARTED` anchor per conversation session
- Verification page showing hash match or mismatch
- Responsive local website, focused automated tests, and IBM Bob development log

## 5. Lean architecture

```text
Reporter browser ----+
                     +--> Local Next.js app --> Neon Free Postgres
Coordinator browser -+          |              + Neon Auth for staff
                                |
                                +--> Ollama --> granite4.1:3b
                                |      `--> Mock provider when selected
                                |
                                `--> Stellar SDK --> Stellar Testnet
```

Use one Next.js application. Do not create microservices, a monorepo, a worker process, or a separate backend.

Next.js, Ollama, and the browsers run on the demonstration computer. Neon and Stellar remain managed network services, so the demo requires internet access while keeping database and blockchain workloads out of the computer's RAM budget.

### Technology choices

| Area | Decision |
| --- | --- |
| Runtime | Node.js 22 LTS and pnpm |
| Web | Current security-patched Next.js App Router, React, and TypeScript |
| UI | Tailwind CSS and small accessible local components |
| Validation | Zod for forms, API input, environment variables, and AI output |
| Data | Neon Free Postgres, Drizzle ORM, and Neon Auth for the coordinator; no Storage or Realtime |
| AI | Ollama with `granite4.1:3b`, plus deterministic mock mode |
| Blockchain | `@stellar/stellar-sdk`, Horizon, and Stellar Testnet |
| Tests | Vitest and one Playwright happy-path scenario |

### Application boundaries

- Use Server Components for initial reads.
- Use Server Actions for authenticated coordinator changes.
- Use Route Handlers for reporter chat, Ollama, Stellar submission, and verification.
- Use Client Components only where browser state is required.
- Perform every AI, database-credential, hashing, and Stellar secret-key operation on the server.
- Never allow the browser to connect to Neon directly.
- Authenticate and authorize every mutation independently.

### Minimal repository shape

```text
src/
  app/
    api/
    login/
    ops/
    report/
    verify/
  components/
  features/
    ai/
    audit/
    cases/
    chat/
    tasks/
  lib/
    auth/
    stellar/
    db.ts

drizzle/
  migrations/
  seed.ts

tests/
  e2e/

docs/
  chatbot-specification.md
  implementation-plan.md
  implementation-plan-lean-mvp.md
  bob-development-log.md
```

## 6. Roles and authorization

### Reporter

- Uses no account or signup form.
- Receives a cryptographically random 32-byte session token in an `HttpOnly`, `SameSite=Lax` cookie; set `Secure` outside local HTTP development.
- Stores only `HMAC-SHA-256(REPORTER_SESSION_PEPPER, token)` in Neon, never the raw token.
- Creates and reads only their own case and messages.
- Sends text messages and sees public case status.
- Can request a human or continue with AI.

### Coordinator

- Uses one seeded Neon Auth email/password demonstration account.
- Reads all synthetic cases.
- Records final urgency, controls chat mode, replies to reporters, edits tasks, changes statuses, and can retry or verify the automatic session-start anchor.

### Authorization rules

- Route all database access through server code; do not ship a database client or connection string to the browser.
- Reporter routes derive `HMAC-SHA-256(REPORTER_SESSION_PEPPER, token)` and use a constant-time comparison against the case's stored session-token hash.
- Coordinator routes validate the Neon Auth session and then require a matching `profiles` row with role `COORDINATOR`.
- Check `Origin` on cookie-authenticated mutations and use `SameSite=Lax` cookies to reduce CSRF risk.
- Keep `DATABASE_URL`, migration credentials, Neon Auth secrets, and the reporter-session pepper server-only.
- Include negative tests proving a missing, malformed, or different reporter session cannot read or mutate another reporter's case.

## 7. Minimal states and data model

### States

```text
Case: INTAKE -> REVIEW -> ACTIVE -> CLOSED
Chat: AI -> HUMAN -> AI
Task: TODO -> DOING -> DONE
Audit: PENDING -> ANCHORED | FAILED
```

Guard the following transitions in server code:

- Only a coordinator can set human urgency or move a case beyond `REVIEW`.
- Task approval requires human final urgency.
- Public chat invokes AI only when chat mode is `AI`.
- Case closure requires every approved task to be `DONE`.

### `profiles`

- Neon Auth `user_id`
- `role` with only `COORDINATOR` in the MVP
- `display_name`

### `relief_cases`

- UUID and non-guessable public reference
- HMAC-SHA-256 hash of the reporter session token
- immutable `session_started_at` set from the first reporter message's server receive time
- case status and chat mode
- structured facts JSON
- current human urgency
- assigned coordinator ID
- created and updated timestamps

### `messages`

- case ID
- sender type: `REPORTER`, `AI`, or `COORDINATOR`
- sender user ID when authenticated
- plain-text body with a 2,000-character limit
- optional validated analysis metadata on AI messages containing `communicationSignals` and model/prompt version, but never a corrected copy of reporter text
- timestamp

### `urgency_assessments`

- case ID and source: `AI` or `HUMAN`
- urgency level: `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW`
- factor breakdown JSON
- confidence and missing-information JSON for AI
- rationale
- model/prompt version or human actor ID
- timestamp

Keep rows append-only. The newest human row is authoritative.

### `tasks`

- case ID
- title, optional details, and position
- proposed owner as plain text
- status: `TODO`, `DOING`, or `DONE`
- `approved` boolean

Limit each case to six approved tasks.

### `audit_records`

- case ID and audit ID
- event type fixed to `CHAT_STARTED`
- immutable canonical payload JSON
- random 32-byte nonce
- SHA-256 record hash
- Stellar transaction hash
- status and safe error message
- first-message receive time, Stellar ledger sequence, ledger close time, and anchored timestamp

Enforce a unique constraint on `(case_id, event_type)` so retries cannot create a second start anchor for the same conversation session.

## 8. Local AI behavior

Use one small provider contract:

```ts
interface ReliefAiProvider {
  analyzeIntake(input: IntakeInput): Promise<IntakeAnalysis>
  healthCheck(): Promise<{ ok: boolean; message?: string }>
}
```

The one authoritative `IntakeAnalysis` shape, allowed fact fields, communication signals, urgency factors, validation limits, and prompt behavior are defined in `docs/chatbot-specification.md`. Do not create a competing or reduced schema from a summary in this plan.

When intake is complete, return the urgency analysis and at most six proposed tasks in the same model call.

### Runtime limits

```text
Model: granite4.1:3b
Context: 4096 tokens
Maximum output: 600 tokens
Loaded models: 1
Parallel AI requests: 1
Temperature: 0
```

- Send confirmed facts and only the latest eight messages; do not build a rolling-summary subsystem.
- Validate every response with Zod.
- Permit one JSON repair attempt, then save the case for human review with a safe error state.
- Use a single-concurrency limiter rather than a durable queue.
- Never hold a database transaction open while Ollama runs.
- Implement `MockAiProvider` with the same output schema for predictable development and tests.

## 9. Chat and coordinator experience

### Reporter page: `/report`

1. Display the synthetic-data and not-an-emergency-service warning.
2. When the reporter submits the first message, generate a session token and create the case, first message, and pending `CHAT_STARTED` audit record in one database transaction.
3. Return the raw token only in an `HttpOnly` cookie and show the non-guessable public case reference.
4. After the transaction commits, immediately attempt the Stellar anchor; failure changes only the audit status and never removes the case or message.
5. On later requests, restore access by hashing and verifying the cookie token.
6. Save every later reporter message before calling AI.
7. Display structured responses as plain text; do not render AI-provided HTML.
8. When analysis is ready, mark the case `REVIEW`.
9. Provide **Request a Human** when AI controls the chat.
10. Show whether replies are from ReliefOps AI or a named human coordinator.

### Coordinator pages

```text
/login
/ops
/ops/cases/[id]
```

The queue shows reference, status, AI-suggested urgency, human urgency, and age.

The case page contains four compact sections:

1. Chat and **Take Over** / **Resume AI** controls
2. Confirmed facts, full AI urgency breakdown, and separately labelled **Possible Communication Distress (AI, non-diagnostic)** cues
3. Human final urgency form and override reason
4. Editable task checklist and audit status

Takeover sets chat mode to `HUMAN`. In that mode, the public endpoint saves new messages but does not call Ollama. Resume requires an explicit coordinator click and then uses stored facts plus the latest eight messages as context.

## 10. Lean Stellar audit

### What is anchored

Create exactly one audit record per conversation session. It is created atomically with the first successfully saved reporter message, before AI analysis. Its canonical JSON includes only:

```text
schema_version
audit_id
event_type = CHAT_STARTED
opaque_case_id
opaque_session_id
first_message_received_at_utc
```

Do not include the message body, reporter identity, contact details, location, AI output, urgency, tasks, or secrets. The canonical payload and nonce remain in Neon. Only their commitment is sent to Stellar.

The evidence means: ReliefOps committed to this session-start record no later than the Stellar ledger close time. It does not prove who the reporter was, what they wrote, whether an operator saw the message, or that the application server's clock was perfectly accurate.

### Hashing

1. Serialize the payload with deterministic key ordering.
2. Generate a cryptographically random 32-byte nonce.
3. Compute:

```text
SHA256("reliefops:chat-start:v1" || nonce || canonical_json_utf8)
```

4. Store the payload, nonce, and hex hash in Neon.
5. Submit the raw 32-byte hash through a standard Stellar `Manage Data` operation:

```text
name:  reliefops.chat-start.v1
value: <32 raw hash bytes>
```

Use the same data-entry name for every session so the account holds only the latest value; earlier commitments remain in transaction history. Store each Stellar transaction hash, ledger sequence, and ledger close time with its corresponding off-chain audit record. Idempotent retries must reuse the existing audit record and must stop once it is `ANCHORED`.

This avoids a Rust workspace, contract deployment, contract authorization, TTL handling, time-window batching, and Merkle proofs. It uses one transaction per conversation session, never one transaction per message.

### Verification

`/verify/[auditId]` must:

1. Recompute the salted hash from the stored immutable payload.
2. Fetch the saved transaction and its operation from Stellar Testnet through Horizon.
3. Decode the `Manage Data` value.
4. Compare the recomputed hash, stored hash, and on-chain value.
5. Display the claimed first-message receive time beside the independently returned Stellar ledger close time.
6. Show **Verified** only when all three hashes match; otherwise show **Verification Failed**.

An authorized coordinator or auditor may export the canonical payload and nonce to independently recompute the commitment. The public view must not expose the nonce or link an opaque session to reporter data.

Stellar failure changes the audit to `FAILED` but does not undo case creation, message storage, AI analysis, or later operational decisions. Provide one coordinator retry button. A delayed retry proves the record existed by the later ledger close time; it cannot retroactively prove that the original start time was anchored at that earlier moment.

Use Testnet only, fund the audit account with Friendbot fake XLM, and expect Testnet history to be reset periodically. This makes the prototype network cost zero; any Mainnet deployment requires a separate cost and retention review. Never expose the secret key to the browser or repository.

References:

- [Stellar operations and transactions](https://developers.stellar.org/docs/learn/fundamentals/transactions/operations-and-transactions)
- [Manage Data operation](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/operations/object/manage-data)
- [Stellar networks and Friendbot](https://developers.stellar.org/docs/networks)

## 11. Security minimums

- Synthetic text only; no uploads.
- Zod-validate all untrusted input and AI output.
- Treat reporter messages as data, never as system instructions.
- Escape text output and do not enable raw HTML.
- Enforce the 2,000-character message and six-task limits.
- Use generic client errors and server logs without message bodies or secrets.
- Keep Neon database, Neon Auth, reporter-session, Stellar, and future provider credentials server-only.
- Bind Ollama to localhost and never expose port `11434` publicly.
- Add a startup guard that rejects any Stellar network other than Testnet.

## 12. Environment configuration

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000

DATABASE_URL=
DATABASE_URL_UNPOOLED=
NEON_AUTH_BASE_URL=
NEON_AUTH_COOKIE_SECRET=
REPORTER_SESSION_PEPPER=

AI_PROVIDER=ollama
AI_BASE_URL=http://127.0.0.1:11434/v1
AI_MODEL=granite4.1:3b
AI_CONTEXT_LENGTH=4096
AI_MAX_OUTPUT_TOKENS=600
AI_CONCURRENCY=1

STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
STELLAR_AUDIT_PUBLIC_KEY=
STELLAR_AUDIT_SECRET_KEY=
```

Commit `.env.example` with empty secrets. Ignore `.env.local`. Use `DATABASE_URL` for pooled application traffic and `DATABASE_URL_UNPOOLED` only for migrations or other operations that require a direct connection. Require `NEON_AUTH_COOKIE_SECRET` and `REPORTER_SESSION_PEPPER` to contain at least 32 random bytes, and validate all values at server startup.

## 13. IBM Bob implementation phases

The following roles are IBM Bob development-agent roles. They are unrelated to the ReliefOps reporter and coordinator roles described earlier.

### Required manager-worker model

#### Manager agent

The manager is an orchestration-only agent. It may read the current phase, its required supporting specifications, and worker reports; divide the phase into bounded tasks; delegate those tasks; wait for results; and send targeted follow-up tasks. It must not perform implementation work itself.

The manager must never:

- Create, edit, move, or delete project files
- Write code, schemas, migrations, prompts, tests, or documentation
- Install dependencies or run development, database, test, build, or deployment commands
- Fix a worker's failure, integrate changes itself, or silently expand the phase
- Delegate work that is not directly traceable to the active phase or its gate
- Claim that a phase gate passed without a worker running and reporting every gate command

If implementation, integration, documentation, repair, or verification work is needed, the manager delegates it to a worker subagent.

#### Worker subagents

Worker subagents perform all project work. Every worker receives a concrete task with explicit file or responsibility ownership, acceptance conditions, required validation commands, and a reminder that other workers may also be changing the repository.

Each worker must:

- Inspect and preserve existing work, including changes made by teammates or other subagents
- Edit only its assigned files or responsibility area unless the manager expands its ownership
- Map every file change to an explicit active-phase requirement and remove any unrequired addition before reporting completion
- Implement input validation, error handling, security controls, and tests required by its task
- Run the assigned validation commands and fix failures caused by its work
- Report the exact files changed, commands run, results, remaining risks, and blockers
- Stop after its assigned task; it must not begin the next phase

Only one designated worker may edit shared coordination files such as `package.json`, migration ordering, and `docs/bob-development-log.md` during a phase. Other workers report the information that the designated worker must record.

### Delegation protocol

1. The manager selects exactly one phase and does not delegate later-phase work.
2. To conserve credits, the manager delegates the whole phase to one worker by default. It creates additional workers only for genuinely independent tasks with non-overlapping ownership.
3. Every delegation includes the phase number, exact scope, owned files or responsibility, dependencies, every required supporting specification, prohibited deferred features, the phase gate, and the instruction that no unlisted feature or infrastructure may be added. The worker must read each named supporting specification in full before editing.
4. Workers implement and validate their tasks. If parallel workers were necessary, the manager delegates integration to a designated integration worker; the manager never integrates changes itself.
5. The manager delegates the complete phase gate to a worker. A worker records the commands and results in `docs/bob-development-log.md`.
6. If a gate fails, the manager delegates the exact failure to the responsible worker and then delegates the gate rerun.
7. The manager stops after workers report the phase gate result. A new primary request is required before the next phase.

Each phase is intentionally large enough to delegate once but small enough for a worker to verify independently.

### Phase 1: Foundation

- Scaffold Next.js, TypeScript, Tailwind, ESLint, Vitest, and Playwright.
- Add environment validation, `.env.example`, scripts, shared layout, warning banner, and placeholder routes.
- Create the development log.

Gate: install, lint, typecheck, test, and production build pass.

### Phase 2: Neon data and access

- Add the six tables, constraints, indexes, Drizzle migrations, seed data, and inferred database types.
- Implement hashed reporter-session cookies and Neon Auth coordinator login.
- Add server authorization helpers.

Gate: the seeded coordinator can enter `/ops`, reporter sessions cannot enter it, and a missing or different reporter cookie cannot read or mutate another reporter's case.

### Phase 3: AI and reporter chat

- Before editing, read `docs/chatbot-specification.md` in full and treat it as the exact chatbot behavior and acceptance contract.
- Implement provider contract, mock provider, Ollama provider, Zod output, concurrency limit, and failure fallback.
- Build first-message case creation with one pending `CHAT_STARTED` record, chat, fact updates, analysis-only spelling normalization, deterministic capitalization cues, non-diagnostic possible-distress analysis, urgency suggestion, task proposal, and review transition.

Gate: all synthetic scenarios in `docs/chatbot-specification.md` pass; raw messages remain unchanged; writing style alone cannot set or raise urgency; one mock case and one Ollama case reach `REVIEW`; and an Ollama outage preserves the case.

### Phase 4: Coordinator workflow

- Build case queue and detail page.
- Display communication cues separately from incident facts and urgency factors, using the exact non-diagnostic label and safeguards in `docs/chatbot-specification.md`.
- Implement the human final urgency guard and override reason.
- Implement takeover, human reply, resume AI, task editing, approval, status changes, and closure guard.

Gate: the raw message and separately labelled communication cues are visible without showing a corrected transcript; AI never replies in `HUMAN`; task approval fails without human urgency; and a complete case can close.

### Phase 5: Stellar audit

- Implement deterministic `CHAT_STARTED` canonical JSON, nonce generation, SHA-256 hashing, immediate Testnet `Manage Data` submission, idempotent retry, and verification page.
- Add the Mainnet refusal guard and safe failure state.

Gate: each conversation has exactly one start audit, its transaction appears on Testnet, the page shows both timestamps, unchanged data verifies, changed data fails, and a Stellar outage does not undo domain work.

### Phase 6: Focused completion

- Add focused unit tests, the single Playwright flow, accessible loading/error states, responsive layout, README implementation notes, and final Bob log entries.
- Remove placeholder code and run the complete validation suite.

Gate: lint, typecheck, unit tests, Playwright, and production build pass from a clean checkout.

## 14. Conserving IBM Bob credits

Use one primary request per phase. A suitable request is:

```text
Act only as the manager defined in docs/implementation-plan-lean-mvp.md. For Phase <N>, do not edit files, write code, or run commands yourself. Delegate the complete phase to a worker subagent with explicit ownership and the documented gate. Enforce the plan's scope lock: do not delegate unlisted features, infrastructure, abstractions, refactors, or deferred work. If the worker reports a failure, delegate only the targeted repair and gate rerun. Do not start another phase. Stop after reporting the worker's requirement-to-file mapping, files changed, commands, results, and remaining risks.
```

The delegated worker instruction should be:

```text
Act as the worker subagent for Phase <N> in docs/implementation-plan-lean-mvp.md. You own the complete phase unless the manager states narrower file ownership. Treat the plan as a strict scope contract: implement only requirements explicitly listed for this phase or gate, choose the smallest solution, and add no unlisted feature, infrastructure, abstraction, refactor, package, or deferred work. Preserve existing and concurrent changes, run every phase-gate command, fix failures caused by your work, update docs/bob-development-log.md, report the requirement mapped to every changed file plus exact command results, then stop. If a missing decision would change scope or architecture, report it instead of improvising. Do not begin another phase.
```

Recommended workflow:

1. Use six manager requests, one for each phase; each manager delegates to one worker by default.
2. Do not ask Bob to recreate the plan or explain every file before implementing.
3. When a worker reports a failure, the manager relays the exact failing command and error in a targeted follow-up delegation to that worker.
4. Require the delegated worker to run all related checks within the same implementation task.
5. Review the diff locally between phases so design corrections happen early.
6. Reserve most of the 40-credit allowance for actual failures and integration fixes.

This plan targets six manager requests and one default worker delegation per phase, but actual Bob credit consumption can vary. Avoid unnecessary planning, research, or review subagents because this plan already defines the work.

## 15. Focused test plan

### Unit tests

- AI output validation and fallback
- Human urgency requirement and override reason
- No AI call while chat mode is `HUMAN`
- Task limit and closure guard
- `CHAT_STARTED` canonical JSON and salted-hash stability
- On-chain payload contains only the hash
- Verification mismatch after payload modification
- Duplicate submissions cannot create a second start audit for one session

### Integration tests

- Reporter cookie validation and case isolation
- Coordinator authorization
- Reporter message saved before an AI failure
- Append-only AI and human assessments
- Failed Stellar submission leaves operational data committed

### One Playwright scenario

First reporter message -> immediate session-start anchor -> AI analysis -> coordinator final urgency -> human takeover and reply -> resume AI -> task approval and completion -> successful start-record verification.

Use unit or integration tests for failure branches instead of creating more browser scenarios.

## 16. Lean definition of done

The lean MVP is complete only when:

- The seven-step demonstration in section 1 works with synthetic data.
- Human authority and chat takeover rules are enforced in server code.
- The application runs locally with `granite4.1:3b` under the README memory settings.
- The mock provider supports development without Ollama.
- Exactly one `CHAT_STARTED` record per conversation is verifiably anchored on Stellar Testnet without exposing sensitive content.
- Lint, typecheck, focused tests, Playwright, and production build pass.
- The repository contains no secrets or real personal information.
- The IBM Bob log truthfully records Bob's implementation work.
- No deferred feature has been added before this definition of done passes.
- Every implementation change is traceable to an explicit lean-plan requirement; no unapproved feature or infrastructure remains.
