# ReliefOps Full Implementation Roadmap

## Status and authority

This document is the full post-MVP implementation roadmap for ReliefOps. While IBM Bob credits and team time are constrained, `docs/implementation-plan-lean-mvp.md` is the authoritative build specification and must be completed first.

When the team intentionally begins this roadmap, the IBM Bob manager must delegate the phases in order, delegate each phase's implementation and validation to worker subagents, and stop at every phase gate. Implementation decisions that contradict either plan require the plans to be updated first.

The three-minute challenge video is intentionally excluded. This plan covers only the working prototype, tests, local runtime, deployment-independent architecture, and challenge documentation foundation.

### Required AI-phase pre-read

The AI phase is not self-contained. Before delegating or implementing Phase 2, both the IBM Bob manager and its assigned worker must read `docs/chatbot-specification.md` in full. The manager must name that file in the worker task, and the worker must confirm it used the file and map its chatbot implementation and tests back to the contract. A summary or copied prompt excerpt is not a substitute for reading the file.

### Scope lock: do not deviate

This roadmap is a scope contract. When a roadmap phase is intentionally started, implement only the features, routes, tables, integrations, dependencies, and validation explicitly required by that phase, its gate, the safety invariants, the test plan, or the definition of done.

Do not add nice-to-have features, speculative requirements, generic abstractions, optional providers, extra roles, new infrastructure, unrelated refactors, anything outside the active phase, or anything marked excluded, deferred, or optional later. Every changed file must map to an explicit active-phase requirement.

For an unspecified implementation detail, use the smallest conventional solution that preserves the documented architecture without expanding product scope. If a missing decision would alter behavior, architecture, dependencies, data ownership, security boundaries, or scope, stop and report it. The plan must be updated and approved before that work is delegated or implemented; neither the manager nor a worker may silently improvise a substitute.

## 1. Product objective

ReliefOps is a human-supervised disaster coordination system with two principal interfaces:

- A public chatbot that gathers relief requests, asks focused follow-up questions, supplies status updates, and supports human handoff.
- An operations website where coordinators review AI analysis, set final urgency, take over conversations, approve task plans, assign responders, manage resources, and track delivery.

IBM Granite is a decision-support collaborator. It must never become the final authority for urgency, resource allocation, dispatch, delivery, or case closure.

### Full-roadmap acceptance outcomes

The implementation is complete when it can demonstrate all of the following with synthetic data:

1. A reporter sends a first message and creates a relief case through web chat.
2. The server records the first-message receive time and immediately anchors one privacy-safe `CHAT_STARTED` commitment for that conversation on Stellar Testnet.
3. Granite extracts structured facts and asks only for missing information.
4. Granite produces an urgency suggestion with evidence, confidence, and missing information.
5. A coordinator reviews the breakdown and sets the authoritative urgency.
6. A coordinator takes over the conversation without simultaneous AI replies.
7. Granite proposes a dependency-aware task plan using known resources and responder requirements.
8. A coordinator edits and approves the plan, reserves resources, and assigns responders.
9. Responders update assigned tasks and record delivery evidence.
10. A reporter receives status updates and can confirm delivery.
11. An authorized verifier can compare the claimed conversation-start time with the Stellar ledger close time and verify the commitment.
12. Modifying the stored start record causes verification to fail.

### Safety invariants

- The AI urgency value is always labelled **AI Suggested**.
- A human final urgency is required before dispatch or resource reservation.
- AI cannot approve, assign, dispatch, confirm delivery, or close a case.
- No AI message is sent while a conversation is under human control.
- Every conversation receives at most one on-chain `CHAT_STARTED` commitment, created from its first successfully saved reporter message.
- Raw messages, names, contact details, coordinates, documents, and photos never enter Stellar transaction data.
- AI and blockchain failures never discard a report or block operational work.
- Corrections append new records; historical decisions are not silently overwritten.
- The public prototype accepts synthetic data only and states that it is not an emergency service.

## 2. Full roadmap scope

### Included

- English web chatbot
- Anonymous reporter sessions
- Structured intake and reporter confirmation
- AI urgency suggestion and breakdown
- Human final urgency and revision history
- Coordinator chat takeover, transfer, and return to AI
- AI-generated task proposals
- Human-approved tasks, responders, and resources
- Responder mobile-friendly task interface
- Delivery evidence and reporter confirmation
- Neon Postgres, Neon Auth for staff, server-issued reporter sessions, private object storage, and application polling
- Ollama with IBM Granite 4.1 3B
- Deterministic mock AI provider
- One immediate Stellar Testnet `CHAT_STARTED` commitment per conversation and verification
- Unit, integration, and end-to-end tests
- IBM Bob development log and challenge-ready README foundation

