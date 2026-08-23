# ReliefOps MVP Implementation Plan

## Status and authority

This document is the authoritative implementation specification for the ReliefOps MVP. The repository is a greenfield project, and implementation must be performed inside IBM Bob.

IBM Bob should execute the phases in order, validate each phase, and stop at each phase gate before continuing. Implementation decisions that contradict this document require the plan to be updated first.

The three-minute challenge video is intentionally excluded. This plan covers only the working prototype, tests, local runtime, deployment-independent architecture, and challenge documentation foundation.

## 1. Product objective

ReliefOps is a human-supervised disaster coordination system with two principal interfaces:

- A public chatbot that gathers relief requests, asks focused follow-up questions, supplies status updates, and supports human handoff.
- An operations website where coordinators review AI analysis, set final urgency, take over conversations, approve task plans, assign responders, manage resources, and track delivery.

IBM Granite is a decision-support collaborator. It must never become the final authority for urgency, resource allocation, dispatch, delivery, or case closure.

### MVP acceptance outcomes

The implementation is complete when it can demonstrate all of the following with synthetic data:

1. A reporter creates a relief case through web chat.
2. Granite extracts structured facts and asks only for missing information.
3. Granite produces an urgency suggestion with evidence, confidence, and missing information.
4. A coordinator reviews the breakdown and sets the authoritative urgency.
5. A coordinator takes over the conversation without simultaneous AI replies.
6. Granite proposes a dependency-aware task plan using known resources and responder requirements.
7. A coordinator edits and approves the plan, reserves resources, and assigns responders.
8. Responders update assigned tasks and record delivery evidence.
9. A reporter receives status updates and can confirm delivery.
10. Important lifecycle records are hashed, batched, and anchored on Stellar Testnet.
11. An authorized verifier can prove an audit record belongs to an anchored batch.
12. Modifying an anchored off-chain record causes verification to fail.

### Safety invariants

- The AI urgency value is always labelled **AI Suggested**.
- A human final urgency is required before dispatch or resource reservation.
- AI cannot approve, assign, dispatch, confirm delivery, or close a case.
- No AI message is sent while a conversation is under human control.
- Raw messages, names, contact details, coordinates, documents, and photos never enter Stellar transaction data.
- AI and blockchain failures never discard a report or block operational work.
- Corrections append new records; historical decisions are not silently overwritten.
- The public prototype accepts synthetic data only and states that it is not an emergency service.

## 2. MVP scope

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
- Supabase authentication, database, private storage, and Realtime
- Ollama with IBM Granite 4.1 3B
- Deterministic mock AI provider
- Stellar Testnet Soroban audit contract
- Merkle batching and verification
- Unit, integration, contract, and end-to-end tests
- IBM Bob development log and challenge-ready README foundation

### Excluded

- Real emergency-service integration
- SMS, WhatsApp, Messenger, email, or voice channels
- Cryptocurrency donations, tokenized aid, or payments
- Stellar Mainnet
- Raw documents or one blockchain transaction per message
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
                                 +--> Supabase Free
                                 |    Auth, Postgres, Storage, Realtime
                                 |
                                 +--> AI provider interface
                                 |      |- OllamaAiProvider
                                 |      |- MockAiProvider
                                 |      `- WatsonxAiProvider (optional later)
                                 |
                                 `--> Audit batching service
                                           |
                                           `--> Stellar Testnet Soroban contract
```

### Selected technologies

| Area | Decision |
| --- | --- |
| Runtime | Node.js 22 LTS and pnpm |
| Web | Latest security-patched Next.js 16.3.x, App Router, React, TypeScript |
| Styling | Tailwind CSS with accessible reusable components |
| Validation | Zod at every untrusted boundary |
| Database | Supabase Postgres Free |
| Authentication | Supabase anonymous auth and email magic links |
| File storage | Private Supabase Storage bucket |
| Live updates | Supabase Realtime Postgres Changes for MVP scale |
| AI runtime | Native Windows Ollama on the demonstration computer |
| AI model | `granite4.1:3b` |
| Blockchain | Stellar Testnet and a Rust Soroban contract |
| Unit tests | Vitest |
| Browser tests | Playwright |
| Contract tests | Rust `cargo test` |

### Next.js boundaries

