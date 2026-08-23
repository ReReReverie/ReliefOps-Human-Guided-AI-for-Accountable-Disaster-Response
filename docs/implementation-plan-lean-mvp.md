# ReliefOps Lean MVP Implementation Plan

## Status and purpose

This is the token-efficient implementation copy of `docs/implementation-plan.md`. Use this plan as the IBM Bob build specification while development credits and team time are constrained. Keep the original plan unchanged as the post-MVP roadmap.

The lean plan removes features that do not materially improve the core demonstration. It does not remove the human-safety rules, AI transparency, chat takeover, or blockchain privacy controls.

The three-minute video remains outside this plan.

## 1. What the MVP must prove

The prototype is successful when one synthetic case demonstrates this flow:

1. A reporter describes a relief need through a web chatbot.
2. Local IBM Granite extracts structured facts and asks for missing information.
3. Granite suggests an urgency level with factors, confidence, rationale, and missing information.
4. A coordinator reviews the explanation and records the final urgency.
5. The coordinator can take over the chat, send a visibly human reply, and later return control to AI.
6. Granite proposes a short task checklist that the coordinator can edit, approve, and update.
7. The app creates a privacy-safe audit record, anchors its salted hash on Stellar Testnet, and verifies that changed data no longer matches.

This is enough to demonstrate an AI co-worker, human decision authority, workflow orchestration, and tamper-evident accountability.

## 2. Non-negotiable rules

- Display AI urgency as **AI Suggested Urgency**.
- Display the coordinator decision as **Human Final Urgency**.
- Do not approve tasks until a human final urgency exists.
- AI must never set the final urgency, approve tasks, dispatch aid, or close a case.
- While chat mode is `HUMAN`, public messages are saved without invoking Ollama.
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
| Supabase Realtime | Remove | Normal refresh after each action is acceptable in a local demo. |
| Multi-coordinator ownership, transfer, and takeover races | Remove | Use one demonstration coordinator account. |
| AI reply drafts and generated return-to-AI summary | Remove | Explicit takeover and resume controls prove the required behavior. |
| Separate `conversations`, `attachments`, `ai_runs`, `resources`, `allocations`, and audit-batch tables | Remove | Store one conversation per case and keep model metadata with its assessment. |
| watsonx provider adapter | Defer | Ollama and mock providers are the only MVP providers. |
| Merkle batching | Defer | One salted hash per approved case snapshot is easier to explain and verify. |
| Custom Soroban contract and Rust workspace | Remove | A standard Stellar `Manage Data` operation can anchor a 32-byte hash without contract code. |
| Dozens of audited lifecycle events | Anchor one approved decision snapshot | One end-to-end proof demonstrates accountability without an event-sourcing system. |
| Large unit, integration, contract, and browser test matrix | Keep focused tests plus one browser flow | Tests cover the safety boundary without consuming the implementation budget. |

Do not reintroduce deferred features before the lean definition of done passes.

## 4. Included MVP scope

- English, text-only reporter chatbot
- Supabase anonymous reporter session
- One authenticated coordinator role
- Granite-powered fact extraction, follow-up questions, urgency suggestion, and task proposal
- Deterministic mock AI mode for teammates without Ollama
- Human final urgency with a required override reason when it differs from AI
- Explicit human chat takeover and resume-AI controls
- Editable flat task checklist with `TODO`, `DOING`, and `DONE` states
- One privacy-safe Stellar Testnet audit anchor per approved decision snapshot
- Verification page showing hash match or mismatch
- Responsive local website, focused automated tests, and IBM Bob development log

## 5. Lean architecture

```text
Reporter browser ----+
                     +--> Local Next.js app --> Supabase Free
Coordinator browser -+          |              Auth + Postgres
                                |
                                +--> Ollama --> granite4.1:3b
                                |      `--> Mock provider when selected
                                |
                                `--> Stellar SDK --> Stellar Testnet
```

Use one Next.js application. Do not create microservices, a monorepo, a worker process, or a separate backend.

### Technology choices

| Area | Decision |
| --- | --- |
| Runtime | Node.js 22 LTS and pnpm |
| Web | Current security-patched Next.js App Router, React, and TypeScript |
| UI | Tailwind CSS and small accessible local components |
| Validation | Zod for forms, API input, environment variables, and AI output |
| Data | Supabase Free Postgres and Auth; no Storage or Realtime |
| AI | Ollama with `granite4.1:3b`, plus deterministic mock mode |
| Blockchain | `@stellar/stellar-sdk`, Horizon, and Stellar Testnet |
| Tests | Vitest and one Playwright happy-path scenario |

### Application boundaries

- Use Server Components for initial reads.
- Use Server Actions for authenticated coordinator changes.
- Use Route Handlers for reporter chat, Ollama, Stellar submission, and verification.
- Use Client Components only where browser state is required.
- Perform every AI, database service-key, hashing, and Stellar secret-key operation on the server.
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
    supabase/

