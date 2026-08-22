# Review

Lives at `src/lib/views/review/review.md`. Trees live in the concern documents
linked below.

## Purpose

One panel on a stage, what it turned out to be a function of, and what it turned
out to be made of. Rendered at `/demo/context`, `/demo/inspector` and
`/demo/workspace` — three routes, one view, differing only in which tree the
picker enumerates.

It exists because a gallery answers the wrong question. Seeing a panel tells you
whether it looks right; it does not tell you what it reads, what it hands to what,
or what would change if the data were different. This is the surface where a
reorganisation is proposed against something concrete: change a door at the top,
watch the stage and the composition column both move.

## Why there is no modal route

A modal is opened by an interaction inside one of the three. Reaching the
Function Builder by pressing the button on the Variables panel is the only way of
seeing it that is true to how it is reached, and a fourth route listing modals
would test a path nobody takes.

## Boundary

This view owns:

- the frame: the head, the stage, the composition column, and the one number that
  splits them;
- which panel is on the stage, and remounting when that changes;
- turning door recording on, and reading the log back after a render;
- the overrides a reader puts in front of a door, and putting them back;
- pointing at what a name on the right drew on the left.

It does not own:

- the panels. Each is loaded through the glob its route hands in and is otherwise
  opaque.
- what a panel reads. The doors are `$mock-capabilities`; this only records and
  intercepts them.
- what a panel is made of. Each primitive registers itself through
  [`$lib/trace`](../../trace/trace.svelte.ts); this only reads the tree.

## Public Contract

- **Entry:** [`review.svelte`](review.svelte)
- **Types:** `ReviewKind`, from [`shared/`](shared/shared.md)

| Kind | Name | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| Prop | `kind` | `ReviewKind` | Yes | Which tree this page is for, and what the stage does with it |
| Prop | `modules` | `Record<string, () => Promise<unknown>>` | Yes | The glob for that tree. Handed in because `import.meta.glob` needs a literal pattern, so the three routes differ by exactly one line |

## Dependencies

### Client models

| Door | Usage |
| --- | --- |
| `None` | The panels reach the mock model themselves; this view does not |

### Capabilities

| Browser door | Usage |
| --- | --- |
| `$mock-capabilities/read.svelte` | `watchDoors`, `doorCalls`, `overrideDoor`, `clearOverride` — the recording and the overrides |

### Composed views

| View | Root imported | Usage |
| --- | --- | --- |
| `None` | — | The panels are loaded dynamically, not imported |

### Presentation

| Dependency | Usage |
| --- | --- |
| `$lib/trace` | The composition tree and the DOM markers |
| Token domains: spacing, color, shape | Every dimension off the one spacing unit; surfaces and borders are role tokens |

**Deliberately not the panel vocabulary.** This page is scaffolding around the
vocabulary and is built from plain markup, because a reviewer looking at a
`PanelSelect` on the stage must never be unsure whether the control above it is
the same component being reviewed.

## Directory Documents

| Concern | Document | What it owns |
| --- | --- | --- |
| Components | [components.md](components/components.md) | The picker, the state editor, and the two ways of reading a composition |
| Shared | [shared.md](shared/shared.md) | The session: what is selected, what the doors answered |

## Rendered States

| State | Trigger | Visible result | Available recovery |
| --- | --- | --- | --- |
| Initial | The route rendered it | The first entry of the tree, its doors, its composition | — |
| Loading | A panel is being fetched | "Loading…" on the stage | — |
| Empty | A panel read no door | The state panel says so in a sentence | — |
| Stale | `None` | — | — |
| Failure | A panel's module failed to load | The error on the stage, in the danger role | Pick another |
| Denied | `None` | — | — |

## Accessibility

- **Landmark and accessible name:** the stage is the `main` landmark. The head
  and the composition column are `header` and `aside`.
- **Initial focus:** the document.
- **Keyboard model:** the picker is a native `select`, so its whole keyboard
  model is the platform's. Every disclosure in the composition column is a
  button with `aria-expanded`.
- **Announcements:** `None`.
- **Focus restoration:** none needed; nothing here opens or closes over the page.

The highlight that links a name on the right to what it drew on the left is a
pointer affordance and carries nothing. What it points at is already in the tree
as text.

## Layout and Overflow

- **Parent constraints:** it takes the viewport.
- **Responsive behavior:** the stage absorbs the change; the composition column
  holds its share of the split.
- **Scroll owner:** the head, the stage and the column, each for itself. The
  frame sets `overflow: hidden` so the page never scrolls as a whole.
- **Minimum and maximum geometry:** the head is capped at 45vh, because a door
  answering forty rows would otherwise push the panel off the bottom.

## View Invariants

- **The state is writable and the composition is not.** Everything in the column
  is derived from what is at the top; a second place to change it would be a
  second answer to what the panel is a function of.
- **An override never writes to the sample.** Two panels reading one door always
  agree, and *reset* is always available.
- **The stage is a real flank.** A context view and a lens render at 300px, which
  is the width they will have.
- **The trace is off unless this page is open.** `traceNode` finds no run in
  context anywhere else and returns immediately.

## Supporting Documents

| Document | Subject |
| --- | --- |
| [`$lib/trace/trace.svelte.ts`](../../trace/trace.svelte.ts) | How a primitive registers itself, and why props are a thunk |
| [`$mock-capabilities/read.svelte.ts`](../../mock-capabilities/read.svelte.ts) | How a door names itself, and why an override sits in front |
