# What Alpha needs to build

**This is our work.** For work *Omega* owes us, see
[`backend-requests/`](../backend-requests/README.md) — that directory is the mirror of this one
and the two never mix: if a line item here is blocked on the backend, it says so and links
the request.

Kept current, not dated. When something ships, delete its section here and let the change
record in [`archive/records/`](../archive/records/) hold the history.

**Deciding not to build something is a roadmap entry too**, so the reasoning lives beside the
plans rather than in its own directory — see [What we are not building](#what-we-are-not-building)
at the bottom.

---

## 1. The library spaces — wire Agents, Context, and Templates up

**Status: all three consoles are built and shipped (2026-07-29); the data behind them is mocked
and badged.**

`/library/context` and `/library/templates` render a real
[library console](../../src/lib/features/library/LibraryConsole.svelte.md) — owner scope, search,
set algebra with a live resolved list, template previews, authored context slots, sharing and
provenance. `/library/agents` (+ a sub-route per personality) renders the
[Agents console](../../src/lib/features/library/AgentsConsole.svelte.md) — a cross-project task
monitor with a steering panel, and versioned personality authoring; it replaced the workspace's
permanent Agents tab, which could never honestly show cross-project work from inside one
project's shell. Everything runs on fixtures
([`library-mock.ts`](../../src/lib/features/library/library-mock.ts.md),
[`agents-mock.ts`](../../src/lib/features/library/agents-mock.ts.md)) under a **Mock** badge;
unbuilt actions toast plainly instead of pretending.

**The open question "what is a context asset?" is answered** — and it was answered in Omega's
source the whole time. A context is a **named, nestable set of resource references**
(`{includes, excludes}` resolving to leaf resources, `core/capability/contexts`), and this design
adds one field to it: a `description` that both labels it in pickers and is sent to the agent as
guidance. A template is a document with `isTemplate` plus named `ContextVariable`s — which are
**not** prompt placeholders but named requirements for background material that a library context
fills.

**Blocked on:** [owner-scoped contexts and templates](../backend-requests/asset-library-owner-scope.md)
and [the Agents console scope](../backend-requests/agents-console-scope.md). Contexts, templates,
and personas are all complete in Omega but **project-scoped**, so nothing can be reused in the
next project; the agents request adds the two task asks (a cross-project list with project
attribution, and — the one genuinely new capability — steering a running task).

Our work as they land, in order:

- **Adopt `description`** the day it ships — one field, already in the UI.
- **Replace the fixtures with real clients**, one slice at a time. Templates first: `GET
  /documents/templates` and `POST /documents {fromTemplateId}` already exist and
  [`NewTabStage`](../../src/lib/features/stages/new-tab/NewTabStage.svelte.md) already calls
  them, so the per-project half is real today.
- **Extract a shared table primitive.** The resolved-resources list mirrors
  [`ResourceTable`](../../src/lib/features/stages/shared/ResourceTable.svelte)'s row grammar
  without sharing code, and `components/Table.svelte` cannot serve (header row baked in,
  string-only cells, no icon column). Both surfaces should use one primitive — and it must
  **virtualise**, because a whole-project context resolves to thousands of rows.
- **Retire the second templates surface.** The rail panel and its modal
  ([`features/shared/templates/`](../../src/lib/features/shared/templates/TemplatesPanel.svelte))
  still run on their own `mock-templates.ts`, unaware of the library. Two template surfaces, one
  real and one fake, is exactly the drift the repo tries to avoid.
- **Decide where a template's `Edit` goes** — the console's preview has the button and it toasts.
  Likely the real document editor rather than a modal, since a template *is* a document.
- **Make a template** — still a toast in the rail panel; make it capture the real document/deck.
- **Un-mock the Agents monitor** when the cross-project task list lands (it alone makes the
  monitor real), and the personality pages when owner-scoped personas land — the definition
  editor, revisions, and per-persona history all have real endpoints today, just project-scoped.
- **Drop or wire the steering composer** once Omega answers the capability question in the
  agents request: if a running task cannot consume mid-flight input, the composer goes, honestly.

## 2. The whole project as the default context

**Status: decided, blocked on the backend.**

The Quarterback's context should default to **the whole project**, not the open document. The
decision (2026-07-28) is deliberate about what it replaces: an earlier idea to auto-open the
context dropdown on first chat so the user can see what is selected. With the whole project as
the default, that confusion goes away and the dropdown stays closed. If anyone later wants to
narrow it, the picker is right there.

**Blocked on both halves of the Quarterback context gap:**

- [Chat turn context items](../backend-requests/chat-turn-context-items.md) — lets us send the
  open document (and the selection) with each turn. Small; ships first.
- [Automatic document → knowledge ingestion](../backend-requests/document-knowledge-ingestion.md)
  — makes project-wide grounding real.

**Our work when they land:** send context items per turn from the picker's enabled sources,
flip the dock's default to project-wide, and un-badge the context toggles that currently say
"not applied."

## 3. The other resource editors

**Status: two of five kinds have a stage.**

`ResourceKind` is `document | spreadsheet | slides | chat | general`. Users can *create* all of
them — [`NewResourcePanel`](../../src/lib/features/stages/new-tab/NewResourcePanel.svelte) and
Overview's create column both offer document, sheet, slides, and chat — but
[`WorkSurface`](../../src/lib/features/shell/WorkSurface.svelte) only dispatches `document` and
`slides`. **A spreadsheet or chat resource opens to a generic placeholder**, which means we
ship a create button for something that cannot be opened.

To build:

- **Fix the slide editor first.** The user's verdict from the live review: *"it's kind of in
  shambles."* Start with an audit against the real editor, not a rewrite — the stage is nine
  components around a Fabric canvas (`features/stages/slides/`), so the question is which
  parts are wrong, not whether to keep it. Write the findings down before changing anything.
- **The spreadsheet stage.** Omega has a formula capability; scope what it supports before
  designing the surface.
- **The chat resource stage.** Note this is a *resource* kind, distinct from the Quarterback
  dock — decide whether it is a separate surface at all, or whether creating a "chat" resource
  should just open the dock. **If we decide against it, remove it from the create menus** —
  offering a create button with no destination is the kind of dishonesty this repo does not
  ship.

## 4. Validate everything works, live

**Status: continuous.**

The live review is finding real bugs that the suite did not (a missing app-wide `Toaster`, an
expired session leaving the UI half-alive, the Quarterback answering from an empty lattice).
Each one is now covered by a test. Keep the loop going: **when a live finding lands, write the
test that would have caught it, then fix it.**

Standing gates for every change: `pnpm check`, `pnpm test`, `pnpm build`,
`node scripts/verify-companions.mjs <files>`, the full `pnpm test:e2e`, and a change record.

**There is no list of failures you may ignore.** Every e2e failure is real until diagnosed —
product bug, stale assertion, or harness defect — and which one gets established by
measurement. `persona-and-surfaces.spec.ts` can still fail on the Omega bug
[filed here](../backend-requests/ask-turn-500s.md); that is a known *cause*,
not a permission slip, and it must never be "fixed" by loosening the assertion.

**Adopt the centralized logger.** [`src/lib/logger.ts`](../../src/lib/logger.ts) was built
2026-07-28 and is used by the e2e diagnostics, but app code still calls `console.error`
directly in a few places (`systems/documents/collaboration.ts` is the clearest). Migrating
them is small and makes the app's own stream complete. The larger prize is a production sink:
`addSink` is the only call needed, and no call site changes.

## 5. Adopt document presence — Omega already built it

**Status: ready to build, nothing blocking.** Found by auditing our own backend requests on
2026-07-28: Omega shipped a per-document presence capability on **2026-07-26**, and we never
noticed — we filed a request asking for it the next day and carried on polling.

What exists and we are not using:

- `GET /documents/:documentID/collaboration` — per-document, includes the caller, collapses a
  user's multiple tabs, project-authorized, capped at 20. Returns `openUsers[]` with identity
  and access **and** a `lastEdit` block.
- `PUT` / `DELETE /documents/:documentID/presence` — heartbeat and leave.
- A **30-second server-side TTL**, so a crashed tab disappears on its own.

All of it lands in one file, `systems/documents/collaboration.ts`:

- Replace the `GET /sessions` poll (project-wide, filtered client-side by `currentDocumentId`)
  with the document read, mapping `openUsers[].identity` and `.access` onto
  `DocumentCollaborator`.
- Heartbeat `PUT …/presence` on an interval **well under 30s** — 10s is the natural third —
  and `DELETE` on unmount and tab-hide, replacing the `/sessions/current` writes.
- Delete `refreshLastEditor` and its history fetch: the same response carries `lastEdit`.

The e2e for it already has a shape to follow — two contexts on one document, asserting the
avatar strip. What stays missing afterwards is only a push channel and an arrival timestamp,
which is all that
[the rewritten request](../backend-requests/live-collaboration-presence.md) now asks for.

## 6. Adopt the backend requests as they land

Each request names its own front-end adoption work; it is small in every case.
[Mark payload validation](../backend-requests/document-mark-payload-validation.md) needs us to
mirror Omega's rules at our boundary,
[persona override](../backend-requests/persona-override-per-turn.md) turns the persona
picker into a per-turn control, and
[live presence](../backend-requests/live-collaboration-presence.md) replaces our 30-second poll.

---

## What we are not building

These are **decisions, not backlog** — each has a file here explaining the reasoning, so a
future reader finds an answer instead of re-opening the question. Omega's
[backend-requests README](../backend-requests/README.md) mirrors them under "Deliberately not
requested" so nobody builds them from that side either.

| Not building | Why, in one line |
| --- | --- |
| [Notifications feed](deferred-notifications-feed.md) | Omega ships `GET /notifications`; the Activity feed already covers the need, and a second stream would compete with it. |
| [pdf / docx import & export](deferred-pdf-docx-import-export.md) | Markdown round-trips today; pdf export in particular lost its structural basis when pagination was deleted. |
| Document row windows | Withdrawn. Pagination and windowing were deleted outright — the whole document is loaded and diffed, an accepted ceiling rather than a gap. |

## Open questions worth deciding before building

1. ~~**What is a "context asset"?**~~ **Answered 2026-07-29** — see §1. A context is a named,
   nestable set of resource references plus a description; a template declares named slots that a
   context fills. Both were already modelled in Omega; the only thing missing was owner scope.
2. **Convert text → prompt.** Deferred with a note in
   [`TemplatesPanel.svelte.md`](../../src/lib/features/shared/templates/TemplatesPanel.svelte.md):
   an AI classifies which text is prompt versus content and auto-generates context slots. Now
   unblocked in principle, since slots are defined — revisit when the library is wired.
3. **Does the chat resource kind survive?** See §3.
4. **Where does `Edit` on a template lead** — the real document editor, or a modal? See §1.