- Use Server Components for initial dashboard and case-detail reads.
- Use Server Actions for authenticated internal mutations.
- Use Route Handlers for public chat, attachments, verification, and provider callbacks.
- Use Client Components only for chat, live subscriptions, task interaction, and other browser state.
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
    supabase/
  server/
    actions/
    services/

supabase/
  migrations/
  seed.sql

contracts/
  reliefops-audit/

tests/
  e2e/
  fixtures/

docs/
  implementation-plan.md
  architecture.md
  bob-development-log.md
```

Use one repository without a monorepo orchestration framework.

## 4. Roles and authorization

### Reporter

- Authenticates through a Supabase anonymous user.
- Creates and reads only their own case and conversation.
- Adds messages and approved attachment types.
- Requests a human and receives status updates.
- Sees only public case status, not internal notes, candidate responders, or inventory details.
- Can confirm or dispute a delivery associated with their case.

### Coordinator

- Authenticates through email magic link.
- Reviews the case queue and all operational case information.
- Sets and revises final urgency.
- Takes over, transfers, and releases conversations.
- Generates, edits, and approves task plans.
- Reserves resources and assigns responders.
- Resolves and closes cases.

### Responder

- Authenticates through email magic link.
- Reads only tasks assigned to them and the minimum case details required to act.
- Accepts an assignment or reports inability to perform it.
- Advances permitted task states and uploads evidence.
- Cannot view unrelated cases, full reporter contact details, or internal AI runs.

### Administrator

- Creates and manages coordinator and responder profiles.
- Manages roles, responder skills, availability, and resource inventory.
- Reviews failed AI and audit operations.
- Retries failed Stellar batches.

### Authorization implementation

- Enable RLS on every exposed table.
- Revoke default table privileges before granting the minimum required privileges.
- Distinguish Supabase anonymous users from staff users through JWT claims and profiles.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
- Add negative authorization tests for every role and sensitive table.

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
- Takeover, transfer, and return events generate append-only audit records.

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

- Supabase user ID
- Role: `ADMIN`, `COORDINATOR`, or `RESPONDER`
- Display name
- Responder skills
- Availability status
- Optional coarse location for matching

### `relief_cases`

- Internal UUID and non-guessable public reference
- Reporter user ID
- Case status
- Confirmed structured facts
- Need categories, hazards, affected-person count, vulnerability indicators
- Location label and optional coordinates
- Current authoritative urgency derived from the latest human decision
- Current conversation and audit versions

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
- Plain-text body protected by RLS
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
- Validated output JSON
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

- Event ID and type
- Entity type and opaque entity ID
- Actor ID
- Canonical payload JSON
- Random 32-byte nonce
- Previous record hash for the case
- Leaf hash
- Status: `PENDING`, `ANCHORING`, `ANCHORED`, or `FAILED`
- Batch ID, leaf index, and Merkle proof after anchoring

### `audit_batches`

- Batch ID hash
- Merkle root and previous batch root
- Record count
- Schema version
- Stellar network and contract ID
- Transaction hash and ledger sequence
- Status, retry count, and last safe error

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

1. Create an anonymous Supabase user and conversation.
2. Show the safety notice and obtain confirmation that the prototype uses synthetic data.
3. Accept a message with a 2,000-character maximum.
4. Save it with a client idempotency key.
5. Run deterministic emergency-phrase detection for an immediate safety banner.
6. If AI controls the conversation, invoke `processIntake`.
7. Validate and store the AI response and proposed facts.
8. Ask the reporter to confirm the structured summary.
9. After confirmation, append an AI urgency suggestion and send the case to human review.

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
/verify/[batchId]         Public batch verification
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
- Human final urgency and complete revision history
- Proposed and approved task graph
- Resource reservations and responder candidates
- Append-only operational timeline
- Audit anchoring status and verification links

### Task board

- Use accessible status controls; drag-and-drop is optional and cannot be the only interaction.
- Show blockers and dependencies.
- Prevent a task from starting while required predecessor tasks remain incomplete unless a coordinator records an override reason.
- Use text and icons in addition to color.

## 10. Stellar audit design

### Off-chain records

Keep all readable data in Supabase:

- Messages
- Names and contact details
- Locations
- AI explanations
- Human notes
- Tasks and resource information
- Attachments and delivery evidence

### On-chain contract data

Submit only:

```text
batch_id_hash
merkle_root
previous_merkle_root
record_count
schema_version
```

The transaction signer and ledger supply the organizational identity and timestamp.

### Audit record creation

For each important domain event:

1. Create canonical JSON containing the event ID, opaque case ID, event type, actor ID, server timestamp, payload, model/prompt version when applicable, and previous case-record hash.
2. Generate a cryptographically random 32-byte nonce.
3. Compute the leaf:

```text
SHA256(0x00 || nonce || canonical_json)
```

4. Build an ordered Merkle tree using:

```text
SHA256(0x01 || left_hash || right_hash)
```

5. Duplicate the final leaf when a level has an odd count.
6. Store the leaf index and proof off-chain.
7. Submit only the root and compact batch metadata to Stellar.

### Audited events

- Intake confirmed
- AI urgency suggested
- Human urgency selected or revised
- Conversation takeover, transfer, and release
- AI task plan generated
- Task plan approved
- Resource allocation approved
- Dispatch confirmed
- Delivery recorded
- Reporter delivery confirmation or dispute
- Case closed, cancelled, or corrected

### Batching policy

- Routine events remain `PENDING`.
- AI urgency, human urgency, plan approval, dispatch, delivery, and closure flush all pending records up to 100.
- Reaching 100 pending records also flushes a batch.
- Chat messages do not create individual blockchain transactions.
- A Stellar failure leaves domain work committed and audit records pending.
- Administrators can safely retry failed batches.
- Case closure shows `AUDIT_PENDING` until the final batch anchors successfully.

### Soroban contract

Implement:

```text
initialize(admin)
anchor_batch(batch_id_hash, merkle_root, previous_root, record_count, schema_version)
get_latest_root()
get_sequence()
```

Contract rules:

- Require authorization from the configured audit account.
- Accept record counts from 1 through 100.
- Require `previous_root` to match the current latest root.
- Store only the admin, latest root, and sequence in instance storage.
- Increment sequence after every successful anchor.
- Extend instance TTL on successful anchoring.
- Emit a compact `AuditBatchAnchored` event.
- Never store case records, files, or individual document hashes.

Use Stellar Testnet only. Fund the audit account with Friendbot fake XLM. Add a startup guard that refuses Mainnet configuration in the MVP.

### Verification

The public batch page displays:

- Batch ID
- Root and previous root
- Record count
- Stellar network and contract
- Transaction hash and ledger
- Verification status

An authenticated coordinator can select an audit record and recompute its canonical leaf and Merkle proof. A modified record must fail verification. The public page exposes proof data but not the private payload or nonce.

## 11. Security and operational safeguards

- Synthetic data only; display the warning before case creation.
- Validate message length, identifiers, enums, quantities, and all AI output.
- Allow only JPEG, PNG, and PDF attachments up to 5 MB.
- Store attachments in a private bucket and generate short-lived signed download URLs.
- Sanitize rendered Markdown and disallow raw HTML.
- Apply a database-backed per-session message rate limit.
- Treat reporter text as untrusted data, not system instructions.
- Do not expose tools to the public AI provider.
- Keep all Supabase service, Stellar secret, and future watsonx credentials server-only.
- Do not expose the Ollama port to the internet.
- Use structured logs containing IDs and safe error codes, not message bodies or secrets.
- Add error boundaries and recoverable UI states for AI, database, storage, and Stellar failures.
- Never use blockchain success as a prerequisite for operational relief work.

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
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
STELLAR_CONTRACT_ID=
STELLAR_AUDIT_PUBLIC_KEY=
STELLAR_AUDIT_SECRET_KEY=

AUDIT_SCHEMA_VERSION=1
```

