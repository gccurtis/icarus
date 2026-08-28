# Inspector

Lives at `src/lib/views/inspector/inspector.md`. Trees live in the concern
documents linked below.

## Purpose

The lens. It answers "what is this selected thing?" for whatever the active tab
has under inspection.

It is a control surface rather than a mirror. What a user sets here is what the
editor applies next — that is why the model holds an inspection even when
nothing is selected, and why the nothing-inspected case is a named state rather
than an absent one.

## Boundary

This view owns:

- turning an inspection key into the path of a lens, and loading it;
- the nothing-inspected state, which is the panel at its most useful rather than
  its least;
- one scroll context.

It does not own:

- what is inspected. Only an explicit `inspect()` call sets that, never focus —
  clicking into this panel blurs the editor and collapses the caret, and an
  inspection derived from focus would empty the panel the user is reaching for.
- what a lens contains. Each of the lenses under `$lib/views/panels/inspector/` renders
  itself and is otherwise opaque to this view.
- its own width, or the bounds of a resize.

## Public Contract

- **Entry:** [`inspector.svelte`](inspector.svelte)
- **Types:** [`types.ts`](types.ts)

| Kind | Name | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| Export | `COLLAPSED_WIDTH` | `number` | — | What the flank narrows to when shut; the frame sizes the column from it |
| Export | `MIN_WIDTH` | `number` | — | Narrowest a drag may reach |
| Export | `MAX_WIDTH` | `number` | — | Widest |
| Export | `COLLAPSE_BELOW` | `number` | — | Drag inside this and the panel collapses instead of clamping |

It takes no props. Every number here is the panel's whole width — unlike the
context panel, the inspector has no rail to add back while open, so the model
stores exactly what is painted. The bounds deliberately match the context
panel's, so a user who learns one edge has learned the other.

## Dependencies

### Client models

| Door | Usage |
| --- | --- |
| `$model/client/view-state` | `inspected`, `frame`; calls `resize` |

### Capabilities

| Browser door | Usage |
| --- | --- |
| `None` | — |

### Composed views

| View | Root imported | Usage |
| --- | --- | --- |
| `None` | — | — |

### Presentation

| Dependency | Usage |
| --- | --- |
| Token domains: color, spacing, typography | Every value |

## Directory Documents

No concern directories. This view reads one key, resolves it to a path and
renders what it loads; there is no vocabulary to hold, nothing to coordinate and
nothing to observe.

## Rendered States

| State | Trigger | Visible result | Available recovery |
| --- | --- | --- | --- |
| Initial | A tab nobody has inspected in | "Nothing selected" | — |
| Lens | An `inspect()` call naming a key | That key's lens, about the selection beside it | — |
| Collapsed | A drag inside `COLLAPSE_BELOW` | A 44px rail carrying the panel glyph | Click the rail |
| Empty | `inspected` is `"empty"` | "Nothing selected" | — |
| Loading | A lens's chunk is in flight | Nothing, for one frame | — |
| Unresolved | A key that names no file | The key, named | — |
| Stale | `None` | — | — |
| Failure | `None` | — | — |
| Denied | `None` | — | — |

**An inspection lives on the tab, so switching tabs switches this panel** — and a
tab returned to still shows what was inspected in it. That is the model's doing,
not this view's: it reads `inspected` and re-renders.

Unresolved cannot be reached through the model, because the key type is generated
from the very tree the glob reads. It means the two have been allowed to
disagree, and naming the key is the only useful thing to show.

## Accessibility

- **Landmark and accessible name:** a `complementary` landmark named
  "Inspector".
- **Initial focus:** none taken. This panel is a place to work, so it must not
  trap focus when it gains controls.
- **Keyboard model:** none yet; nothing here is focusable.
- **Announcements:** `None` yet. What changes when an inspection changes is the
  whole panel, which will want a live region or an explicit focus move — decided
  with the first real inspection view.
- **Focus restoration:** focusing this panel must not destroy the selection that
  put something in it. That is what the selection surface token is held for.

## Layout and Overflow

- **Parent constraints:** fills the frame's right column, whose width the frame
  sets from the model.
- **Responsive behavior:** fixed width; the centre absorbs change.
- **Scroll owner:** itself, vertically.
- **Minimum and maximum geometry:** none enforced here. Bounds belong to the
  drag that enforces them.

## View Invariants

- **The registry is the filesystem.** A key is a path —
  `"collaboration.person"` is `inspector/collaboration/person.svelte` — so there
  is no map here to keep in step with the tree. A map would be a second list of
  what exists, and the first one is the directory.
- **A key is never a payload.** The key is a namespaced label and nothing more;
  what the lens is *about* is the selection the model carries beside it. A key
  holding `{ blockId, from, to }` would be a second record of what the user has
  selected, and two records of one thing disagree.
- **A lens's lifetime is its subject, not its key.** Two things of one kind open
  the same component, so a lens re-created only when the key changed would carry
  whatever it was holding for the reader — a half-written reply, an unsent
  Withdraw — onto the next thing and draw it as that thing's. A draft belongs to
  what it was written about.
- **A lens reads the selection itself; this view hands it nothing.** The lens is
  rendered with no props at all, so a lens that took its subject as a prop would
  be a lens permanently about whatever its default said — the panel would open on
  the right file and answer about the wrong thing. Each one reads
  `view.selection` and falls back to a literal only for the review page, which
  renders every lens with no model to read.
- **The kind that decides which lens opens is the caller's, not this view's.**
  Two rows of different kinds in the same table reach two different lenses, and
  what makes that so is the key the caller passed. Nothing here inspects the
  selection to choose.
- **Nothing selected is a state, not an absence.** It has a sentence of its own
  rather than rendering blank, because a blank flank reads as broken.
- **Collapsed is a rail, never nothing.** A flank that vanishes leaves no way
  back but finding a 4px edge. What remains is the same width the context panel
  collapses to, and the whole strip is the control rather than an icon sitting
  on one — 44px is narrow enough that a miss between icon and edge would read as
  the panel ignoring a click.
- **Collapsing never destroys the width**, for the same reason it does not on
  the other flank: the gesture reports the width it began with.
- **Nothing here writes an inspection.** This view reads. When it gains controls
  they act on the thing inspected, not on the inspection itself.

## Supporting Documents

| Document | Subject |
| --- | --- |
| `None` | — |