### Excluded

- Real emergency-service integration
- SMS, WhatsApp, Messenger, email, or voice channels
- Cryptocurrency donations, tokenized aid, or payments
- Stellar Mainnet
- Raw documents, message content, timed audit batches, Merkle proofs, custom Soroban contracts, or one blockchain transaction per message
- Autonomous final urgency, allocation, assignment, or dispatch
- Cross-organization wallets and multisignature approval
- AI image interpretation
- Guaranteed Filipino-language support
- Advanced vehicle routing or geographic optimization
- Offline-first synchronization
- Production processing of personal, medical, or disaster-victim data
- Three-minute demo scripting or video production

## 3. Architecture and technology

```text
Reporter browser ------+
Coordinator dashboard -+--> Local Next.js application
Responder portal ------+        |
                                 +--> Neon Free
                                 |    Postgres + Neon Auth for staff
                                 |
                                 +--> Private S3-compatible object storage
                                 |    (post-MVP attachments only)
                                 |
                                 +--> AI provider interface
                                 |      |- OllamaAiProvider
                                 |      |- MockAiProvider
                                 |      `- WatsonxAiProvider (optional later)
                                 |
                                 `--> Stellar SDK --> Stellar Testnet
```

### Selected technologies

| Area | Decision |
| --- | --- |
| Runtime | Node.js 22 LTS and pnpm |
| Web | Latest security-patched Next.js 16.3.x, App Router, React, TypeScript |
| Styling | Tailwind CSS with accessible reusable components |
| Validation | Zod at every untrusted boundary |
| Database | Neon Postgres Free with Drizzle ORM; all access is server-side |
| Authentication | Server-issued reporter session cookies and Neon Auth for staff |
| File storage | Private S3-compatible storage behind an adapter; excluded from the lean MVP |
| Live updates | Short polling after writes; consider SSE only after the core workflow is stable |
| AI runtime | Native Windows Ollama on the demonstration computer |
| AI model | `granite4.1:3b` |
| Blockchain | `@stellar/stellar-sdk`, Horizon, and Stellar Testnet `Manage Data` operations |
| Unit tests | Vitest |
| Browser tests | Playwright |

### Next.js boundaries

- Use Server Components for initial dashboard and case-detail reads.
- Use Server Actions for authenticated internal mutations.
- Use Route Handlers for public chat, attachments, verification, and provider callbacks.
- Use Client Components only for chat, polling, task interaction, and other browser state.
- Use the Node.js runtime for database, cryptography, Ollama, and Stellar operations.
- Treat route protection as navigation convenience; every server operation must independently authenticate and authorize the caller.

### Repository structure

```text
src/
  app/
    (public)/
    (operations)/
    (responder)/
    api/
  components/
  features/
    audit/
    cases/
    chat/
    resources/
    tasks/
  lib/
    ai/
      providers/
      prompts/
      schemas/
    audit/
    auth/
    stellar/
    db.ts
  server/
    actions/
    services/

drizzle/
  migrations/
  seed.ts

tests/
  e2e/
  fixtures/

docs/
  chatbot-specification.md
  implementation-plan.md
  architecture.md
  bob-development-log.md
```

Use one repository without a monorepo orchestration framework.

Next.js, Ollama, and the browsers run locally on the demonstration computer. Neon, Stellar, and any later object-storage provider remain network services, so this design requires internet access while avoiding additional database or blockchain RAM use on the 16 GB machine.

## 4. Roles and authorization

### Reporter

- Uses no account or Neon Auth identity.
- Receives a cryptographically random 32-byte token in an `HttpOnly`, `SameSite=Lax` cookie; only `HMAC-SHA-256(REPORTER_SESSION_PEPPER, token)` is stored in Neon.
- Creates and reads only their own case and conversation.
- Adds messages and approved attachment types.
- Requests a human and receives status updates.
- Sees only public case status, not internal notes, candidate responders, or inventory details.
- Can confirm or dispute a delivery associated with their case.

### Coordinator

- Authenticates through Neon Auth.
- Reviews the case queue and all operational case information.
- Sets and revises final urgency.
- Takes over, transfers, and releases conversations.
- Generates, edits, and approves task plans.
- Reserves resources and assigns responders.
- Resolves and closes cases.

### Responder

- Authenticates through Neon Auth.
- Reads only tasks assigned to them and the minimum case details required to act.
- Accepts an assignment or reports inability to perform it.
- Advances permitted task states and uploads evidence.
- Cannot view unrelated cases, full reporter contact details, or internal AI runs.

