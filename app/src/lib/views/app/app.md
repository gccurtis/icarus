# App

Lives at `src/lib/views/app/app.md`. Trees live in the concern documents linked
below.

## Purpose

The application frame: six zones in one grid, rendered by `/app/[project]` once
its client instance exists. It is what a user sees for the whole life of that
instance — nothing above it changes on navigation, and nothing below it is
reached except through it.

## Boundary

This view owns:

- the grid: which zones exist, where each sits, and what the viewport belongs to;
- the frame's own dimensions — the two bar heights and the status height;
- placement of every zone, so no zone declares a position in a grid it does not
  own;
- the two flank widths, read from the active tab and applied as column sizes;
- the top bar and the status bar, which read nothing and are components here.

It does not own:

- the client instance. The route above builds it; this view reads it.
- anything a zone renders. Each zone view is reached through its root and is
  otherwise opaque.
- what fills the centre. The workspace resolves that from the active tab.
- the rail's width, which belongs to the context panel and is imported from it.

## Public Contract

- **Entry:** [`app.svelte`](app.svelte)
- **Types:** `None`

| Kind | Name | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| — | — | — | — | Nothing. The frame takes no props and no `children`: tabs are workbench state, so there is no route content to thread through it. |

## Dependencies

### Client models

| Door | Usage |
| --- | --- |
| `$model/client` | `workbench.panels`, for the two flank column widths |

### Capabilities

| Browser door | Usage |
| --- | --- |
| `None` | — |

### Composed views

Views reached through their root component only.

| View | Root imported | Usage |
| --- | --- | --- |
| `tab-bar` | `tab-bar.svelte` | What is open and which one is active |
| `context-panel` | `context-panel.svelte`, `types.ts` | The left flank; `types.ts` for the rail width the column math needs |
| `inspector` | `inspector.svelte`, `types.ts` | The right flank; `types.ts` for the width it collapses to |
| `workspace` | `workspace.svelte` | The centre |
| `copilot-bar` | `copilot-bar.svelte` | Floats over the centre, bottom-anchored |

### Presentation

| Dependency | Usage |
| --- | --- |
| Token domains: spacing, color | Every dimension is a multiple of the one spacing unit; surfaces and borders are role tokens |

## Directory Documents

| Concern | Document | What it owns |
| --- | --- | --- |
| Components | [components.md](components/components.md) | The two zones that read nothing yet |

## Rendered States

| State | Trigger | Visible result | Available recovery |
| --- | --- | --- | --- |
| Initial | The route rendered it | All six zones, painted | — |
| Loading | `None` | — | — |
| Empty | `None` | — | — |
| Stale | `None` | — | — |
| Failure | `None` | — | — |
| Denied | `None` | — | — |

The frame has one state. It reads two numbers that always resolve — the model
falls back to frozen defaults for a tab nobody dragged — so there is no moment
at which it has nothing to paint.

## Accessibility

- **Landmark and accessible name:** the centre is the `main` landmark. Each
  flank names itself; the frame itself is not a landmark.
- **Initial focus:** the document. The frame moves focus nowhere.
- **Keyboard model:** none of its own. Tab order follows the visual order the
  grid areas declare, which is why placement lives here rather than in the zones.
- **Announcements:** `None`.
- **Focus restoration:** `None` — nothing here opens or closes.

## Layout and Overflow

- **Parent constraints:** it takes the viewport. The route renders nothing
  around it.
- **Responsive behavior:** the centre absorbs every change in width; the flanks
  and bars hold their sizes.
- **Scroll owner:** every zone, for itself. The frame sets `overflow: hidden` so
  the page as a whole never scrolls — a document that scrolls behind a fixed
  frame is how a work surface loses its position.
- **Minimum and maximum geometry:** none enforced here. Bounds on a flank belong
  to the panel that enforces the drag, which does not exist yet.

## View Invariants

- **Every zone is placed by this view.** A zone view that declared its own
  `grid-area` could not be rendered anywhere else, which would undo the reason
  it was promoted.
- **The frame owns the viewport and nothing else does.** Exactly one element
  is `100vh`; a second would produce two scroll contexts stacked on each other.
- **A flank's width has one source.** The model holds it, this view applies it,
  and the stylesheet carries seeds that matter only if the model read fails.
- **The grid always has three columns.** A collapsed flank narrows to a rail
  rather than disappearing, so the work surface never reflows between a
  two-column and a three-column layout, and each flank keeps something on screen
  to reopen it with.

## Supporting Documents

| Document | Subject |
| --- | --- |
| `None` | — |
