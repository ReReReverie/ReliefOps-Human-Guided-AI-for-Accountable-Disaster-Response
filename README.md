# ReliefOps

ReliefOps is a human-supervised disaster coordination prototype. A public chatbot gathers relief requests while an operations dashboard helps coordinators review AI suggestions, take over conversations, set final urgency, organize tasks, and create an auditable decision record.

The project is being built for the IBM AI Builders Wild Card Challenge. IBM Bob will be the primary development tool, IBM Granite will provide the core AI capability through Ollama, and Stellar Testnet will provide tamper-evident audit anchoring.

> ReliefOps is a student proof of concept, not an emergency service. Use synthetic demonstration data only. Do not submit real personal, medical, or disaster-victim information.

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

Verified local checks: `pnpm lint`, `pnpm typecheck`, 123 unit/integration tests, and `pnpm build` pass. Playwright scenarios skipped because `DATABASE_URL` was unavailable; live integrations remain pending environment-specific verification.

Use [docs/implementation-plan-lean-mvp.md](docs/implementation-plan-lean-mvp.md) for the full lean MVP specification. The original [docs/implementation-plan.md](docs/implementation-plan.md) is preserved as the fuller post-MVP roadmap.

## Core product rules

- AI suggests urgency and explains its reasoning; a coordinator sets the final urgency.
- AI proposes a short task checklist; a coordinator edits and approves it.
- A coordinator can take over a chatbot conversation at any time.
- The AI must not send messages while a human controls the conversation.
- Messages, names, contacts, locations, explanations, and task details remain off-chain.
- Stellar stores only one salted SHA-256 `CHAT_STARTED` commitment per conversation session.
- A failure in AI or Stellar must never discard or block a relief request.

## AI approach and architecture

IBM Granite is used for bounded decision support rather than autonomous control. For each intake turn, it returns a schema-validated result containing the reporter-facing reply, extracted facts, missing fields, and—when sufficient evidence exists—an urgency suggestion and proposed tasks. Application code validates and stores these outputs; Granite cannot write the human final urgency, approve tasks, dispatch assistance, or close cases.

The live AI runs locally through Ollama using `granite4.1:3b`. A deterministic mock provider uses the same schema so teammates can develop and test without running the model and so the Vercel deployment can provide a clearly labelled interface preview. The recorded prototype demonstration must use the real Ollama provider.

The chatbot's prompts, allowed facts, output contract, urgency rubric, takeover rules, failure behavior, and synthetic acceptance scenarios are defined in [docs/chatbot-specification.md](docs/chatbot-specification.md). IBM Bob must implement that contract without expanding its scope.

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
| Reporter access | Server-issued `HttpOnly` session cookie | Account-free reporter isolation using HMAC-hashed tokens |
| Input and AI validation | Zod | Validation of forms, API input, environment variables, and model output |
| Local AI runtime | Ollama | Runs the real AI locally without cloud credentials or inference fees |
| AI model | IBM Granite `granite4.1:3b` | Fact extraction, missing-information questions, urgency suggestions, summaries, and task proposals |
| Development/preview AI | Deterministic `MockAiProvider` | Predictable tests, teammate development, and clearly labelled Vercel preview behavior |
| Blockchain | Stellar Testnet with `@stellar/stellar-sdk` | One standard `Manage Data` hash anchor for each conversation start |
| Automated testing | Vitest and Playwright | Focused unit/integration coverage and one end-to-end workflow |
| Source control and review | Public GitHub repository | Challenge submission, collaboration, and implementation history |

No paid service or watsonx.ai credential is required for the MVP. Use Vercel Hobby, Neon Free, local Ollama, and Stellar Testnet only. Never switch Stellar configuration to Mainnet.

## Ollama setup for the demonstration computer

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
AI_MAX_OUTPUT_TOKENS=600
AI_CONCURRENCY=1
```

The application server calls Ollama. Browser code must never call port `11434` directly, and Ollama must not be exposed to the public internet.

## Teammates without Ollama

The implementation will include a deterministic mock provider. Teammates who are developing UI or tests without running the model can configure:

```dotenv
AI_PROVIDER=mock
```

Mock responses must use the same validated schemas as real Granite responses. Only the demonstration computer needs the live Ollama integration.

## How to clone it to your device

Prerequisites: Git, Node.js 22 LTS, and pnpm. If pnpm is not installed, enable the version bundled with Corepack:

```powershell
corepack enable
corepack prepare pnpm@11.9.0 --activate
```

Clone the public repository and enter its directory:

```text
git clone https://github.com/ReReReverie/ReliefOps-Human-Guided-AI-for-Accountable-Disaster-Response.git
cd ReliefOps-Human-Guided-AI-for-Accountable-Disaster-Response
```

## After cloning it how to use it

1. Install dependencies from the repository root:

   ```text
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