supabase/
  migrations/
  seed.sql

tests/
  e2e/

docs/
  implementation-plan.md
  implementation-plan-lean-mvp.md
  bob-development-log.md
```

## 6. Roles and authorization

### Reporter

- Uses Supabase anonymous authentication with no signup form.
- Creates and reads only their own case and messages.
- Sends text messages and sees public case status.
- Can request a human or continue with AI.

### Coordinator

- Uses one seeded email/password demonstration account.
- Reads all synthetic cases.
- Records final urgency, controls chat mode, replies to reporters, edits tasks, changes statuses, and anchors an audit record.

### Authorization rules

- Enable RLS on every public-schema table.
- Reporter policies compare `reporter_id` with `auth.uid()`.
- Coordinator policies require a matching `profiles` row with role `COORDINATOR`.
- Keep `SUPABASE_SERVICE_ROLE_KEY` on the server and use it only where AI or Stellar background work requires it.
- Include at least one negative test proving one anonymous reporter cannot read another reporter's case.

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

- `user_id`
- `role` with only `COORDINATOR` in the MVP
- `display_name`

### `relief_cases`

- UUID and non-guessable public reference
- `reporter_id`
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
- immutable canonical payload JSON
- random 32-byte nonce
- SHA-256 record hash
- Stellar transaction hash
- status and safe error message
- created and anchored timestamps

## 8. Local AI behavior

Use one small provider contract:

```ts
interface ReliefAiProvider {
  analyzeIntake(input: IntakeInput): Promise<IntakeAnalysis>
  healthCheck(): Promise<{ ok: boolean; message?: string }>
}
```

The validated output is:

```ts
type IntakeAnalysis = {
  assistantMessage: string
  factsPatch: Record<string, unknown>
  missingFields: string[]
  readyForHumanReview: boolean
  urgency?: {
    suggestedLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
    confidence: number
    factors: Array<{
      name: string
      severity: 'HIGH' | 'MEDIUM' | 'LOW'
      explanation: string
    }>
    missingInformation: string[]
    rationale: string
  }
  proposedTasks?: Array<{
    title: string
    details?: string
    proposedOwner?: string
  }>
}
```

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
2. Start or restore the anonymous session.
3. Create one case and show its public reference.
4. Save each reporter message before calling AI.
5. Display structured responses as plain text; do not render AI-provided HTML.
6. When analysis is ready, mark the case `REVIEW`.
7. Provide **Request a Human** when AI controls the chat.
8. Show whether replies are from ReliefOps AI or a named human coordinator.

### Coordinator pages

```text
/login
/ops
/ops/cases/[id]
```

The queue shows reference, status, AI-suggested urgency, human urgency, and age.

The case page contains four compact sections:

1. Chat and **Take Over** / **Resume AI** controls
2. Confirmed facts and full AI urgency breakdown
3. Human final urgency form and override reason
4. Editable task checklist and audit status

Takeover sets chat mode to `HUMAN`. In that mode, the public endpoint saves new messages but does not call Ollama. Resume requires an explicit coordinator click and then uses stored facts plus the latest eight messages as context.

## 10. Lean Stellar audit

### What is anchored

Create one audit record after the coordinator has set final urgency and approved the task checklist. Its canonical JSON includes only:

```text
schema_version
audit_id
opaque_case_id
ai_suggested_urgency
ai_factor_summary
human_final_urgency
human_override_reason_if_any
approved_task_titles
approver_opaque_id
approved_at
```

Do not include reporter messages, names, contacts, exact locations, or secrets.

### Hashing

1. Serialize the payload with deterministic key ordering.
2. Generate a cryptographically random 32-byte nonce.
3. Compute:

```text
SHA256("reliefops:audit:v1" || nonce || canonical_json_utf8)
```

4. Store the payload, nonce, and hex hash in Supabase.
5. Submit the raw 32-byte hash through a standard Stellar `Manage Data` operation:

```text
name:  reliefops.audit.v1
value: <32 raw hash bytes>
```

Use the same data-entry name for every audit so the account holds only the latest value; previous values remain visible in transaction history. Store each Stellar transaction hash with its corresponding off-chain audit record.

This avoids a Rust workspace, contract deployment, contract authorization, TTL handling, batching, and Merkle proofs. A production version can later batch many hashes into a Merkle root.

### Verification

`/verify/[auditId]` must:

1. Recompute the salted hash from the stored immutable payload.
2. Fetch the saved transaction and its operation from Stellar Testnet through Horizon.
3. Decode the `Manage Data` value.
4. Compare the recomputed hash, stored hash, and on-chain value.
5. Show **Verified** only when all three match; otherwise show **Verification Failed**.

Stellar failure changes the audit to `FAILED` but does not undo urgency or task decisions. Provide one coordinator retry button.

Use Testnet only, fund the audit account with Friendbot fake XLM, and expect Testnet history to be reset periodically. Never expose the secret key to the browser or repository.

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
- Keep Supabase service, Stellar secret, and future provider credentials server-only.
- Bind Ollama to localhost and never expose port `11434` publicly.
- Add a startup guard that rejects any Stellar network other than Testnet.

## 12. Environment configuration

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=

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

Commit `.env.example` with empty secrets. Ignore `.env.local`. Validate values at server startup.

## 13. IBM Bob implementation phases

Each phase is intentionally large enough to request once but small enough to verify independently. Bob must implement only the named phase, run its gate, update `docs/bob-development-log.md`, and stop.

### Phase 1: Foundation

- Scaffold Next.js, TypeScript, Tailwind, ESLint, Vitest, and Playwright.
- Add environment validation, `.env.example`, scripts, shared layout, warning banner, and placeholder routes.
- Create the development log.

Gate: install, lint, typecheck, test, and production build pass.

### Phase 2: Supabase data and access

- Add the six tables, constraints, indexes, RLS policies, seed data, and generated database types.
- Implement anonymous reporter auth and coordinator login.
- Add server authorization helpers.

Gate: the seeded coordinator can enter `/ops`, anonymous users cannot, and a reporter cannot read another reporter's case.

### Phase 3: AI and reporter chat

- Implement provider contract, mock provider, Ollama provider, Zod output, concurrency limit, and failure fallback.
- Build case creation, chat, fact updates, urgency suggestion, task proposal, and review transition.

Gate: one mock case and one Ollama case reach `REVIEW`; Ollama outage preserves the case.

### Phase 4: Coordinator workflow

- Build case queue and detail page.
- Implement the human final urgency guard and override reason.
- Implement takeover, human reply, resume AI, task editing, approval, status changes, and closure guard.

Gate: AI never replies in `HUMAN`, task approval fails without human urgency, and a complete case can close.

### Phase 5: Stellar audit

- Implement deterministic canonical JSON, nonce generation, SHA-256 hashing, Testnet `Manage Data` submission, retry, and verification page.
- Add the Mainnet refusal guard and safe failure state.

Gate: the transaction appears on Testnet, unchanged data verifies, changed data fails, and a Stellar outage does not undo domain work.

### Phase 6: Focused completion

- Add focused unit tests, the single Playwright flow, accessible loading/error states, responsive layout, README implementation notes, and final Bob log entries.
- Remove placeholder code and run the complete validation suite.

Gate: lint, typecheck, unit tests, Playwright, and production build pass from a clean checkout.

## 14. Conserving IBM Bob credits

Use one primary request per phase. A suitable request is:

```text
Read docs/implementation-plan-lean-mvp.md. Implement Phase <N> only. Do not add anything listed as deferred. Run the phase gate, fix failures you caused, update docs/bob-development-log.md with the files changed and commands/results, then stop.
```

Recommended workflow:

1. Use six primary requests, one for each phase.
2. Do not ask Bob to recreate the plan or explain every file before implementing.
3. Before a repair request, provide the exact failing command and error; ask it to fix only that failure.
4. Ask Bob to run all related checks within the same implementation request.
5. Review the diff locally between phases so design corrections happen early.
6. Reserve most of the 40-credit allowance for actual failures and integration fixes.

This plan targets six main implementation requests, but actual Bob credit consumption can vary. The plan does not assume that every phase will succeed in a single request.

## 15. Focused test plan

### Unit tests

- AI output validation and fallback
- Human urgency requirement and override reason
- No AI call while chat mode is `HUMAN`
- Task limit and closure guard
- Canonical JSON and salted-hash stability
- On-chain payload contains only the hash
- Verification mismatch after payload modification

### Integration tests

- Reporter case isolation
- Coordinator authorization
- Reporter message saved before an AI failure
- Append-only AI and human assessments
- Failed Stellar submission leaves operational data committed

### One Playwright scenario

Reporter intake -> AI analysis -> coordinator final urgency -> human takeover and reply -> resume AI -> task approval and completion -> audit anchor -> successful verification.

Use unit or integration tests for failure branches instead of creating more browser scenarios.

## 16. Lean definition of done

The lean MVP is complete only when:

- The seven-step demonstration in section 1 works with synthetic data.
- Human authority and chat takeover rules are enforced in server code.
- The application runs locally with `granite4.1:3b` under the README memory settings.
- The mock provider supports development without Ollama.
- One approved decision snapshot is verifiably anchored on Stellar Testnet without exposing sensitive content.
- Lint, typecheck, focused tests, Playwright, and production build pass.
- The repository contains no secrets or real personal information.
- The IBM Bob log truthfully records Bob's implementation work.
- No deferred feature has been added before this definition of done passes.
