# ReliefOps

ReliefOps is a human-supervised disaster coordination prototype. A public chatbot gathers relief requests while an operations dashboard helps coordinators review AI suggestions, take over conversations, set final urgency, organize tasks, assign responders, and track delivery.

The project is being built for the IBM AI Builders Wild Card Challenge. IBM Bob will be the primary development tool, IBM Granite will provide the core AI capability through Ollama, and Stellar Testnet will provide tamper-evident audit anchoring.

> ReliefOps is a student proof of concept, not an emergency service. Use synthetic demonstration data only. Do not submit real personal, medical, or disaster-victim information.

## Current status

The repository is currently in the planning stage. The authoritative, implementation-ready specification is in [docs/implementation-plan.md](docs/implementation-plan.md).

Implementation will be performed inside IBM Bob one phase at a time. Each phase has a validation gate that must pass before the next phase starts.

## Core product rules

- AI suggests urgency and explains its reasoning; a coordinator sets the final urgency.
- AI proposes tasks and resource matches; a coordinator approves assignments and dispatch.
- A coordinator can take over a chatbot conversation at any time.
- The AI must not send messages while a human controls the conversation.
- Messages, names, locations, documents, and photos remain off-chain.
- Stellar stores only compact Merkle-root commitments representing batches of audit records.
- A failure in AI or Stellar must never discard or block a relief request.

## Planned architecture

```text
Reporter browser ------+
Coordinator dashboard -+--> Local Next.js application
Responder portal ------+             |
                                      +--> Supabase Free
                                      |    Auth, Postgres, Storage, Realtime
                                      |
                                      +--> Ollama on localhost
                                      |    IBM Granite 4.1 3B
                                      |
                                      +--> Stellar Testnet
                                           Soroban audit contract
```

The demonstration computer runs Next.js, Ollama, and the browser. Supabase stays in its free managed cloud service to avoid consuming the demonstration computer's RAM. Stellar uses Testnet and fake XLM from Friendbot.

## Zero-cost development stack

| Component | Selection |
| --- | --- |
| Primary development tool | IBM Bob |
| Web application | Next.js, TypeScript, Tailwind CSS |
| Local AI runtime | Ollama |
| AI model | `granite4.1:3b` |
| Database, auth, files | Supabase Free |
| Blockchain | Stellar Testnet and Soroban |
| Source control | GitHub |

No paid service is required for the MVP. Remain on free plans and never switch Stellar configuration to Mainnet.

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

After IBM Bob creates `.env.example`, copy it to `.env.local` and use:

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

## Running locally

Once IBM Bob completes the initial scaffold:

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`.

Before a live walkthrough, warm up Granite to avoid a slow first response:

```powershell
ollama run granite4.1:3b "Respond with exactly READY"
```

When finished, release the model's memory:

```powershell
ollama stop granite4.1:3b
```

## Memory guidance

- Do not run a local Supabase Docker stack on the demonstration computer.
- Keep Ollama concurrency at one.
- Keep the context at 4K unless measurements prove 8K is safe.
- Pass Granite a rolling case summary and the last 8-12 relevant messages instead of the full transcript.
- Close unrelated memory-heavy applications before running the complete prototype.
- If output quality is insufficient, evaluate a larger model only after the 3B workflow is stable.

## IBM Bob development workflow

1. Open this repository in IBM Bob.
2. Give Bob [docs/implementation-plan.md](docs/implementation-plan.md) as the authoritative specification.
3. Complete only one implementation phase at a time.
4. Run the phase's required tests and validation gate.
5. Record the Bob mode, prompt, changes, tests, and commit in `docs/bob-development-log.md`.
6. Do not change the safety invariants or scope without updating the plan first.

The completed challenge README will eventually include the final problem statement, solution, architecture, selected Wild Card theme, and documented evidence of how IBM Bob was used. Those claims must reflect work actually completed in Bob.

## Useful documentation

- [IBM Bob documentation](https://bob.ibm.com/docs/ide)
- [IBM Granite documentation](https://www.ibm.com/granite/docs/)
- [Ollama on Windows](https://docs.ollama.com/windows)
- [Ollama memory and concurrency configuration](https://docs.ollama.com/faq)
- [Supabase documentation](https://supabase.com/docs)
- [Stellar developer documentation](https://developers.stellar.org/)