4. Apply the database schema through the Neon SQL Editor. Paste and execute the complete contents of [`drizzle/migrations/0001_initial.sql`](drizzle/migrations/0001_initial.sql). This repository contains the SQL migration artifact but no Drizzle migration journal or migration script, so do not rely on `drizzle-kit migrate` for this setup.

5. Create the demonstration coordinator account in Neon Auth, then copy its `user_id`. From PowerShell in the repository root, seed the matching coordinator profile with process-level variables:

   ```powershell
   $env:DATABASE_URL = "<your pooled Neon connection string>"
   $env:COORDINATOR_USER_ID = "<the Neon Auth user_id>"
   $env:COORDINATOR_DISPLAY_NAME = "Demo Coordinator"
   pnpm exec tsx drizzle/seed.ts
   ```

6. Mock AI is the default for a setup without live model credentials. Ollama and IBM Granite are needed only for the full local AI demonstration; follow the existing [Ollama setup for the demonstration computer](#ollama-setup-for-the-demonstration-computer) section instead of duplicating those instructions here. Stellar Testnet credentials are also needed only for the full blockchain-backed demonstration: generate a Stellar keypair, fund its public address with Friendbot, put only the secret key in `STELLAR_AUDIT_SECRET_KEY`, keep `STELLAR_NETWORK=testnet`, and note that `STELLAR_AUDIT_PUBLIC_KEY` is currently unused. Never use Mainnet.

7. Start the application:

   ```text
   pnpm dev
   ```

   Open `http://localhost:3000`. Main routes are `/report` (reporter chatbot), `/login` (coordinator login), `/ops` (coordinator queue), `/ops/cases/[id]` (case detail), and `/verify/[auditId]` (audit verification). For a local-only demonstration without a login screen, set both `LOCAL_DEV=true` and `LOCAL_AUTH_BYPASS=true`; the bypass is disabled unless both switches are explicitly enabled and must never be enabled in a deployed environment.

8. Run the verified offline checks:

   ```text
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```

   `pnpm test:e2e` requires a separately running `pnpm dev` server, process-level `DATABASE_URL`, and process-level `E2E_COORDINATOR_EMAIL` plus `E2E_COORDINATOR_PASSWORD` for coordinator scenarios in the shell that runs the test. Without those live settings, the Playwright scenarios skip.

## Memory guidance

- Do not run a local PostgreSQL stack on the demonstration computer; use managed Neon Free.
- Keep Ollama concurrency at one.
- Keep the context at 4K unless measurements prove 8K is safe.
- Pass Granite confirmed case facts and only the latest eight messages instead of the full transcript.
- Close unrelated memory-heavy applications before running the complete prototype.
- If output quality is insufficient, evaluate a larger model only after the 3B workflow is stable.

## How IBM Bob was used

GPT-5.6 Sol with Max reasoning created the implementation plans, lean MVP scope, chatbot contract, architecture, safety rules, and validation gates.

IBM Bob was the primary implementation tool. Its manager delegated the six lean-MVP phases to worker subagents. The phase record in `docs/bob-development-log.md` contains Bob's reported worker assignments, implementation notes, commands, and validation results across the scaffold, Neon data/auth, Ollama/Granite chatbot, coordinator workflow, Stellar Testnet anchoring, and finalization. It is a record of reported work, not independent tool-level authorship proof.

After IBM Bob's 40 free tokens were exhausted, Codex with GPT-5.6 Luna Max workers was used only to update this README. Codex did not implement application features; those remained IBM Bob's work.

The current validation status is summarized above; the Bob log retains the phase-level commands and reported results.

## Useful documentation

- [IBM Bob documentation](https://bob.ibm.com/docs/ide)
- [IBM Granite documentation](https://www.ibm.com/granite/docs/)
- [Ollama on Windows](https://docs.ollama.com/windows)
- [Ollama memory and concurrency configuration](https://docs.ollama.com/faq)
- [Next.js documentation](https://nextjs.org/docs)
- [Vercel Next.js documentation](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Neon documentation](https://neon.com/docs)
- [Drizzle ORM documentation](https://orm.drizzle.team/docs/overview)
- [Stellar developer documentation](https://developers.stellar.org/)
