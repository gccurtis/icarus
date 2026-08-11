# Documentation alignment with agent, persona, and session capabilities

The agent, persona, and session capabilities — plus the identity/profile
enrichment of records 0055–0057 — shipped and were wired into the running server,
but several higher-level documents still described the pre-integration world:
the orientation and architecture overviews named seven capabilities, the
Intelligence tool-use loop was still called "unwired," Quarterback Ask was still
"unimplemented," and the route/schema references omitted whole endpoint families.
This record aligns the stale documentation with the current code and repairs
companion-doc drift.

No production behavior changed. The only source edit is a corrected comment; the
only source *deletion* is an out-of-convention companion doc.

## Companion docs (`core/**/*.go.md`)

- **Regenerated `document/layout.go.md` and `storage/sqlite/sqlite.go.md`.** Both
  use the single-block "Complete source" style, and both had drifted from their
  source (layout by ~11 lines, sqlite by ~45, around the persona/anchor
  additions). Their lone ` ```go ` blocks were rewritten to reproduce the current
  source verbatim, restoring the invariant that concatenated code blocks equal the
  file.
- **Removed `capability/session/session_test.go.md`.** The companion convention
  excludes test files; this was the only `*_test.go.md` in the tree, an anomaly.
- **Corrected the `Sessions` option comment in `transport.go`** (and its verbatim
  companion) from `/projects/:projectID/sessions/*` to the actual `/sessions/*`
  presence routes.

## Orientation (`docs/orientation/README.md`)

- Added **agent**, **persona**, and **session** to the repo-map capability list,
  the §5 capability table, and the §6 vocabulary. Added the newer `docs/plans`,
  `docs/checklists`, and `docs/support` directories to the repo map and the
  documentation-layers section.
- Corrected the "tool-use loop is library-only, unwired" and "planned Quarterback
  Ask consumer" claims: the loop now has a production caller (agent Plan/Action
  tasks); Ask alone remains built-but-unrouted.

## Architecture (`docs/architecture/**`)

- **`overview.md` / `README.md`** — capability count seven → ten; the layer
  diagram, the one-store-implements list, and the "where to go next" links now
  include agents, personas, and sessions; the tool-use/Ask status corrected.
- **New capability docs** — `capabilities/persona.md` and `capabilities/session.md`
  written from the code, and `capabilities/agents/README.md` describing the built
  capability (Ask library shape plus the wired Plan/Action tasks). The older
  `capabilities/agents/ask.md` was retargeted from "there is no agent capability"
  to a design page whose contract divergences from the built `Ask` are flagged.
- **`transport.md`** — the route table gained the session, agent, persona, and
  newer document routes (restore / purge / duplicate / diff / anchors /
  revision-hints); the project-scoped tier description and the `/users/:userID`
  projection were corrected.
- **`persistence.md`** — documented `project_sessions`, `document_anchors`,
  `personas`, `persona_versions`, `persona_defaults`, and `agent_tasks`; extended
  the store-interface table with `session.Store` / `persona.Store` /
  `agent.TaskStore`; and brought the additive-column list current
  (`documents.lifecycle`/`trashed_at`/`creator_*`, `knowledge_sources.revision`,
  `project_sessions.user_email`, `agent_tasks.*`).
- **`configuration.md`** — documented the `agents` section (`default_persona`,
  `prompts`, `schemas`).

## Backend guide (`docs/backend-guide.md`)

- The endpoint reference gained the session, agent, persona, and document
  lifecycle/anchor routes; the `/users/:userID` projection was corrected; the
  `agents` manual was linked; and §6 notes that agent tasks are job-backed but use
  a `201` + poll-the-task pattern rather than `202`.

## A defect surfaced — and fixed (see 0059)

While mapping the session capability, the presence-activity middleware was found
to be **inert**: it type-asserted the request's access context to the session
package's local `accessContext` type, but the gate stores an `access.Context`, so
the assertion always failed and no activity `Event` was pushed. Presence advanced
only through the explicit `POST /sessions` / `PUT /sessions/current` calls, so a
user editing without repolling those endpoints could be swept as stale. This is
fixed in the same delivery — see
[0059](0059-session-presence-middleware-fix.md).

## Why

The `docs/architecture/` set and the orientation are meant to be grounded in the
code as it exists now; lagging three shipped capabilities makes them actively
misleading to a new reader or agent, and stale companion docs break a rule
reviewers enforce. This pass restores both. Recording the middleware defect as a
documented gap — rather than quietly fixing it here — keeps the change purely
about documentation.
