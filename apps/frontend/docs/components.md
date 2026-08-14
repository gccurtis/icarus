# Components

What the frontend needs to build, and what already exists to build it from.

Three tiers. **Primitives** are vendored from shadcn-svelte and carry no product
meaning. **Shell** is the frame — chrome that belongs to no resource. **Surfaces**
are the product, and they are where nearly all the work is.

Nothing below is invented. Every entry traces to a capability in
`apps/backend/src/capabilities`, a resource in `apps/backend/docs/reference`, or
a requirement in [`style/system/interaction/theory.md`](style/system/interaction/theory.md).

## Status key

| | |
| --- | --- |
| **built** | exists and works |
| **stub** | exists as a placeholder with no behaviour |
| **backed** | a primitive covers it; needs composing, not designing |
| **design** | needs designing before it can be built |

---

## The obligation list

`interaction/theory.md` names ten paths that must be discoverable and operable
by both mouse and keyboard. Each is a component commitment, and together they
are the minimum bar for the product to be usable. Everything else in this
document exists to serve them.

| Path | Component | Status |
| --- | --- | --- |
| Create, open, inspect the primary objects | Resource opener, object header | design |
| Search across everything in scope | Command palette | backed (`command`) |
| Inspect the selection, change its properties | Inspector views | stub |
| Coordinate work spanning more than one object | Tab strip, drawer | stub |
| Insert and inspect live objects | Live object block, insert menu | design |
| Inspect provenance — what produced it, from what, when | Provenance popover, lineage view | design |
| Refresh, detach, revert a live binding | Binding controls | design |
| Review derived and agentic changes, accept or revert | Review bar, change diff | design |
| Recover from a mistake | Undo affordance, revert | design |
| Understand current state, see sync status | Status bar | stub |

Six of the ten need designing. That is the honest size of the gap.

---

## Shell

The frame. Lives in `$lib/shell`, renders under `/app`, persists across every
session.

| Component | Notes | Status |
| --- | --- | --- |
| Topbar | Brand, global actions, command trigger, theme axes | stub |
| Tab strip | Permanent prefix, transient tabs, close, reorder, overflow | stub |
| Tab | One session. Needs dirty, live, and resolving states | design |
| Context panel | Rail plus content view | stub |
| Activity rail item | Icon, label, active state, per resource kind | design |
| Context content host | Renders the active activity's view | stub |
| Work surface | The route's region; the only part a route owns | built |
| Inspector | Breadcrumb ancestry, resolved view, sections | stub |
| Status bar | Sync, queue, connection. Never interrupts | stub |
| Drawer host | Right edge, overlays without reflowing, supersedes inspector | design |
| Resize handle | Range-clamped, collapse below threshold | backed (`resizable`) |

The four capability runtimes — `session`, `workspace`, `context`, `inspector` —
are **built** but consumed by nothing yet. Wiring the shell to them is the next
structural step.

---

## Trust and provenance

The mandate makes this first-class visual material, not fine print: *"Derived
output that cannot show where it came from is not finished, and must not look
finished."* Nothing here exists yet, and nothing here is optional.

| Component | Answers | Backed by |
| --- | --- | --- |
| Provenance popover | What produced this, from what, when | `popover`, `hover-card` |
| Lineage view | The full derivation chain, one step at a time | `accordion`, `breadcrumb` |
| Confidence indicator | How sure is this | `progress`, `badge` |
| Staleness badge | What changed underneath, and refresh | `badge`, `alert` |
| Attribution chip | Human or agent, which run | `avatar`, `badge` |
| Review bar | Accept or revert derived changes | `button-group`, `alert` |
| Change diff | What exactly would change | design — no primitive |
| Binding controls | Refresh, detach, revert a live value | `dropdown-menu` |
| Run status | Progress plus current stage, never a bare spinner | `progress`, `spinner` |

---

## Resource surfaces

One per resource kind. Each needs a work-surface view, a context activity set,
and inspector views for what it can select.

### Document — `resource-general/document`

The first and most demanding surface.

| Component | Status |
| --- | --- |
| Document editor | design |
| Block controls — insert, drag, reorder | design |
| Text formatting toolbar — next-text and selection | backed (`toggle-group`) |
| Table block | backed (`table`) |
| Live object block — embedded derived value | design |
| Comment anchor and thread | design |

