# Context Panel

Lives at `src/lib/views/context-panel/context-panel.md`. Trees live in the
concern documents linked below.

## Purpose

The map. It answers "where am I, and what else is here?" — a fixed rail of
contexts on the inline edge, and whatever the chosen one shows beside it.

A **context** is a way of looking at what surrounds the active resource: its
outline, what it relates to, who commented on it. Never a mode of working. That
distinction is the whole reason for the name — a rail entry here answers "what
else is here?", where an activity bar's entry would answer "what am I doing?".

## Boundary

This view owns:

- the rail and its content, and the division between them;
- what each context id renders as, and its display copy;
- the rail's width, which is structural and never resizes — exported from
  [`types.ts`](types.ts) because the frame's column math needs it;
- one scroll context, in the content half.

It does not own:

- which contexts exist, which are offered, or which is selected. The model
  decides all three from the active tab's resource kind.
- the panel's total width. That is a column in the frame, sized from the model.
- the bounds of a resize. Values are the model's, bounds belong to the drag that
  does not exist yet.

## Public Contract

- **Entry:** [`context-panel.svelte`](context-panel.svelte)
- **Types:** [`types.ts`](types.ts)

| Kind | Name | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| Export | `RAIL_WIDTH` | `number` | — | Pixels. The frame adds it to the model's content width to size this whole column. |

It takes no props. `RAIL_WIDTH` is the contract, and it exists because the
panel's width is decided in two places that must agree: the model deliberately
stores the content portion only, so whoever lays the column out has to add the
rail back.

## Dependencies

### Client models

| Door | Usage |
| --- | --- |
| `$model/client` | `workbench.availableContexts`, `activeContext`, `active.resource`; calls `selectContext` |

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
| `@lucide/svelte` | One icon per context |
| Token domains: color, spacing, shape, typography | Every value |

## Directory Documents

| Concern | Document | What it owns |
| --- | --- | --- |
| Components | [components.md](components/components.md) | The rail, the context content, and the key map between them |

## Rendered States

| State | Trigger | Visible result | Available recovery |
| --- | --- | --- | --- |
| Initial | Always | The rail, one entry selected, and that entry's content | — |
| Loading | `None` | — | — |
| Empty | `None` | — | — |
| Stale | `None` | — | — |
| Failure | `None` | — | — |
| Denied | `None` | — | — |

No unknown-context state. The model guarantees `activeContext` is one the active
tab's kind offers, falling back to that kind's default when a stored id no longer
resolves, so there is no branch here for a key that does not map.

**What the rail offers changes with the active tab**, because
`CONTEXTS_BY_KIND` is keyed by resource kind. A `project-overview` tab offers one
entry; a `document` offers two. That is the most visible proof that this panel is
a projection over the workbench rather than a surface holding its own state.

## Accessibility

- **Landmark and accessible name:** a `complementary` landmark named "Context".
- **Initial focus:** none taken.
- **Keyboard model:** tab order only. Each rail entry is an ordinary button.
  Arrow-key traversal along the rail is the obvious next step and is not built.
- **Announcements:** the selected entry carries `aria-current`; each entry is
  labelled with its context name, since the control shows only an icon.
- **Focus restoration:** `None` — selecting a context replaces the content beside
  the rail and leaves focus on the rail.

## Layout and Overflow

- **Parent constraints:** fills the frame's left column, whose width the frame
  sets from the model.
- **Responsive behavior:** the rail holds `RAIL_WIDTH`; the content half absorbs
  every change.
- **Scroll owner:** the content half, vertically. The rail never scrolls, so
  there is exactly one scroll context here — nesting a second inside a panel
  makes a scroll position unrecoverable.
- **Minimum and maximum geometry:** rail entries clear the 24px minimum target.
  Bounds on the panel's width belong to the drag that enforces them.

## View Invariants

- **The rail decides and the content displays.** They are split so the two can
  be reasoned about separately, and the rail reports a choice rather than
  resolving one.
- **Selection never rides on colour alone.** The tint is paired with a marker on
  the inline edge and with `aria-current`.
- **The context map is total.** `Record<ContextId, …>` means a new context fails
  to compile until it has a label, an icon, and something to show.
- **The rail is one number.** `RAIL_WIDTH` sizes the rail and is what the frame
  adds to the model's content width; nothing restates it.

## Supporting Documents

| Document | Subject |
| --- | --- |
| `None` | — |