### Administrator

- Creates and manages coordinator and responder profiles.
- Manages roles, responder skills, availability, and resource inventory.
- Reviews failed AI and audit operations.
- Retries failed Stellar session-start anchors.

### Authorization implementation

- Route all database access through authenticated and authorized server functions; never expose Neon credentials or a direct database client to the browser.
- Reporter functions derive `HMAC-SHA-256(REPORTER_SESSION_PEPPER, token)` and use a constant-time comparison against the stored session hash.
- Staff functions validate the Neon Auth session and then enforce the role stored in `profiles`.
- Check `Origin` on cookie-authenticated mutations, use `SameSite=Lax`, and set `Secure` outside local HTTP development.
- Use separate migration and runtime credentials where available, and grant the runtime role only the privileges it needs.
- Add negative authorization tests for every role, reporter session, and sensitive table.

## 5. Domain states and workflows

### Case states

```text
INTAKE
  -> AWAITING_HUMAN_REVIEW
  -> ACTIVE
  -> RESOLVED
  -> CLOSED
```

`CANCELLED` is available before closure and requires a coordinator, timestamp, and reason. State transitions occur through guarded domain functions, not unrestricted table updates.

### Conversation states

```text
AI_ACTIVE
  -> HANDOFF_REQUESTED
  -> HUMAN_ACTIVE
  -> AI_ACTIVE
  -> CLOSED
```

Conversation rules:

- Only one coordinator owns a conversation at a time.
- Taking over uses an atomic compare-and-set database function.
- A second takeover attempt returns a conflict without replacing the owner.
- While `HUMAN_ACTIVE`, the message endpoint stores reporter messages but never invokes Ollama automatically.
- Private AI reply suggestions run only after the coordinator explicitly requests one.
- If the coordinator disconnects, the conversation remains human-controlled.
- Returning to AI creates a proposed summary and case-fact patch.
- The coordinator reviews and confirms the patch before AI messaging resumes.
- Takeover, transfer, and return events generate append-only off-chain operational events.

### Task states

```text
DRAFT -> READY -> ASSIGNED -> IN_PROGRESS -> COMPLETED
                                `-> BLOCKED
```

`CANCELLED` requires a reason. Responders may update only assigned tasks. Coordinators can reassign, unblock, or cancel tasks.

### Resource allocation states

```text
PROPOSED -> RESERVED -> DISPATCHED -> DELIVERED
              `-> RELEASED
```

Inventory updates must execute transactionally and never allow available quantities below zero.

## 6. Data model

All primary keys use UUIDs. All mutable entities include `created_at`, `updated_at`, and an integer `version` for optimistic concurrency.

### `profiles`

- Neon Auth user ID
- Role: `ADMIN`, `COORDINATOR`, or `RESPONDER`
- Display name
- Responder skills
- Availability status
- Optional coarse location for matching

### `relief_cases`

- Internal UUID and non-guessable public reference
- Reporter session ID
- Case status
- Confirmed structured facts
- Need categories, hazards, affected-person count, vulnerability indicators
- Location label and optional coordinates
- Current authoritative urgency derived from the latest human decision
- Current conversation version and chat-start audit status

### `reporter_sessions`

- Internal UUID
- HMAC-SHA-256 hash of the random browser token; never store the raw token
- Created, first-message-received, last-active, revoked, and expiry timestamps
- Optional IP-derived abuse signal only if explicitly needed; never store it in the blockchain payload

### `conversations`

- Case ID
- Conversation mode
- Assigned coordinator
- Handoff request and takeover timestamps
- Latest rolling summary
- Optimistic version

### `messages`

- Conversation ID
- Sender type: `REPORTER`, `AI`, `COORDINATOR`, or `SYSTEM`
- Optional authenticated sender ID
- Plain-text body available only through server-side authorization checks
- Client-generated idempotency key
- Timestamp

### `attachments`

- Case/message/task relationship
- Private object key
- Original file name
- MIME type and size
- SHA-256 content hash
- Uploader and timestamp

### `ai_runs`

- Case and conversation relationship
- Operation type
- Provider and model ID
- Prompt version
- Input snapshot hash
- Validated output JSON, including communication signals when the operation analyzes intake
- Never a corrected or normalized replacement for the raw reporter message
- Latency and token counts when available
- Status, retry count, and safe error code

### `urgency_assessments`