Its inspections are already modelled in
`capabilities/session/types.ts`: `document-next-text`,
`document-text-selection`, `document-table`, plus the shared `formula` and
`prompt`.

### Rich content — `resource-support/rich-content`

The editing substrate the document surface sits on. Marks, blocks, and the
selection model. **design** — and the largest single unknown, since it decides
whether an editor library is adopted or built.

### Templates — `resource-support/templates`

Template picker, template editor, variable binding. **design**

### Connector, Context, General files — `resource-special`

| Component | Status |
| --- | --- |
| Connector configuration and health | design |
| Context assembly view — what is in scope | design |
| File list, preview, upload | backed (`table`, `empty`) |

---

## Data

`data/formula`, `data/manager`

| Component | Notes | Backed by |
| --- | --- | --- |
| Formula editor | Expression input with references | `input-group` |
| Formula chip | Inline resolved value with its own state | `badge`, `popover` |
| Data grid | Sort, filter, resize, edit | `data-table` — not installed |
| Cell editors | Text, number, date, select, formula | `input`, `select`, `calendar` |
| Column header | Type, sort, filter | `dropdown-menu` |

---

## Knowledge, collaboration, agentic

| Area | Component | Status |
| --- | --- | --- |
| `knowledge/output` | Derived output card, output list | design |
| `collaboration/comments` | Thread, reply, resolve, anchor | design |
| `collaboration/project` | Project overview — the permanent session | design |
| `agentic/persona` | Persona editor, persona picker | backed (`field`, `textarea`) |
| `platform/intelligence` | Prompt editor, run history, agent run card | design |

`project` is the one with a deadline attached: it is the resource kind behind
the permanent session that already exists in the session runtime, so `/app`
shows an empty work surface until it is built.

---

## Common patterns

Cross-cutting, and worth building once rather than per surface.

| Component | Notes | Backed by |
| --- | --- | --- |
| Object header | Kind icon, title, state, primary actions | `breadcrumb`, `button` |
| Kind icon | One glyph per resource kind, used everywhere | `@lucide/svelte` |
| Empty state | Named, with a route out. Per surface | `empty` |
| Error state | Names the failure and the recovery | `alert` |
| Loading state | Shape of what is coming, plus what is awaited | `skeleton`, `spinner` |
| Resource opener | Search and open any resource | `command` |
| Object picker | Choose a resource as a value | `command`, `popover` |
| Selection summary | What is selected, when it is more than one thing | design |

---

## Primitives

42 installed under `$lib/simple-components`, vendored from shadcn-svelte and
bridged to our tokens in `style/shadcn-bridge.css`. All are exercised on
[`/demo`](../src/routes/demo).

Three carry deliberate local edits — `button` (named hover tokens), `tabs`
(selected state), `resizable` (drag affordance) — and a further six were
repaired for bugs that made their classes inert. Those repairs are noted where
they occur.

### Not installed, and why

| Component | |
| --- | --- |
| `button-group`, `item`, `aspect-ratio` | Worth adding. `button.svelte` already references `button-group` four times |
| `data-table` | Highest value remaining, but adopting TanStack is a data-grid architecture decision |
| `calendar`, `range-calendar` | Needed eventually; no dated surface designed yet |
| `chart` | Needs a `--chart-1…5` family the bridge lacks, and may conflict with a separate dataviz system |
| `menubar` | `dropdown-menu` covers the disclosure ladder unless a persistent bar is wanted |
| `drawer` | Bottom-sheet pattern; our drawer is right-edge and `sheet` covers it |
| `form` | Pulls superforms/formsnap — a form-handling decision |
| `sonner` | Toasts interrupt; the mandate says status never does |
| `navigation-menu`, `input-otp`, `native-select` | Wrong pattern, no use case, redundant |

---

## What this implies about order

The shell is stubs and the runtimes are unconsumed, so **wiring the shell to the
session runtime** unblocks everything else — tabs, the rail, and the inspector
all read from it.

After that, `project` is the forced next surface, because a permanent session
already points at it.

The provenance and review components are the ones most likely to be deferred and
least safe to defer: they are what makes derived work trustworthy, and retrofitting
trust into a surface built without it means rebuilding the surface.
