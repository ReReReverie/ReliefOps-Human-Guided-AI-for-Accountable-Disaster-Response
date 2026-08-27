# Read This First: ReliefOps Page Overview

This guide gives teammates a quick, page-by-page understanding of the current ReliefOps demo. For installation, environment variables, Stellar Testnet setup, and verification commands, use [README.md](README.md).

> ReliefOps is a prototype, not an emergency service. Use fictional, synthetic demonstration data only.

## Table of contents

- [What ReliefOps demonstrates](#what-reliefops-demonstrates)
- [Page map](#page-map)
- [Features shared across pages](#features-shared-across-pages)
- [Demo Home](#demo-home)
- [Reporter Intake](#reporter-intake)
- [Coordinator Login](#coordinator-login)
- [Operator Dashboard](#operator-dashboard)
- [Case Detail](#case-detail)
- [Audit Verification](#audit-verification)
- [Status reference](#status-reference)
- [Recommended teammate walkthrough](#recommended-teammate-walkthrough)
- [Important demo boundaries](#important-demo-boundaries)

## What ReliefOps demonstrates

ReliefOps has three connected surfaces:

1. A reporter describes a fictional incident through a chatbot.
2. A human coordinator reviews the case, compares the AI recommendation with the available facts, takes over the chat when needed, sets the final urgency, and manages tasks.
3. A Stellar Testnet audit record lets someone check whether the stored chat-start metadata still matches the hash committed on-chain.

The main flow is:

```text
Demo Home (/)
    |
    +--> Reporter Intake (/report) --> creates a case and chat-start audit
    |                                      |
    +--> Operator Dashboard (/ops) --------+
                 |
                 +--> Case Detail (/ops/cases/[id])
                               |
                               +--> Chat Audit dialog
                               +--> Audit Verification (/verify/[auditId])

Coordinator Login (/login) protects the operator pages when local demo bypass is off.
```

## Page map

| Page | Route | Main user | Purpose |
| --- | --- | --- | --- |
| Demo Home | `/` | Presenter or teammate | Starting point and guided overview of the demo flow |
| Reporter Intake | `/report` | Reporter | Create and continue a fictional incident report through chat |
| Coordinator Login | `/login` | Coordinator | Authenticate before opening protected operator pages |
| Operator Dashboard | `/ops` | Coordinator | Review and prioritize all cases in one queue |
| Case Detail | `/ops/cases/[id]` | Coordinator | Review one case, control the chat, set urgency, manage tasks, and inspect its audit |
| Audit Verification | `/verify/[auditId]` | Anyone with the link | Compare the stored, recomputed, and Stellar on-chain hashes |

Routes containing `[id]` or `[auditId]` are dynamic. Open them through links in the application instead of typing placeholder text into the URL.

## Features shared across pages

- A warning banner states that ReliefOps accepts synthetic demonstration data only and is not an emergency service.
- The main navigation links to **Demo Home**, **Report Incident**, and **Operator Dashboard**.
- On a case-detail route, the navigation also displays a **Chat Audit** button.
- Reporter messages and AI output are rendered as plain text, not executable HTML.
- The interface is responsive and includes keyboard and focus support for its main controls and dialogs.

## Demo Home

**Route:** `/`

The home page is the presenter-friendly control center for the demo.

### Main features

- Two primary entry cards open **Reporter Intake** and the **Operator Dashboard**.
- A three-step explanation introduces the intended story: create a case, make the human decision, and verify the audit record.
- When full local demo bypass is enabled, the page shows up to four recent cases and four recent audit records.
- Recent-case shortcuts show only the public case reference, status, and creation time.
- Recent-audit shortcuts show the audit status and link to the verification page.
- If the database is empty or temporarily unavailable, the page keeps the main demo entry points available and shows a safe fallback message.

### Local-mode behavior

The recent activity panels appear only when both settings below are enabled:

```dotenv
LOCAL_DEV=true
LOCAL_AUTH_BYPASS=true
```

Without full bypass, the home page remains a public guided landing page but does not query and display recent local case or audit identifiers.

## Reporter Intake

**Route:** `/report`

This is the public, Telegram-inspired chat interface used to submit a fictional incident report.

### Main features

- The first message creates a case, stores the reporter message, starts the reporter's private browser session, and creates one pending `CHAT_STARTED` audit record.
- Stellar anchoring begins after the first message and database transaction are safely saved. A Stellar failure does not discard the report.
- After the case is created, the header displays its public case reference.
- Messages visually distinguish the reporter, ReliefOps AI, and a human coordinator.
- The page automatically scrolls to new messages and shows a typing/loading indicator while a response is pending.
- When `AI_PROVIDER=mock`, a **Simulated AI Preview** banner makes it clear that deterministic fixture responses are being used.
- The message input accepts up to 2,000 characters. Use the send button or `Ctrl+Enter`/`Cmd+Enter` to send; plain Enter inserts a new line.
- Network and submission failures are shown without discarding an already saved case.

### Human handoff behavior

- **Request a human coordinator** sends that request into the conversation for review. It does not itself grant coordinator control.
- The coordinator takes control from the queue or case-detail page by selecting the orange override control.
- While the case is in `HUMAN` chat mode, reporter messages continue to be saved but the AI does not reply.
- The page then labels the conversation as human-controlled and displays coordinator replies separately from AI messages.

## Coordinator Login

**Route:** `/login`

This page protects coordinator-only features when the full local demo bypass is disabled.

### Main features

- Accepts the coordinator's email address and password.
- Displays a safe validation error for missing or invalid credentials.
- Redirects a successful sign-in to `/ops`.
- In normal mode, authentication uses Neon Auth and requires a matching coordinator profile.
- With `LOCAL_DEV=true`, the application can use the configured local demo coordinator credentials.
- With both `LOCAL_DEV=true` and `LOCAL_AUTH_BYPASS=true`, the login page is skipped and redirects directly to `/ops` as **Demo Manager**.

The bypass is for the local hackathon demonstration only and must not be enabled on a public deployment.

## Operator Dashboard

**Route:** `/ops`

This protected page is the coordinator's case queue. Cases are sorted from newest to oldest.

### Information shown for every case

- Public case reference
- Case status
- Latest AI-suggested urgency
- Human final urgency
- Human-override state or control
- Age of the case

### Main actions

- Select any linked queue cell to open that case's detail page.
- Select the orange **!** override control to stop AI control, switch the chat to `HUMAN`, and open the case detail page.
- See an orange **Human control** badge when a coordinator already controls the conversation.
- Closed cases cannot be taken over again.

If authentication is required and no valid coordinator session exists, `/ops` redirects to `/login`.

## Case Detail

**Route:** `/ops/cases/[id]`

This protected page is the main coordinator workspace for one case.

### Case header and controls

- Shows the public case reference, case status, and current chat mode.
- **Mark Active** moves a case from `REVIEW` to `ACTIVE`.
- **Close Case** closes an eligible case.
- **Chat Audit** opens the audit dialog without leaving the case.
- A link returns to the case queue.

A case cannot close until a human final urgency is set and every approved task is `DONE`.

### Chat section

- Displays the complete reporter, AI, and coordinator transcript in chronological order.
- Shows exactly which actor sent each message and when it was sent.
- The orange **!** control switches the conversation from AI to human control.
- In `HUMAN` mode, the coordinator can write and send replies of up to 2,000 characters.
- **Resume AI** returns the conversation to AI mode.
- Coordinator replies are rejected unless the chat is currently in `HUMAN` mode.

### Facts and AI Urgency section

- Displays structured facts extracted from the chat, including incident type, location, people affected, immediate danger, medical needs, vulnerable people, essential needs, and access hazards.
- Shows the latest AI-suggested urgency, confidence, rationale, factor breakdown, and missing information.
- Displays communication-style cues in a separate, clearly labelled panel.
- Communication cues are non-diagnostic and cannot independently determine urgency.

### Human Final Urgency section

- Lets the coordinator select `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW`.
- Keeps the AI suggestion visible for comparison.
- Accepts an optional written reason for the human assessment.
- Stores the human decision separately from the AI assessment and shows the recorded result.
- Setting a human urgency moves an `INTAKE` case to `REVIEW`.

### Tasks and Audit section

- Shows AI-proposed and coordinator-created tasks in their saved order.
- Lets the coordinator add a task with an optional description and proposed owner.
- Unapproved tasks can be edited.
- A task can be approved only after the human final urgency is set.
- At most six tasks can be approved for one case.
- Task progress can be changed among `TODO`, `DOING`, and `DONE`.
- Displays the database audit status, audit ID, Stellar transaction hash, failure message, and verification link when available.
- A pending or failed Stellar anchor can be retried without creating a new audit record or changing its original hash.

### Chat Audit dialog

The dialog is available from the case controls and from the site navigation while viewing a case.

- `DB: ANCHORED` means ReliefOps saved the successful Stellar transaction and ledger metadata.
- `Stellar: VERIFIED` means the recomputed hash, stored database hash, and on-chain hash all match.
- It displays the chat start time, application anchor time, Stellar ledger-close time, record hash, audit ID, and transaction link.
- **Refresh** runs the verification check again.
- **Retry Stellar Anchor** appears for a pending or failed anchor.

`VERIFIED` means no mismatch was detected in the audited chat-start metadata. It does not prove that the incident report is true, and it does not place the message or reporter details on-chain.

## Audit Verification

**Route:** `/verify/[auditId]`

This public page provides a shareable verification view without exposing the private nonce, reporter identity, session data, or message contents.

### Possible results

| Result | Meaning |
| --- | --- |
| `VERIFIED` | The stored hash, server-recomputed hash, and Stellar on-chain value match. |
| `NOT_ANCHORED` | The database audit record exists, but it does not yet have a completed Stellar anchor. |
| `FAILED` | The hashes do not all match, or the expected Stellar value could not be retrieved. |
| `NOT_FOUND` | No audit record exists for the supplied ID. |

For a verified record, the page shows the safe record hash, first-message receive time, Stellar ledger-close time, audit ID, and a link to the transaction on the Stellar Testnet explorer.

## Status reference

### Case status

| Status | Meaning |
| --- | --- |
| `INTAKE` | The chatbot is still collecting or analyzing information. |
| `REVIEW` | The case is ready for human review or has received a human urgency decision. |
| `ACTIVE` | The coordinator has marked the reviewed case as operationally active. |
| `CLOSED` | The case has been closed after its completion guards passed. |

### Chat mode

| Mode | Meaning |
| --- | --- |
| `AI` | The configured AI provider may respond to reporter messages. |
| `HUMAN` | AI replies stop; the coordinator can reply directly. |

### Task status

| Status | Meaning |
| --- | --- |
| `TODO` | Work has not started. |
| `DOING` | Work is in progress. |
| `DONE` | Work is complete. |

Task approval and task progress are separate. An approved task must be `DONE` before the case can close.

### Database audit status

| Status | Meaning |
| --- | --- |
| `PENDING` | The audit record is saved but a successful Stellar submission is not yet recorded. |
| `ANCHORED` | The successful Stellar transaction and ledger details are stored. |
| `FAILED` | The most recent anchoring attempt failed; the case and chat remain saved. |

## Recommended teammate walkthrough

1. Start at `/` and explain the three-step demo loop.
2. Open `/report` and submit a fictional incident with enough detail for the AI to extract facts.
3. Note the public case reference and the AI or simulated-AI label.
4. Open `/ops`, find the new case, compare AI urgency with human urgency, and use the orange override control.
5. On `/ops/cases/[id]`, send a coordinator reply while the chat is in `HUMAN` mode.
6. Review the extracted facts, AI rationale, missing information, and non-diagnostic communication cues.
7. Set the human final urgency, review or edit tasks, approve the intended tasks, and move them through their statuses.
8. Open **Chat Audit** and explain the difference between `DB: ANCHORED` and `Stellar: VERIFIED`.
9. Open the `/verify/[auditId]` link to show the independent, shareable verification result.
10. Mark the case active, finish approved tasks, and close the case.

## Important demo boundaries

- Use synthetic data only.
- ReliefOps cannot dispatch responders or replace an emergency service.
- AI output is advisory. The human coordinator owns final urgency, task approval, communication takeover, and case closure.
- The public Vercel preview may use mock AI; the real Granite demonstration runs locally through Ollama.
- Stellar is permanently restricted to Testnet in this prototype.
- Testnet XLM has no monetary value.
- The Stellar record contains only a privacy-safe hash commitment, not the chat transcript or personal information.
- `/api/*` routes are internal application endpoints, not pages teammates should open during the demo.
