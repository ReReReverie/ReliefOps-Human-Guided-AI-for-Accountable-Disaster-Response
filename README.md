# ReliefOps

ReliefOps is a human-supervised disaster coordination prototype. A public chatbot gathers relief requests while an operations dashboard helps coordinators review AI suggestions, take over conversations, set final urgency, organize tasks, and create an auditable decision record.

The project is being built for the IBM AI Builders Wild Card Challenge. IBM Bob will be the primary development tool, IBM Granite will provide the core AI capability through Ollama, and Stellar Testnet will provide tamper-evident audit anchoring.

> ReliefOps is a student proof of concept, not an emergency service. Use synthetic demonstration data only. Do not submit real personal, medical, or disaster-victim information.

## Table of contents

- [Problem statement](#problem-statement)
- [Solution description](#solution-description)
- [Selected challenge theme](#selected-challenge-theme)
- [Current status](#current-status)
- [Core product rules](#core-product-rules)
- [AI approach and architecture](#ai-approach-and-architecture)
- [Technology stack](#technology-stack)
- [Clone the repository](#clone-the-repository)
- [Local setup and usage](#local-setup-and-usage)
- [Reporter workspace access](#reporter-workspace-access)
- [Ollama setup](#ollama-setup)
- [Mock AI for teammates](#mock-ai-for-teammates)
- [Stellar Testnet audit signer setup](#stellar-testnet-audit-signer-setup)
  - [Generate and fund a Testnet account](#1-generate-and-fund-a-testnet-account)
  - [Connect the funded account](#2-connect-the-funded-account-to-this-local-repository)
  - [Verify a chat audit anchor](#3-verify-a-chat-audit-anchor)
  - [Understand the Chat Audit dialog](#4-understand-the-chat-audit-dialog)
  - [Troubleshooting](#troubleshooting)
- [Memory and performance guidance](#memory-and-performance-guidance)
- [How IBM Bob was used](#how-ibm-bob-was-used)
- [Documentation and resources](#documentation-and-resources)

## Problem statement

Emergency hotlines and disaster-response teams can receive incomplete, repetitive, and unstructured reports during high-pressure incidents. Operators must repeatedly read conversations, identify how many people are affected, extract hazards and vulnerabilities, find missing information, and determine which cases require attention first. This manual intake work consumes time and increases cognitive load when operators need clear, actionable information.

ReliefOps is intended to enhance—not replace—existing emergency services such as 911. It reduces repetitive information-processing work while preserving human authority over priority, communication, and operational action.

## Solution description

ReliefOps combines a reporter chatbot with an operations dashboard. The chatbot gathers a report conversationally, asks focused follow-up questions, and maintains a structured case summary while preserving the complete transcript. IBM Granite analyzes known facts, identifies missing information, estimates how many people are affected, recommends an urgency level with supporting factors and confidence, and proposes a short task checklist.

On the operations side, a coordinator reviews the analysis and records the authoritative final urgency. The coordinator can take over the conversation and speak directly with the reporter; automatic AI replies stop while the conversation is under human control. When the first reporter message begins a conversation, ReliefOps creates one privacy-safe `CHAT_STARTED` record, stores it in Neon, and anchors only its salted hash on Stellar Testnet. This provides tamper-evident evidence that ReliefOps committed to the recorded start time without putting the message or reporter details on-chain.

A real deployment could connect the same intake workflow to Messenger, WhatsApp, or SMS through channel adapters. The prototype uses a web chatbot so the AI and human-handoff workflow can be demonstrated without depending on third-party messaging approval. Vercel hosts the public interface preview, while the real Granite workflow runs from the same repository on the demonstration computer because local Ollama is not reachable from a Vercel deployment.

## Selected challenge theme

**Wild Card Challenge — Build Intelligent Systems for the Future of Work**

ReliefOps aligns with this theme by treating AI as a supervised operational collaborator. It transforms an unstructured conversation into decision support and an organized workflow, helping emergency-response personnel process reports faster while keeping consequential decisions under human control.

## Current status

**Phases 1–6 are implemented.** The repository contains the lean MVP application and integration support for a Next.js 15 App Router project:

- **Next.js App Router** — reporter chatbot (`/report`), coordinator queue (`/ops`), case detail (`/ops/cases/[id]`), audit verification (`/verify/[auditId]`), and coordinator login (`/login`)
- **Neon Postgres integration** — Drizzle schema and queries for case, message, task, urgency assessment, and audit records
- **Neon Auth integration** — coordinator email/password login and reporter access through server-issued `HttpOnly` session cookies
- **AI provider integration** — Ollama/Granite provider for the local demonstration and deterministic `MockAiProvider` (`AI_PROVIDER=mock`) for development without Ollama
- **Stellar Testnet integration** — one `CHAT_STARTED` hash-anchor flow per conversation, public verification page, and coordinator retry flow

Verified local checks: `pnpm lint`, `pnpm typecheck`, 194 unit/integration tests, and `pnpm build` pass. Playwright scenarios skipped because `DATABASE_URL` was unavailable; live integrations remain pending environment-specific verification.

Use [docs/implementation-plan-lean-mvp.md](docs/implementation-plan-lean-mvp.md) for the full lean MVP specification. The original [docs/implementation-plan.md](docs/implementation-plan.md) is preserved as the fuller post-MVP roadmap.

## Core product rules

- AI suggests urgency and explains its reasoning; a coordinator sets the final urgency.
- AI proposes a short task checklist; a coordinator edits and approves it.
- A coordinator can take over a chatbot conversation at any time.
- The AI must not send messages while a human controls the conversation.
- Messages, names, contacts, locations, explanations, and task details remain off-chain.
- Synthetic demonstrations may include an optional fictional victim alias (`victimName`) and a coarse synthetic location label (for example, `Simulation Block C`) in coordinator-facing facts. These are not identity or location verification: never use legal/real names, phone numbers, email addresses, URLs, street addresses, GPS coordinates, or live location.
- Reporter chatter is separate optional coordinator-facing metadata: a fictional `reporterAlias`, one of `SELF`, `NEARBY_WITNESS`, `FAMILY_OR_CAREGIVER`, or `OTHER` as `reporterRelationship`, and (only when useful) a coarse synthetic `reporterLocationDescription`. Never merge reporter chatter into victim facts, and never collect real/legal names, phone/email/URL identifiers, exact addresses, GPS coordinates, or live location.
- Immediate-danger conversations are safety-first: the first turn asks focused safety questions, and a later turn may ask for the reporter alias and relationship (plus a coarse reporter location only when useful and missing). Chatter is optional; supplied fields persist and missing chatter never delays `CRITICAL` readiness or urgent human review.
- Stellar stores only one salted SHA-256 `CHAT_STARTED` commitment per conversation session.
- A failure in AI or Stellar must never discard or block a relief request.

## AI approach and architecture

IBM Granite is used for bounded decision support rather than autonomous control. For each intake turn, it returns a schema-validated result containing the reporter-facing reply, extracted facts, missing fields, and—when sufficient evidence exists—an urgency suggestion and proposed tasks. Application code validates and stores these outputs; Granite cannot write the human final urgency, approve tasks, dispatch assistance, or close cases.

The live AI runs locally through Ollama using `granite4.1:3b`. A deterministic mock provider uses the same schema so teammates can develop and test without running the model and so the Vercel deployment can provide a clearly labelled interface preview. The recorded prototype demonstration must use the real Ollama provider.

The chatbot's prompts, allowed facts, output contract, urgency rubric, takeover rules, failure behavior, and synthetic acceptance scenarios are defined in [docs/chatbot-specification.md](docs/chatbot-specification.md). IBM Bob must implement that contract without expanding its scope.

Reporter-facing behavior is intentionally bounded: the assistant asks no more than two focused follow-up questions, prioritizes safety-relevant missing facts, and does not repeat a confirmed question. When immediate danger is reported, it reassures the reporter that the report was saved and flagged for urgent human review; this is not a promise that help has been dispatched, is on the way, or will arrive by a particular time. The prototype never asks for real names, phone numbers, email addresses, exact addresses, GPS coordinates, or live location. An optional fictional victim alias and coarse incident label can be supplied for a demo; separate reporter chatter (`reporterAlias`, `reporterRelationship`, and an optional coarse `reporterLocationDescription`) can be supplied after safety questions. Missing optional metadata never blocks `CRITICAL` readiness, supplied facts persist, and known victim/reporter values are not re-asked.

```text
Public preview:

Browser --> Vercel-hosted Next.js application
                 |--> Neon Postgres + Neon Auth
                 |--> Deterministic mock AI (clearly labelled)
                 `--> Stellar Testnet

Real-AI demonstration:

Browser --> Local Next.js application
                 |--> Neon Postgres + Neon Auth
                 |--> Ollama on localhost --> IBM Granite 4.1 3B
                 `--> Stellar Testnet --> CHAT_STARTED hash anchor
```

The demonstration computer runs Next.js, Ollama, and the browser. Neon remains in its free managed cloud service to avoid consuming the computer's RAM. Stellar uses Testnet and fake XLM from Friendbot. The browser must never call Ollama directly, and the Vercel deployment must never be configured with a localhost Ollama URL.

## Technology stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Primary development tool | IBM Bob | Manager-led development with worker subagents implementing and validating each phase |
| Language and runtime | TypeScript and Node.js 22 LTS | Shared application and server runtime |
| Package manager | pnpm | Reproducible dependency and script management |
| Web framework | Next.js App Router and React | Reporter chatbot, coordinator dashboard, Server Components, Server Actions, and Route Handlers |
| Styling | Tailwind CSS and small accessible components | Responsive user interface without a large component framework |
| Public web hosting | Vercel Hobby | Hosted interface preview and normal Next.js server functions; it does not host Ollama |
| Database | Neon Free Postgres | Cases, messages, AI assessments, human decisions, tasks, and audit records |
| Database access | Drizzle ORM and migrations | Typed server-side queries and versioned schema changes |
| Staff authentication | Neon Auth | Coordinator login |
| Reporter access | Server-issued `HttpOnly` workspace and per-case cookies | Account-free, browser-bound reporter history using HMAC-hashed tokens and an absolute 10-hour deadline |
| Input and AI validation | Zod | Validation of forms, API input, environment variables, and model output |
| Local AI runtime | Ollama | Runs the real AI locally without cloud credentials or inference fees |
| AI model | IBM Granite `granite4.1:3b` | Fact extraction, missing-information questions, urgency suggestions, summaries, and task proposals |
| Development/preview AI | Deterministic `MockAiProvider` | Predictable tests, teammate development, and clearly labelled Vercel preview behavior |
| Blockchain | Stellar Testnet with `@stellar/stellar-sdk` | One standard `Manage Data` hash anchor for each conversation start |
| Automated testing | Vitest and Playwright | Focused unit/integration coverage and one end-to-end workflow |
| Source control and review | Public GitHub repository | Challenge submission, collaboration, and implementation history |

No paid service or watsonx.ai credential is required for the MVP. Use Vercel Hobby, Neon Free, local Ollama, and Stellar Testnet only. Never switch Stellar configuration to Mainnet.

## Clone the repository

### Prerequisites

- Git
- Node.js 22 LTS
- pnpm 11.9.0

If pnpm is not installed, enable the version bundled with Corepack:

```powershell
corepack enable
corepack prepare pnpm@11.9.0 --activate
```

Clone the public repository and enter its directory:

```bash
git clone https://github.com/ReReReverie/ReliefOps-Human-Guided-AI-for-Accountable-Disaster-Response.git
cd ReliefOps-Human-Guided-AI-for-Accountable-Disaster-Response
```

## Local setup and usage

1. Install dependencies from the repository root:

   ```bash
   pnpm install
   ```

2. Create the local environment file. Use PowerShell on Windows:

   ```powershell
   Copy-Item .env.example .env.local
   ```

   Or use macOS/Linux:

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and provide your own `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, and `REPORTER_SESSION_PEPPER` values. Keep secrets out of Git; the two secret values must contain at least 32 random characters. Set `AI_PROVIDER=mock` for the default local preview.

3. Create a Neon Postgres project and enable Neon Auth. Put the project URL and server-side credentials in `.env.local`. Do not expose these values in browser code or commit them.

4. Apply the database schema through the Neon SQL Editor. Paste and execute the complete contents of [`drizzle/migrations/0001_initial.sql`](drizzle/migrations/0001_initial.sql), followed by [`drizzle/migrations/0002_reporter_workspaces.sql`](drizzle/migrations/0002_reporter_workspaces.sql). The second migration is idempotent and backfills each existing case's reporter deadline from its original session start without restoring already-expired access. This repository contains SQL migration artifacts but no Drizzle migration journal or migration script, so do not rely on `drizzle-kit migrate` for this setup.

5. Create the demonstration coordinator account in Neon Auth, then copy its `user_id`. From PowerShell in the repository root, seed the matching coordinator profile with process-level variables:

   ```powershell
   $env:DATABASE_URL = "<your pooled Neon connection string>"
   $env:COORDINATOR_USER_ID = "<the Neon Auth user_id>"
   $env:COORDINATOR_DISPLAY_NAME = "Demo Coordinator"
   pnpm exec tsx drizzle/seed.ts
   ```

6. Choose the integrations for the demonstration:

   - For the default local preview, keep `AI_PROVIDER=mock`.
   - For live IBM Granite inference, follow [Ollama setup](#ollama-setup).
   - For blockchain-backed chat auditing, follow [Stellar Testnet audit signer setup](#stellar-testnet-audit-signer-setup).

7. Start the application:

   ```bash
   pnpm dev
   ```

   Open `http://localhost:3000`. Main routes are `/report` (reporter chatbot), `/login` (coordinator login), `/ops` (coordinator queue), `/ops/cases/[id]` (case detail), and `/verify/[auditId]` (audit verification).

   For a local demonstration without a login screen, set both `LOCAL_DEV=true` and `LOCAL_AUTH_BYPASS=true`. The bypass is disabled unless both switches are explicitly enabled and must never be enabled in a deployed environment.

8. Run the verified offline checks:

   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```

   `pnpm test:e2e` requires a separately running `pnpm dev` server, process-level `DATABASE_URL`, and process-level `E2E_COORDINATOR_EMAIL` plus `E2E_COORDINATOR_PASSWORD` for coordinator scenarios in the shell that runs the test. Without those live settings, the Playwright scenarios skip.

## Reporter workspace access

Reporter history is intentionally account-free and browser-bound. On the first
workspace request, ReliefOps issues a random `reliefops_workspace` HttpOnly
cookie and stores only its domain-separated HMAC in PostgreSQL. A workspace and
every case associated with it have an absolute 10-hour access deadline measured
from creation (or, during legacy-cookie adoption, from that case's original
session start). Sending another message never extends the deadline. Cookies
are `SameSite=Lax`, scoped to `/`, and use `Secure` outside local HTTP
development.

The workspace cookie is the only credential used by the history list and
transcript endpoint. History rows contain metadata only; reporter bodies are
returned only for a case authorized through workspace membership. The legacy
`reliefops_session` cookie remains supported for one-case migration and older
clients, but a legacy cookie can associate only the one case it proves and
cannot extend its existing expiry. Case UUIDs, public references, browser
storage, and a Docker volume are not authorization credentials.

Coordinator-facing confirmed facts may include the optional fictional
`victimName` alias and coarse `locationDescription`, plus separate reporter
chatter fields: `reporterAlias`, `reporterRelationship`, and an optional coarse
`reporterLocationDescription`. They remain off-chain structured demo metadata;
reporter history and raw transcript messages remain unchanged and are never
rewritten or backfilled when optional victim or chatter fields are added.
Existing cases may legitimately have none of these fields. Reporter aliases
are fictional only, relationships use the bounded enum documented above, and
location labels must remain coarse and synthetic; never use real/legal names,
phone/email identifiers, exact addresses, GPS coordinates, or live location.

This prototype has no reporter account, recovery secret, cross-device access,
or account recovery flow. Losing or clearing the workspace cookie, reaching
the 10-hour deadline, revoking the workspace, pruning the PostgreSQL volume,
running `docker compose down -v`, or losing the database host makes history
unavailable. Start a new synthetic report to create a new workspace when
access is available. Never use real personal, medical, or disaster-victim
information.

## Ollama setup

The main demonstration computer has 16 GB of total RAM. The selected configuration prioritizes stability over maximum context length.

### 1. Install Ollama

Download and install Ollama for Windows from the [official Ollama download page](https://ollama.com/download/windows). After installation, `ollama` should be available in PowerShell and the API should run at `http://127.0.0.1:11434`.

### 2. Download the model

```powershell
ollama pull granite4.1:3b
```

Do not use `granite4:small-h` on the 16 GB computer. Its model image is far larger and would leave insufficient memory for Windows, the browser, and the application.

### 3. Configure conservative memory settings

Run the following once in PowerShell to create user-level environment variables:

```powershell
[Environment]::SetEnvironmentVariable('OLLAMA_CONTEXT_LENGTH', '4096', 'User')
[Environment]::SetEnvironmentVariable('OLLAMA_MAX_LOADED_MODELS', '1', 'User')
[Environment]::SetEnvironmentVariable('OLLAMA_NUM_PARALLEL', '1', 'User')
[Environment]::SetEnvironmentVariable('OLLAMA_MAX_QUEUE', '4', 'User')
[Environment]::SetEnvironmentVariable('OLLAMA_KEEP_ALIVE', '10m', 'User')
```

Quit Ollama completely from the Windows system tray and reopen it so the new settings take effect.

These values do not create a hard RAM limit. They control the factors that consume memory:

- A 4,096-token context prevents an unnecessarily large context cache.
- One loaded model prevents a second model from occupying memory.
- One parallel request prevents context memory from being multiplied.
- Four queued requests protect the computer from traffic spikes.
- A ten-minute keep-alive avoids repeated model reloads during active testing.

### 4. Verify the model

```powershell
ollama run granite4.1:3b "Respond with exactly READY"
ollama ps
```

`ollama ps` shows the loaded size, context allocation, and whether inference uses CPU, GPU, or both.

### 5. Application AI configuration

Configure the `.env.local` created in the setup steps below with:

```dotenv
AI_PROVIDER=ollama
AI_BASE_URL=http://127.0.0.1:11434/v1
AI_MODEL=granite4.1:3b
AI_CONTEXT_LENGTH=4096
AI_MAX_OUTPUT_TOKENS=1200
AI_CONCURRENCY=1
```

The application server calls Ollama. Browser code must never call port `11434` directly, and Ollama must not be exposed to the public internet.

## Mock AI for teammates

The implementation will include a deterministic mock provider. Teammates who are developing UI or tests without running the model can configure:

```dotenv
AI_PROVIDER=mock
```

Mock responses must use the same validated schemas as real Granite responses. Only the demonstration computer needs the live Ollama integration.

## Stellar Testnet audit signer setup

ReliefOps uses a server-side Stellar account to anchor each conversation's `CHAT_STARTED` audit record. It does not connect to Freighter or any other browser wallet. The server signs the Testnet transaction with the secret key in `.env.local`; the browser only displays the resulting audit status and transaction link.

### 1. Generate and fund a Testnet account

Open Stellar Lab's [Create Account Keypair](https://lab.stellar.org/account/create) page. The [official Stellar Lab account guide](https://developers.stellar.org/docs/tools/lab/account) shows the same flow.

1. Look at the network selector in the upper-right corner and change it to **Testnet**. Do this before generating or funding anything.
2. In the left navigation, open **Account → Create Account Keypair**.
3. Click **Generate keypair**. Stellar Lab displays two matching values:

   | Stellar Lab field | Prefix | ReliefOps variable | Purpose |
   | --- | --- | --- | --- |
   | Public key | `G...` | `STELLAR_AUDIT_PUBLIC_KEY` | Account address; safe to use for funding and account lookup |
   | Secret key | `S...` | `STELLAR_AUDIT_SECRET_KEY` | Private transaction signer; keep server-side in `.env.local` |

   The two values belong to one keypair. Copy the `G...` and `S...` values from the **same** generated result. A `G...` public key cannot sign transactions, and Friendbot never needs the `S...` secret key.
4. Copy each value into its matching `.env.local` variable. Do not swap the two values, mix values from different generated keypairs, combine them, add spaces, or include placeholder characters such as `<` and `>`.
5. Activate the account on Testnet:

   - On the keypair page, click **Fund account with Friendbot**; or
   - Open **Account → Fund Account**, paste the `G...` public key, and click **Get lumens**.

6. Wait for the success response. Friendbot should add fake Testnet XLM to the account. Generating a keypair alone does not create an active Stellar account—the public address must be funded before Horizon and ReliefOps can load it.

The **Save Keypair** option stores the Testnet keypair in the browser's local storage and is not required by ReliefOps. The local application reads the keypair from `.env.local`. Do not use a Mainnet keypair; Testnet XLM has no monetary value and is only for development and demonstration transactions.

### 2. Connect the funded account to this local repository

There is no browser **Connect Wallet** step. The local Next.js server is connected when it starts with the funded Testnet account's keys and network settings in `.env.local`.

From PowerShell in the cloned repository root, create `.env.local` from the example file if it does not already exist:

```powershell
if (-not (Test-Path .env.local)) {
  Copy-Item .env.example .env.local
}
```

Open `.env.local` in your editor, then add or update the Stellar entries below. Replace `G...` and `S...` with the matching public address and secret key from the funded Stellar Lab account:

```dotenv
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
STELLAR_AUDIT_PUBLIC_KEY=G...
STELLAR_AUDIT_SECRET_KEY=S...
```

The application derives the signing account from `STELLAR_AUDIT_SECRET_KEY`. `STELLAR_AUDIT_PUBLIC_KEY` is currently informational and is not used by the anchor code, but keeping the matching `G...` address there makes the configured account clear. The secret key must remain server-only: never commit it, log it, put it in a `NEXT_PUBLIC_*` variable, or paste it into browser code. Keep `STELLAR_NETWORK=testnet`; the application rejects Mainnet configuration.

Before starting the website, run this connection check from the repository root. It loads `.env.local`, derives the public address without printing the secret, confirms that both configured keys match, and asks Testnet Horizon to load the funded account:

```powershell
node --env-file=.env.local -e "const { Keypair, Horizon } = require('@stellar/stellar-sdk'); const secret = process.env.STELLAR_AUDIT_SECRET_KEY; if (!secret) throw new Error('STELLAR_AUDIT_SECRET_KEY is missing'); const signer = Keypair.fromSecret(secret); const expected = process.env.STELLAR_AUDIT_PUBLIC_KEY; if (expected && expected !== signer.publicKey()) throw new Error('Public and secret keys do not match'); const server = new Horizon.Server(process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org'); server.loadAccount(signer.publicKey()).then((account) => console.log('Connected to Stellar Testnet:', account.accountId())).catch((error) => { console.error('Connection failed:', error.message); process.exit(1); });"
```

A successful check prints `Connected to Stellar Testnet: G...`. If it reports that the account cannot be found, return to Stellar Lab and fund that same `G...` address with Friendbot, then run the check again.

Restart the development server after changing `.env.local` so Next.js loads the new values:

```powershell
pnpm dev
```

### 3. Verify a chat audit anchor

1. Open `/report` and submit the first reporter chat message using synthetic demonstration data.
2. Open the resulting case in `/ops` and select **Chat Audit**.
3. Confirm that the database status becomes `ANCHORED` and the Stellar result becomes `VERIFIED`.
4. Confirm that the dialog shows the chat start time, Stellar ledger-close time, and a link to the Testnet transaction.

Anchoring runs after the first message is saved, so the dialog may initially show `PENDING`. Use **Refresh** while the submission is in progress. If the account was temporarily unfunded or Horizon was unavailable, use **Retry Stellar Anchor** after correcting the problem; the retry reuses the existing audit record and hash.

### 4. Understand the Chat Audit dialog

When the dialog shows **DB: ANCHORED** and **Stellar: VERIFIED**, ReliefOps detected no mismatch between the stored audit record and its Stellar commitment.

Read the two badges separately:

- **DB** describes whether ReliefOps has saved the Stellar submission result in its database. `DB: ANCHORED` alone does not perform an integrity check.
- **Stellar** describes the live verification result. `Stellar: VERIFIED` means ReliefOps recomputed the hash and confirmed that it matches both the database hash and the hash retrieved from the Stellar transaction.

The expected healthy result is therefore **DB: ANCHORED** together with **Stellar: VERIFIED**.

The status badges mean:

| Badge | Meaning |
| --- | --- |
| `DB: PENDING` | The audit record exists locally, but a successful Stellar transaction has not yet been saved. |
| `DB: ANCHORED` | ReliefOps saved the successful Stellar transaction and ledger metadata. |
| `DB: FAILED` | The last Stellar submission attempt failed; the chat and audit record remain saved. |
| `Stellar: VERIFIED` | The recomputed, database, and on-chain hashes all match. |
| `Stellar: NOT_ANCHORED` | There is no completed Stellar transaction to verify yet. |
| `Stellar: FAILED` | The hashes did not all match, or the expected on-chain value could not be retrieved. |

The displayed fields mean:

| Field | Meaning |
| --- | --- |
| **Chat Start Time** | The server receive time of the first successfully saved reporter message, shown in local time and UTC. |
| **Anchored At** | When ReliefOps recorded the Stellar submission as successful. |
| **Ledger Closed At** | Stellar's network time for the ledger containing the transaction. |
| **Record Hash** | The salted SHA-256 commitment to the canonical `CHAT_STARTED` metadata. It is not the chat message. |
| **Audit ID** | ReliefOps' unique identifier for this audit record. |
| **Stellar Transaction** | A link to the Testnet transaction containing the 32-byte hash in a `Manage Data` operation. |

Each time appears twice: the first line uses the demonstration computer's local time, and the second line shows the same instant in GMT/UTC. The calendar dates can differ when local time has already passed midnight. **Anchored At** can also be a second or more later than **Ledger Closed At** because ReliefOps records its success only after Stellar closes the ledger and the server receives the result.

Verification checks this relationship:

```text
recomputed hash from stored payload + nonce
                   = stored database hash
                   = Stellar on-chain Manage Data value
```

`VERIFIED` means no tampering was detected in the audited chat-start metadata after it was committed to Stellar. It does **not** place the reporter's message, identity, contact information, or other case details on-chain, and it does not independently prove that the report itself is true. If **Chat Start Time** is earlier than **Ledger Closed At**, the difference is the delay before anchoring; Stellar proves that the commitment existed by the ledger-close time.

Use **Refresh** to run verification again. Use **Retry Stellar Anchor** only for a pending or failed anchor; retries reuse the existing record and hash instead of creating a new chat-start audit.

### Troubleshooting

- **`STELLAR_AUDIT_SECRET_KEY is not configured`:** Check that `.env.local` contains the `S...` value, that it is not prefixed with `NEXT_PUBLIC_`, and that `pnpm dev` was restarted after the edit.
- **Account not found or underfunded:** Confirm that the configured secret derives the `G...` address shown in `STELLAR_AUDIT_PUBLIC_KEY`, then fund that public address again through Stellar Lab/Friendbot.
- **Network or passphrase mismatch:** Use exactly `testnet`, `https://horizon-testnet.stellar.org`, and `Test SDF Network ; September 2015`. Never mix Testnet values with a Mainnet account or Horizon URL.
- **Insufficient balance after earlier demos:** Fund the Testnet account again. Even though Testnet XLM is free, the account still needs a balance for transaction fees.
- **Old transaction links no longer work:** Stellar Testnet history and account state can be reset periodically. The [Stellar networks guide](https://developers.stellar.org/docs/networks) documents this behavior; after a reset, fund the account again and create a new demonstration chat to produce a new anchor.

## Memory and performance guidance

- Do not run a local PostgreSQL stack on the demonstration computer; use managed Neon Free.
- Keep Ollama concurrency at one.
- Keep the context at 4K unless measurements prove 8K is safe.
- Pass Granite confirmed case facts and only the latest eight messages instead of the full transcript.
- Close unrelated memory-heavy applications before running the complete prototype.
- If output quality is insufficient, evaluate a larger model only after the 3B workflow is stable.

## How IBM Bob was used

GPT-5.6 Sol with Max reasoning created the implementation plans, lean MVP scope, chatbot contract, architecture, safety rules, and validation gates.

IBM Bob was the primary implementation tool. Its manager delegated the six lean-MVP phases to worker subagents. The phase record in `docs/bob-development-log.md` contains Bob's reported worker assignments, implementation notes, commands, and validation results across the scaffold, Neon data/auth, Ollama/Granite chatbot, coordinator workflow, Stellar Testnet anchoring, and finalization. It is a record of reported work, not independent tool-level authorship proof.

After IBM Bob's 40 free tokens were exhausted, the user requested a focused Codex/GPT-5.6 Luna hardening pass on the existing implementation. That pass updated the configured Ollama budget to 1200 tokens, strengthened structured JSON/schema-repair handling, verified deterministic communication-signal processing, and added regression coverage; it did not replace Bob's primary implementation of the application features.

The current validation status is summarized above; the Bob log retains the phase-level commands and reported results.

## Documentation and resources

- [IBM Bob documentation](https://bob.ibm.com/docs/ide)
- [IBM Granite documentation](https://www.ibm.com/granite/docs/)
- [Ollama on Windows](https://docs.ollama.com/windows)
- [Ollama memory and concurrency configuration](https://docs.ollama.com/faq)
- [Next.js documentation](https://nextjs.org/docs)
- [Vercel Next.js documentation](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Neon documentation](https://neon.com/docs)
- [Drizzle ORM documentation](https://orm.drizzle.team/docs/overview)
- [Stellar developer documentation](https://developers.stellar.org/)