Validate required values at server startup. Never prefix secrets with `NEXT_PUBLIC_`.

## 13. IBM Bob implementation phases

### Phase 0: Project foundation

- Initialize project context in IBM Bob.
- Add repository instructions preserving this plan's scope and invariants.
- Scaffold Next.js, TypeScript, Tailwind, linting, formatting, Vitest, and Playwright.
- Create the Rust Soroban contract workspace.
- Add typed environment validation and `.env.example`.
- Create `docs/architecture.md` and `docs/bob-development-log.md`.
- Add scripts for lint, typecheck, unit tests, end-to-end tests, build, and contract tests.

Gate:

- Clean dependency installation succeeds.
- Lint and typecheck succeed.
- Empty unit and contract test suites execute.
- Production build succeeds.

### Phase 1: Database, authentication, and RLS

- Create enums, tables, constraints, indexes, and seed data.
- Configure anonymous reporter authentication and staff magic-link login.
- Implement profiles and role-aware navigation.
- Apply RLS policies and minimum grants.
- Seed one administrator, one coordinator, two responders, and synthetic resources.

Gate:

- Reporter data is isolated by user.
- Responders see only their assigned tasks.
- Coordinators cannot perform administrator operations.
- The service-role key is absent from browser bundles.

### Phase 2: AI providers and intake chatbot