- Case ID
- Source: `AI` or `HUMAN`
- Level
- Factor breakdown
- Confidence for AI suggestions
- Rationale
- Evidence message IDs
- Missing information
- Model/prompt metadata or human actor ID
- Timestamp

Assessments are append-only. The latest human assessment is authoritative.

### `tasks` and `task_dependencies`

- Case ID
- Title, description, completion criteria
- Status and sequence
- Required skills
- Assigned responder
- Blocking reason
- Dependency edges with a uniqueness constraint

The service rejects self-dependencies and cyclic graphs.

### `resources` and `resource_allocations`

- Resource type and display name
- Total and available quantity
- Coarse location
- Case/task association
- Requested and approved quantity
- Allocation status
- Approver and timestamps

### `audit_records`

- Audit ID and event type fixed to `CHAT_STARTED`
- Case, conversation, and opaque session identifiers
- First reporter message ID and server receive time
- Canonical payload JSON
- Random 32-byte nonce
- SHA-256 record hash
- Status: `PENDING`, `ANCHORING`, `ANCHORED`, or `FAILED`
- Stellar transaction hash, ledger sequence, ledger close time, retry count, and safe error code

Enforce a unique constraint on `(conversation_id, event_type)` so retries cannot create multiple start records.

### `operational_events`

- Event ID, event type, and affected entity
- Authenticated actor ID or opaque reporter-session ID
- Append-only payload JSON and server timestamp
- Model and prompt version when the event records AI output

These records provide the detailed off-chain history for urgency decisions, takeover, task approval, assignment, delivery, and closure. They are not individually sent to Stellar.

## 7. Local AI implementation

### Provider interface

```ts
interface ReliefAiProvider {
  processIntake(input: IntakeInput): Promise<IntakeResult>
  suggestUrgency(input: UrgencyInput): Promise<UrgencySuggestion>
  generateTaskPlan(input: PlanningInput): Promise<TaskPlan>
  summarizeHandoff(input: HandoffInput): Promise<HandoffSummary>
  suggestCoordinatorReply(input: ReplySuggestionInput): Promise<ReplySuggestion>
  healthCheck(): Promise<AiHealth>
}
```

Implement:

- `OllamaAiProvider` for live local inference.
- `MockAiProvider` for teammates, tests, and predictable UI development.
- Keep the interface compatible with a future `WatsonxAiProvider`, but do not make watsonx part of the MVP dependency path.

### Ollama constraints

```text
Model: granite4.1:3b
Context: 4096 tokens
Maximum generated output: 600 tokens
Maximum loaded models: 1
Parallel requests: 1
Application AI concurrency: 1
```

The application must serialize AI work through a bounded in-process queue. If the queue is full, save the reporter message and mark the case for human review instead of rejecting it.

### Context construction

Each inference receives only:

- Versioned system instructions
- Current confirmed structured case facts
- Current authoritative human decision when one exists
- Latest AI assessment when relevant
- Last 8-12 relevant messages
- Deterministic capitalization statistics for the latest raw reporter message when processing intake
- A compact rolling conversation summary

Do not continually resend the complete transcript. Refresh the rolling summary before the context exceeds the configured budget.

### Structured schemas

```ts
type IntakeResult = {
  assistantMessage: string
  extractedFacts: Partial<CaseFacts>
  missingFields: string[]
  safetyAlert: boolean
  intakeComplete: boolean
  communicationSignals: CommunicationSignals
}

type UrgencySuggestion = {
  suggestedLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  confidence: number
  factors: UrgencyFactor[]
  missingInformation: string[]
  rationale: string
  evidenceMessageIds: string[]
}

type TaskPlan = {
  summary: string
  tasks: ProposedTask[]
}

type HandoffSummary = {
  summary: string
  proposedFactChanges: CaseFactPatch[]
  unresolvedQuestions: string[]
}
```

`CommunicationSignals` and the rules for analysis-only spelling normalization, deterministic capitalization statistics, possible-distress labels, and raw-message preservation are defined in `docs/chatbot-specification.md`. Full-roadmap types may extend the intake result but may not weaken or duplicate that contract inconsistently.

Every response is parsed as JSON and validated with Zod. Use temperature `0`, a fixed seed when supported, one JSON-repair attempt, and then a deterministic human-review fallback.

### Urgency rubric

Granite provides a breakdown for:

- Immediate danger
- Number of people affected
- Vulnerability factors
- Essential-needs impact
- Access and environmental constraints
- Corroborating or duplicate reports
- Missing information

Each factor includes a severity, explanation, and supporting message IDs. The AI does not produce the final urgency.

The queue may sort provisionally using AI suggestion and report age, but the interface must clearly distinguish:

