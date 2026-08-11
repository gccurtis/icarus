# Backend request — owner-scoped personalities, cross-project task visibility, task steering

**Priority:** **High** · **Status:** Open · **Filed:** 2026-07-29
**Blocks:** the `/library/agents` screens having real data. The Agents console is built and
shipped — a cross-project task monitor with a steering panel, plus versioned personality
authoring — and every row of it is a badged mock.

> **Standalone.** Everything needed to build this is in this document. It is the sibling of
> [owner-scoped contexts and templates](asset-library-owner-scope.md) — same scope disease, a
> different capability — plus two agent-task asks that have no analogue there.

"Personality" is Alpha's product word for what your API calls a **persona**. Same thing.

## What already works — please do not rebuild any of it

**Personas are complete** (`core/capability/persona`, routes in `core/transport/routes.go`):
CRUD, a default (`GET/PUT /personas/default`), **versioned revisions**
(`POST /personas/:id/revisions`, `GET …/versions`, `GET …/versions/:version`), and — the part
we lean on hardest — **per-persona task history** (`GET /personas/:personaID/tasks`). Tasks
snapshot the persona version they ran as. All of this is exactly what the personality page
shows; none of it needs to change.

**Agent tasks are complete as a lifecycle**: `POST /agent/plans` / `POST /agent/actions` spawn
durable tasks, `GET /agent/tasks` / `GET /agent/tasks/:taskID` read them (state machine, todos,
plan revisions, failure), `POST …/plans/:planID/accept` approves a plan. Alpha's dock drives all
of it today.

## The gap

Everything above is `scoped` — gated by the session's selected project.

| What a user wants | Possible today? |
| --- | --- |
| Reuse a personality from project A in project B | **No** — personas are project rows |
| Give the org a shared "Analyst" personality | **No** |
| See every agent working for me, across projects, on one screen | **No** — `GET /agent/tasks` is per-project |
| Tell a running task "weight the enterprise interviews heavier" | **No such capability** |

## What we need — three independent pieces, in priority order

### 1. Owner-scoped personalities

The same shape as [asset-library piece 2](asset-library-owner-scope.md): library records owned by
a **user** or an **organization**, reachable with **no project selected**, org-role-gated for
editing (`member` uses, `admin`/`owner` edits), promote/bring-in as **copies** (a project's
persona stays a project persona; promoting snapshots it up, bringing in copies it down —
version history restarting at the copy is fine and honest). Per-asset sharing (`use`/`edit`)
matches that request's piece 4 and can trail.

If you build the two requests together, one library mechanism serving contexts, templates, and
personas is obviously right — we split the files only because the capabilities are different
owners in your codebase.

### 2. Cross-project task visibility

One read: **every task belonging to projects the caller is a member of**, newest activity first.

```jsonc
GET /agent-tasks?scope=member          // NOT project-scoped
→ { "tasks": [ { …existing task shape…, "project": { "id": "…", "name": "…" } } ] }
```

- The existing task shape is already right (state, objective, todos, persona, timestamps) —
  the only addition is **project attribution**, since the caller is no longer standing inside
  one.
- Authorization: strictly the caller's project memberships; a shared personality must NOT leak
  tasks from projects the caller cannot see.
- Polling is fine (the dock already polls single tasks). A push channel is the same nice-to-have
  it is for presence — do not block on it.

### 3. Steer a running task

The capability question first, honestly: **can a running task consume mid-flight user input at
all?** If the engine's loop cannot, tell us and we will drop the composer rather than fake it.
If it can:

```jsonc
POST /agent/tasks/:taskID/messages   { "message": "Weight the enterprise interviews heavier." }
→ 202 — and the task's record shows the message and the agent's acknowledgement
```

- Treat it like caller-supplied context: **untrusted user material**, never promoted into the
  system instruction — the same posture as `ContextItem` in the chat-turn request.
- Only meaningful for `queued` / `running` / `waiting`; a settled task should 409.
- The exchange (our messages + the agent's acknowledgements/updates) must be readable back on
  the task, because the monitor renders it as a transcript.

This is the piece with real engine work in it, and it is worth it: "tell the agent to keep
going / change course without killing the task" is the whole point of a monitor you can act
from. Ordering: 2 gives us a real monitor, 1 gives us real personalities, 3 makes the monitor
worth staring at.

## How we will verify

1. Create a user-owned personality with no project selected → 201; visible in the library list;
   an org `member` of an org-owned one gets 403 on PUT, an `admin` 200.
2. Promote a project persona → library copy; bring it into another project → new project persona
   with the definition intact; editing either leaves the other unchanged.
3. `GET /agent-tasks?scope=member` returns tasks from two different projects with correct
   `project` attribution, and none from a project the caller left.
4. Post a message to a `running` task → 202, and the task's readback contains it; post to a
   `completed` task → 409.
5. A task spawned under a brought-in personality records the persona version it ran as (already
   your behaviour — just confirming it survives the copy).

## Current front-end fallback

`/library/agents` and `/library/agents/[id]` are shipped on fixtures
(`src/lib/features/library/agents-mock.ts`), badged Mock; the steering composer toasts that the
backend is missing instead of pretending to send. Piece 2 alone un-mocks the monitor; piece 1
alone un-mocks the personality pages. We adopt each independently.
