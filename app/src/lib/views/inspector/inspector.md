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

- what each inspection looks like, once there is one to show;
- the nothing-inspected state, which is the panel at its most useful rather than
  its least;
- one scroll context.

It does not own:

- what is inspected. Only an explicit `inspect()` call sets that, never focus —
  clicking into this panel blurs the editor and collapses the caret, and an
  inspection derived from focus would empty the panel the user is reaching for.
- the ancestry above the innermost node, which the model holds and this view
  does not yet offer a way to walk.
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
| `$model/client` | `workbench.inspectedNode` |

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

| Concern | Document | What it owns |
| --- | --- | --- |
| Components | [components.md](components/components.md) | One component per inspection kind that has a view, and the partial map between them |

No other concern directory. This view reads one value and renders it; there is
nothing to coordinate and nothing to observe.

## Rendered States

| State | Trigger | Visible result | Available recovery |
| --- | --- | --- | --- |
| Initial | A tab nobody has inspected in | Nothing selected | — |
| Collapsed | A drag inside `COLLAPSE_BELOW` | A 44px rail carrying the agent icon | Click the rail |
| Loading | `None` | — | — |
| Empty | `inspectedNode` is undefined | "Nothing selected" | — |
| Stale | `None` | — | — |
| Failure | `None` | — | — |
| Denied | `None` | — | — |
| Selection | A drag inside a document block | The block and its offsets | — |
| Caret | A click inside a document block | The block | — |
| Unmapped | An inspection whose kind has no view | The kind, named | — |

**An inspection lives on the tab, so switching tabs switches this panel** — and
a tab returned to still shows what was inspected in it. That is the model's
doing, not this view's: it reads `inspectedNode` and re-renders.

The last three states are reachable only through the workspace's document
component, which is the one caller of `inspect()` in the application. It is a
fixture, so the two mapped states are proof that the path works rather than
finished surface.

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

- **The kind map is partial, deliberately.** `InspectionKey` names six kinds;
  two are built, because two are all any surface can currently produce.
  Components for the rest would be files nothing can reach. Each new producer
  brings the view its node needs.
- **A node is never a payload.** The model hands over ids and offsets, and this
  view fetches whatever it needs from them. Carrying content would put a copy of
  something that lives elsewhere into state that is deliberately not persisted.
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
