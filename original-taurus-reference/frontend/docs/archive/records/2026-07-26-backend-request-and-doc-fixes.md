# 2026-07-26 — Chat/agent-unification request + contract doc fixes

Two documentation deliverables from the course-correction: the backend request that states
the chat/agent/persona model, and corrections to stale contract details the live docs had
wrong.

## New backend request: chat & agentic-work unification

```
docs/backend-requests/chat-agent-unification.md   (Priority High, Open)
```

States the model the user asked for: **the chat is the always-on user-facing interface;
the agentic endpoints are the execution layer beneath it.** Every chat carries a persona;
Actions/Plans are modes of a chat and spawn tasks *from* the chat; a task adopts the chat's
persona by default (or a declared one) and speaks back through the chat, with the persona
relaying the task's raw output as a user-facing turn. Proposes a per-chat `persona` field, a
task persona defaulting to the chat's, and task output surfacing as chat turns — while noting
Omega owns the specifics. Cross-linked from `ai-agent.md`; registered in the requests README
(and `ai-agent` marked "partially shipped" since B2a/B2b wired chats/turns/tasks/attachments).

## Contract corrections in the live docs

```
docs/integration/current/2026-07-25-integratable-now.md
  - Templates: `TemplateInfo{ isTemplate, variables[] }` (was `contextVariables[]`);
    noted create-from-template via POST /documents {fromTemplateId}.
  - Resource access: PATCH-only + owner-only, read off the summary (was implied GET/PUT).
  - Windowed rows: dropped `/missing` + `/missing/changes` — NO such route exists in Omega.
  - Organizations + G4 marked shipped; recommended-order recut to shipped/next/deferred.
docs/integration/current/ORIENTATION.md
  - Shipped list gains B2b/G4/Organizations/B6; What's-next points to the master plan.
  - "Decisions locked" gains the interim-persona note + the companion-format rule.
AGENTS.md
  - Drift rule now names `scripts/verify-companions.mjs` and states companions are
    multi-section, never a single whole-file fence.
```

These were real inaccuracies discovered while verifying contracts against Omega source:
`/missing`/`/missing/changes` were listed as row-windowing routes but do not exist; the
template descriptor field is `variables`, not `contextVariables`; and resource access/pin are
PATCH-only writes read back off the resource summary. Fixing them now prevents building the
remaining features against a wrong contract. The persona note records that today's picker is a
stopgap for the per-user default until the unification request ships.