```text
AI Suggested Urgency
Human Final Urgency
```

No dispatch or resource reservation is allowed until a coordinator records a final urgency. Selecting a different level from the AI suggestion requires a reason. Human revisions append new decisions rather than updating prior rows.

### Task planning safeguards

- Limit generated plans to 12 tasks.
- Pass only available resource and responder identifiers to Granite.
- Reject unknown identifiers, negative quantities, and cyclic dependencies.
- Rank responders deterministically using required skills, availability, coarse location, and workload.
- Use AI only to explain candidate rankings.
- Require coordinator approval before assignments or resource reservations.

### AI failure handling

- Apply a 60-second local timeout.
- Do not retry indefinitely; allow one retry for a transient connection error.
- Never hold a database transaction open during inference.
- If Ollama is offline or overloaded, preserve the message and move the case to human review.
- Provide a deterministic form for remaining intake fields.
- Show a non-sensitive AI health indicator to administrators.
- Never log raw message bodies in application logs.

## 8. Public chatbot and human takeover

### Intake flow

1. Show the safety notice and obtain confirmation that the prototype uses synthetic data.
2. Accept the first message with a 2,000-character maximum and a client idempotency key.
3. Generate a random reporter token, then create the session, case, conversation, first message, and pending `CHAT_STARTED` record in one database transaction.
4. Return the raw reporter token only in an `HttpOnly` cookie.
5. After the transaction commits, immediately attempt the Stellar anchor; never roll back the report when Stellar fails.
6. Run deterministic emergency-phrase detection for an immediate safety banner.
7. If AI controls the conversation, invoke `processIntake`.
8. Validate and store the AI response and proposed facts.
9. Ask the reporter to confirm the structured summary.
10. After confirmation, append an AI urgency suggestion and send the case to human review.

### Human takeover

- Reporter can request a human, changing the mode to `HANDOFF_REQUESTED`.
- Coordinator sees an alert and clicks **Take Over Conversation**.
- A database function atomically sets `HUMAN_ACTIVE` and the owner.
- Reporter sees the coordinator's name and a clear human-control banner.
- AI auto-replies stop immediately.
- Coordinator messages are visibly labelled as human.
- AI suggestions are private drafts and never auto-send.
- Returning to AI requires coordinator approval of a generated summary and case-fact patch.

## 9. Operations and responder interfaces

### Routes

```text
/                         Landing and safety notice
/report                   Reporter chatbot
/track/[reference]        Reporter status
/verify/[auditId]         Session-start verification
/login                    Staff authentication
/ops                      Coordinator case queue
/ops/cases/[id]           Case, chat, urgency, plan, and audit detail
/ops/tasks                Operations task board
/ops/resources            Resource inventory
/responder                Assigned responder tasks
```

### Coordinator case page

Display:

- Confirmed facts and reporter-provided evidence
- Conversation with takeover controls
- AI urgency suggestion, factor evidence, confidence, and missing information
- Separately labelled **Possible Communication Distress (AI, non-diagnostic)** cues without a corrected transcript
- Human final urgency and complete revision history
- Proposed and approved task graph
- Resource reservations and responder candidates
- Append-only operational timeline
- Session-start anchor status, claimed receive time, ledger close time, and verification link

### Task board

- Use accessible status controls; drag-and-drop is optional and cannot be the only interaction.
- Show blockers and dependencies.
- Prevent a task from starting while required predecessor tasks remain incomplete unless a coordinator records an override reason.
- Use text and icons in addition to color.

## 10. Stellar audit design

### Off-chain records

Keep all readable and operational data in Neon or private object storage:

- Messages
- Names and contact details
- Locations
- AI explanations
- Human notes
- Tasks and resource information
- Attachments and delivery evidence

The immutable start-record payload and its nonce also remain off-chain in Neon.

### What is committed

Create exactly one audit record for each conversation session when its first reporter message is successfully saved. Canonical JSON contains only:

```text
schema_version
audit_id
event_type = CHAT_STARTED
opaque_case_id
opaque_session_id
first_message_received_at_utc
```

Do not include the message body, reporter identity, contact details, location, AI output, urgency, tasks, attachments, or secrets.

### Hashing and submission

1. Create the case, conversation, first message, and pending start record in one Neon transaction.
2. Serialize the start-record payload with deterministic key ordering.
3. Generate a cryptographically random 32-byte nonce.
4. Compute:

```text
SHA256("reliefops:chat-start:v1" || nonce || canonical_json_utf8)
```