- Implement `ReliefAiProvider`, `MockAiProvider`, and `OllamaAiProvider`.
- Add the single-concurrency queue and health check.
- Add versioned prompts, schemas, JSON parsing, repair, and fallback behavior.
- Build anonymous case creation, chat, structured fact extraction, reporter confirmation, and AI urgency suggestion.
- Add deterministic safety messaging and human-review fallback.

Gate:

- Mock and Ollama providers pass the same contract tests.
- A complete synthetic case reaches human review.
- Ollama outage preserves the report and activates deterministic fallback.
- No public API response exposes internal prompts or secrets.

### Phase 3: Coordinator dashboard and takeover

- Build the queue and case-detail interface.
- Display the complete AI urgency breakdown.
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

- Insert audit records with each important domain operation.
- Implement canonicalization, per-case hash chaining, Merkle roots, and proofs.
- Build and test the Soroban contract.
- Deploy it to Stellar Testnet and fund the account with Friendbot.
- Implement transaction simulation, batch submission, reconciliation, retries, and verification pages.

Gate:

- Contract rejects unauthorized callers and incorrect previous roots.
- No sensitive data appears in transaction parameters or events.
- Altering a record fails proof verification.
- Stellar downtime leaves operational work functional and visibly pending.

### Phase 6: Hardening and completion

- Add loading, empty, error, offline, and degraded-AI states.
- Complete keyboard navigation, screen-reader labels, focus management, and non-color urgency indicators.
- Apply rate limits and attachment validation.
- Run the complete validation suite.
- Update dependencies to current security-patched releases.
- Finish the challenge README sections and IBM Bob development log using only truthful completed-work claims.

Gate:

- All unit, integration, contract, and end-to-end tests pass.
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
- Canonical JSON stability
- Leaf hashing, Merkle-root construction, and proof verification
- On-chain payload redaction

### Integration tests

- RLS for reporter, coordinator, responder, and administrator
- Anonymous case isolation
- Message idempotency
- Mock and Ollama provider contracts
- AI fallback intake
- Atomic takeover conflicts
- Return-to-AI confirmation
- Append-only urgency revisions
- Transactional resource reservation
- Audit-record creation with domain changes
- Failed and retried Stellar submissions

### Soroban tests

- Initialization only once
- Admin authorization
- Record-count bounds
- Previous-root validation
- Root and sequence updates
- TTL extension
- Expected contract event

### Playwright scenarios

1. Reporter intake, AI suggestion, human urgency, plan approval, assignment, delivery, closure, and audit verification.
2. Reporter requests a human; coordinator takes over, replies, and returns control after confirming the summary.
3. Two coordinators attempt takeover and only one succeeds.
4. Ollama is unavailable and the case remains reviewable.
5. Stellar is unavailable and operations continue with pending audit status.
6. An anchored record is modified and verification fails.
7. Unauthorized users cannot access another case, task, conversation, attachment, or audit payload.

## 15. Definition of done

The MVP is done only when:

- Every acceptance outcome is satisfied.
- Every safety invariant is enforced in code and tested.
- All validation commands pass from a clean checkout.
- The application runs locally on the 16 GB demonstration computer with `granite4.1:3b`, 4K context, and one concurrent inference.
- Supabase remains within its free tier and Stellar remains on Testnet.
- The public repository contains no secrets or real sensitive data.
- `docs/bob-development-log.md` accurately documents IBM Bob's implementation contribution.
- The README reflects the implemented system rather than planned or aspirational features.
