# Alpha remaining gaps — summary & decisions (2026-07-25)

Source: `taurus-alpha/docs/backend-requests/alpha-remaining-gaps-2026-07-25.md`.
This condenses that list, **re-verified against Omega `main`** today, into a
decision sheet you can sign off before we plan the build. The companion execution
plan is [`alpha-remaining-gaps-implementation.md`](alpha-remaining-gaps-implementation.md).

## Bottom line

Only **four** Alpha surfaces still lack an Omega backend, and **all four are
P3** — none blocks document editing or the AI cockpit. Everything else Alpha
mocks (references, comments, files, Markdown import/export, AI-create, custom
typography, prompt blocks, chats/tasks/personas, anchors, name manager) now has a
real, wired Omega route. So this is polish, not a blocker list.

Two of the four are **product decisions** (do we even build them in the backend),
one is **additive format work**, and one is a **small model gap plus one real
feature**. My recommendation is to build the two quick, unambiguous pieces now,
get a decision on the rest, and defer the largest.

## The four gaps (verified state → recommendation)

### G1 · Document templates — P3 — **product decision**
- **Verified:** no template capability in Omega. `/documents/duplicate` clones an
  existing doc; `/resources/generate` AI-generates one — neither is a curated
  library.
- **Alpha wants:** "start a new document from a template" (mocked).
- **Decision:** is a template a **backend** resource (a shared/curated library) or
  a **frontend-only** concept (canned starting content the client owns)?
- **My recommendation:** **frontend-only for v1** — the client ships a few canned
  documents and creates them via the existing `POST /documents`. Revisit a backend
  library only if templates must be user-created, shared, or per-project. Zero
  backend work now; hide nothing (the client just owns the content).

### G2 · User notifications — P3 — **defer (recommend)**
- **Verified:** no notifications capability or routes.
- **Alpha wants:** a "Notifications" settings section (mocked).
- **My recommendation:** **defer.** A real notifications service (preferences +
  a feed + delivery) is large and out of near-term scope, and nothing depends on
  it. Hide the settings section for now. Build later as its own project.

### G3 · Non-Markdown export/import (PDF, DOCX) — P3 — **additive**
- **Verified:** **Markdown** export (`GET /documents/:id/export`) and **import**
  (`POST /documents/import`) already ship (records 0066) — Markdown is *ready to
  wire in Alpha now*. Omega's own note marks pdf/docx as follow-ups.
- **Alpha wants:** additional formats in the Export/Import dialogs.
- **My recommendation:** **wire Markdown-only now** (no backend work — it exists),
  and treat **pdf/docx as a separate, later increment**. Real serialization work
  (a Go library or a conversion service), medium/large, and lower value than a
  clean Markdown path. Offer only Markdown in the UI until they land.

### G4 · Resource visibility / options — P3 — **small gap + one real feature**
- **Verified:** the resource `Summary` model is `{id, kind, name, createdAt,
  updatedAt}` — **no** visibility or options fields. Confirmed gap.
- **Alpha wants** (from `ResourceSettingsDialog.svelte`, all mocked):
  1. **Visibility:** `private` | `anyone with link` — per **resource**.
  2. **Options:** a "**Pin to top of the table**" toggle, plus a placeholder for
     future kind-specific settings.
- **This splits into three:**
  - **G4a · `pinned` flag — trivial, build now.** A boolean on a resource, sorted
    first in listings. Clear, small, no decision needed.
  - **G4b · per-resource visibility (`private`|`link`) — real feature, needs a
    decision.** "Link" means a **resource-scoped share link** (a token that grants
    access to one document), analogous to the existing *project* link system but
    at the resource level. That's a genuine capability (token store + a
    link-authenticated read path), not just a field. **Decision:** do we want
    per-resource sharing, or is project-level sharing enough for now?
  - **G4c · kind-specific "Options"** — placeholder only, no concrete requirement
    yet. **Defer.**

## Recommended sequencing

| # | Item | Type | Effort | Recommendation |
|---|---|---|---|---|
| 1 | G4a resource `pinned` | build | Small | **Do now** — clear, self-contained |
| 2 | G3 wire Markdown import/export | frontend-only | None (backend done) | **Do now** — already backable |
| 3 | G4b per-resource visibility/link | build | Medium | **Decide first**, then build |
| 4 | G1 templates | decision | None → Medium | **Decide**: frontend-only (recommended) vs backend library |
| 5 | G3 pdf/docx | build | Medium/Large | **Defer** — separate increment |
| 6 | G2 notifications | build | Large | **Defer** — own project |

## Decisions (2026-07-25) — resolved

The gaps were reshaped after review. Locked calls:

- **G1 Templates — BUILD, as a document-level object.** Not a separate resource
  type — the document `Base` gets an **optional `template` object, like `layout`**:
  when present it holds named **context variables** (`{name, description,
  boundContext}`) and an optional default persona. Building = define + bind the
  variables (`IsTemplate=true`). Using = duplicate (backend **clears the
  bindings**), then the client prompts the user and calls one endpoint to **set a
  variable's context across the whole document**, then refreshes. Also adds an
  **optional per-prompt-block persona** (falls back to the template default, then
  the prior/default). Rides the changeset machinery — no bespoke storage. → Phase 2.
- **G2 Notifications — BUILD, small.** Not a feed/inbox — the ability to **push a
  transient toast to a user** (e.g. "task done"), drained on the existing poll.
  → Phase 3.
- **G3 formats — Markdown only; pdf/docx ON HOLD.** Wire the shipped Markdown path
  now. pdf/docx (and any other formats) are **not built now** — revisited later as
  their own pure-Go, no-commercial-library increment.
- **G4 — BUILD, sharing + organizations.**
  - **`pinned`** — trivial. → Phase 1.
  - **Visibility / access** — add **organizations** (users belong to orgs) and
    per-resource **access scoping**: private, anyone in the project, anyone in the
    organization, specific people, or any combination. Interacts with the
    "everything is project-scoped" rule → one design decision (narrowing vs
    broadening). → Phase 4.

Execution order and detail (task-based, no time estimates):
[`alpha-remaining-gaps-implementation.md`](alpha-remaining-gaps-implementation.md).