5. Store the payload, nonce, and hex hash in Neon.
6. After the database transaction commits, submit the raw 32-byte hash through a standard Stellar `Manage Data` operation:

```text
name:  reliefops.chat-start.v1
value: <32 raw hash bytes>
```

7. Store the transaction hash, ledger sequence, and ledger close time on the existing audit record.

Use the same data-entry name for each session; earlier values remain visible in transaction history. Enforce a unique database constraint on `(conversation_id, event_type)`, and make submission retries idempotent so one conversation cannot generate multiple intended start records.

This design deliberately uses one Stellar transaction per conversation session, not a transaction per message and not a timed batch. It avoids a Soroban contract, Rust workspace, contract deployment, TTL handling, and Merkle proofs.

### Evidence semantics

The database timestamp is ReliefOps' claim about when the first message reached the server. A matching Stellar transaction proves ReliefOps committed to that exact record no later than the ledger close time. Submitting immediately makes the two times close enough to demonstrate timely recording.

This does not prove the reporter's identity, the message contents, whether an operator saw or answered it, or that the application server's clock was exact. Those limitations must be stated on the verification page and in any legal or administrative explanation.

### Failure and retry behavior

- Case creation and the first message commit before the Stellar request starts.
- A Stellar timeout or rejection marks the audit `FAILED`; it never deletes the report or blocks AI or human work.
- An administrator may retry the existing record. A successful retry changes it to `ANCHORED` and cannot create a second audit row.
- A delayed retry proves that the record existed by the later ledger close time; it cannot retroactively prove that it was anchored at the claimed start time.
- Detailed urgency, takeover, task, delivery, and closure events stay in the append-only `operational_events` table and are not sent on-chain.

### Verification

`/verify/[auditId]` must:

1. Load the immutable off-chain payload and nonce through an authorized server function.
2. Recompute the salted hash.
3. Fetch the saved Stellar transaction and `Manage Data` operation through Horizon.
4. Decode the on-chain value and compare it with the recomputed and stored hashes.
5. Show the claimed first-message receive time next to the Stellar ledger close time.
6. Show **Verified** only when all three hashes match; otherwise show **Verification Failed**.

The public view may show the audit ID, opaque case reference, event type, claimed time, ledger time, transaction hash, network, and verification result. It must not expose the nonce or any private payload fields. An authorized administrator or auditor may export the canonical payload and nonce to independently recompute the commitment.

Use Stellar Testnet only, fund the audit account with Friendbot fake XLM, and add a startup guard that refuses Mainnet configuration. This makes the prototype network cost zero. Testnet history can be reset and is demonstration evidence, not permanent production infrastructure; Mainnet requires a separate cost and retention review.

## 11. Security and operational safeguards

- Synthetic data only; display the warning before case creation.
- Validate message length, identifiers, enums, quantities, and all AI output.
- Allow only JPEG, PNG, and PDF attachments up to 5 MB.
- Store attachments through a private S3-compatible adapter and generate short-lived signed download URLs.
- Sanitize rendered Markdown and disallow raw HTML.
- Apply a database-backed per-session message rate limit.
- Store only the HMAC-SHA-256 hash of each reporter token, compare derived hashes in constant time, rotate tokens after privilege-relevant changes, and expire inactive sessions.
- Check request `Origin` for cookie-authenticated mutations and set reporter and staff cookies `HttpOnly`, `SameSite=Lax`, and `Secure` outside local HTTP development.
- Treat reporter text as untrusted data, not system instructions.
- Do not expose tools to the public AI provider.
- Keep Neon database, Neon Auth, reporter-session, object-storage, Stellar, and future watsonx credentials server-only.
- Do not expose the Ollama port to the internet.
- Use structured logs containing IDs and safe error codes, not message bodies or secrets.
- Add error boundaries and recoverable UI states for AI, database, storage, and Stellar failures.
- Never use blockchain success as a prerequisite for operational relief work.

## 12. Environment configuration

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000

DATABASE_URL=
DATABASE_URL_UNPOOLED=
NEON_AUTH_BASE_URL=
NEON_AUTH_COOKIE_SECRET=
REPORTER_SESSION_PEPPER=

OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_ACCESS_KEY=
OBJECT_STORAGE_SECRET_KEY=

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

AUDIT_SCHEMA_VERSION=1
```

Validate required values at server startup. Use `DATABASE_URL` for pooled application traffic and `DATABASE_URL_UNPOOLED` only for migrations or direct-connection operations. Require `NEON_AUTH_COOKIE_SECRET` and `REPORTER_SESSION_PEPPER` to contain at least 32 random bytes. Object-storage values are required only when the post-MVP attachment feature is enabled. Never prefix secrets with `NEXT_PUBLIC_`.

## 13. IBM Bob implementation phases

The following roles are IBM Bob development-agent roles, not ReliefOps application roles.

### Required manager-worker model

#### Manager agent

The manager is orchestration-only. It may read the selected phase, its required supporting specifications, and worker reports; break that phase into bounded tasks; delegate tasks; wait for results; and send targeted follow-ups. It must never create or edit files, write code or documentation, run commands, perform integration, fix failures, implement any part of the product, or delegate work that is not directly traceable to the active phase or gate.

Whenever implementation, integration, documentation, repair, or verification is required, the manager must delegate it to a worker subagent. The manager may report a gate as passed only when a worker has run and reported every required command.

#### Worker subagents

Worker subagents perform all implementation and validation. Each delegation must state the exact scope, owned files or responsibility, dependencies, acceptance conditions, gate commands, and deferred work that is prohibited.

Workers must preserve existing and concurrent changes, stay within their assigned ownership, map every changed file to an explicit requirement, implement only the required validation and error handling, run their checks, fix failures caused by their work, and remove unrequired additions before reporting exact files, commands, results, risks, and blockers. They stop after their assigned task and never advance the roadmap themselves.

Only one designated worker may modify shared coordination surfaces such as `package.json`, migration ordering, or `docs/bob-development-log.md` during a phase. If parallel workers contribute, the manager delegates final integration and the complete phase gate to an integration worker; the manager never integrates or verifies directly.

### Delegation protocol

1. Select one phase only and respect its dependency order.
2. Delegate the entire phase to one worker by default. Use multiple workers only for independent tasks with non-overlapping ownership.
3. Give every worker the phase scope, file or responsibility ownership, every required supporting specification, acceptance conditions, required gate, and explicit instruction not to add unlisted features, infrastructure, abstractions, packages, or refactors. The worker must read each named supporting specification in full before editing.
4. Delegate any failure back to the responsible worker; never repair it in the manager role.
5. Delegate integration and the final gate to a worker, then stop after reporting the worker results.
6. Do not delegate the next phase until a new request explicitly starts it.

### Phase 0: Project foundation

- Initialize project context in IBM Bob.
- Add repository instructions preserving this plan's scope and invariants.
- Scaffold Next.js, TypeScript, Tailwind, linting, formatting, Vitest, and Playwright.
- Add typed environment validation and `.env.example`.
- Create `docs/architecture.md` and `docs/bob-development-log.md`.
- Add scripts for lint, typecheck, unit tests, end-to-end tests, and build.

Gate:

- Clean dependency installation succeeds.
- Lint and typecheck succeed.
- The empty unit-test suite executes.
- Production build succeeds.

### Phase 1: Neon data, sessions, and staff authentication

- Create the Drizzle schema, migrations, enums, tables, constraints, indexes, and seed data.
- Implement keyed-hash reporter sessions and staff login through Neon Auth.
- Implement profiles and role-aware navigation.
- Add server-only database access, minimum runtime-role grants, CSRF checks, and centralized authorization helpers.
- Seed one administrator, one coordinator, two responders, and synthetic resources.

Gate:

- Reporter data is isolated by a valid session cookie.
- Responders see only their assigned tasks.
- Coordinators cannot perform administrator operations.
- Database and authentication secrets are absent from browser bundles.

### Phase 2: AI providers and intake chatbot

- Before editing, read `docs/chatbot-specification.md` in full and treat it as the minimum chatbot behavior contract; full-roadmap additions must not weaken it.
- Implement `ReliefAiProvider`, `MockAiProvider`, and `OllamaAiProvider`.
- Add the single-concurrency queue and health check.
- Add versioned prompts, schemas, JSON parsing, repair, and fallback behavior.
- Build first-message case creation with one pending `CHAT_STARTED` record, chat, structured fact extraction, reporter confirmation, analysis-only spelling normalization, deterministic capitalization cues, non-diagnostic possible-distress analysis, and AI urgency suggestion.
- Add deterministic safety messaging and human-review fallback.

Gate:

- Mock and Ollama providers pass the same contract tests.
- A complete synthetic case reaches human review.
- Every synthetic acceptance scenario in `docs/chatbot-specification.md` passes.
- Ollama outage preserves the report and activates deterministic fallback.
- No public API response exposes internal prompts or secrets.

### Phase 3: Coordinator dashboard and takeover

- Build the queue and case-detail interface.
- Display the complete AI urgency breakdown.
- Display communication cues separately from incident facts and urgency factors, using the exact non-diagnostic label and safeguards in `docs/chatbot-specification.md`.
- Implement append-only human final urgency and revision history.
- Add atomic takeover, transfer, coordinator messaging, private AI suggestions, and reviewed return to AI.

Gate:

- Two concurrent takeover attempts produce exactly one owner.
- No AI response is sent in `HUMAN_ACTIVE` mode.
- Human urgency is mandatory before dispatch-capable actions.
- Override reasons are enforced.

### Phase 4: Task, responder, and resource orchestration

- Implement AI task-plan generation and schema validation.
- Validate resource identifiers, quantities, and task DAGs.
- Implement deterministic responder ranking.
- Build plan editing, approval, task board, responder portal, and transactional inventory reservation.
- Add delivery evidence and reporter confirmation/dispute.

Gate:

- AI cannot reference unknown resources or directly assign responders.
- Inventory cannot become negative under concurrent requests.
- Cyclic plans are rejected.
- Only assigned responders can update their tasks.

### Phase 5: Audit records and Stellar

- Implement deterministic `CHAT_STARTED` canonicalization, nonce generation, and SHA-256 commitments.
- Submit one immediate standard `Manage Data` operation per conversation session to Stellar Testnet and fund the signer with Friendbot.
- Implement idempotent submission, reconciliation, retries, Horizon lookup, and the verification page.
- Keep all other lifecycle history in append-only off-chain operational events.

Gate:

- Exactly one start audit exists per conversation and a retry cannot create a second record.
- No sensitive data appears in the transaction operation.
- The page displays both the claimed receive time and the ledger close time.
- Altering the off-chain record fails hash verification.
- Stellar downtime leaves operational work functional and visibly pending.

### Phase 6: Hardening and completion

- Add loading, empty, error, offline, and degraded-AI states.
- Complete keyboard navigation, screen-reader labels, focus management, and non-color urgency indicators.
- Apply rate limits and attachment validation.
- Run the complete validation suite.
- Update dependencies to current security-patched releases.
- Finish the challenge README sections and IBM Bob development log using only truthful completed-work claims.

Gate:

- All unit, integration, and end-to-end tests pass.
- Lint, typecheck, and production build pass.
- Synthetic end-to-end workflow completes with Ollama and Stellar Testnet.
- Repository contains no secrets or real personal information.

## 14. Test plan

### Unit tests

- Environment and Zod schema validation
- AI JSON parsing and repair fallback
- Urgency display and override requirements
- Case, conversation, task, and allocation state guards
- Task DAG cycle detection
- Deterministic responder ranking
- Inventory reservation arithmetic
- `CHAT_STARTED` canonical JSON and salted-hash stability
- Stellar `Manage Data` encoding, decoding, and verification
- On-chain payload redaction
- One-start-record-per-session uniqueness and retry idempotency

### Integration tests

- Reporter cookie isolation and staff role authorization
- Missing, malformed, expired, and cross-session cookie rejection
- Message idempotency
- Mock and Ollama provider contracts
- AI fallback intake
- Atomic takeover conflicts
- Return-to-AI confirmation
- Append-only urgency revisions
- Transactional resource reservation
- Atomic first-message and pending-start-record creation
- Append-only operational-event creation with domain changes
- Failed and retried Stellar submissions

### Playwright scenarios

1. First reporter message, immediate session-start anchor, AI suggestion, human urgency, plan approval, assignment, delivery, closure, and start-record verification.
2. Reporter requests a human; coordinator takes over, replies, and returns control after confirming the summary.
3. Two coordinators attempt takeover and only one succeeds.
4. Ollama is unavailable and the case remains reviewable.
5. Stellar is unavailable and operations continue with pending audit status.
6. An anchored start record is modified and verification fails.
7. Unauthorized users cannot access another case, task, conversation, attachment, or audit payload.

## 15. Definition of done

The full roadmap is done only when:

- Every acceptance outcome is satisfied.
- Every safety invariant is enforced in code and tested.
- All validation commands pass from a clean checkout.
- The application runs locally on the 16 GB demonstration computer with `granite4.1:3b`, 4K context, and one concurrent inference.
- Neon and any selected object-storage provider remain within the team's approved free tiers, and Stellar remains on Testnet.
- The public repository contains no secrets or real sensitive data.
- `docs/bob-development-log.md` accurately documents IBM Bob's implementation contribution.
- The README reflects the implemented system rather than planned or aspirational features.
- Every implementation change is traceable to an explicit roadmap requirement; no unapproved feature or infrastructure remains.
