# Copilot Bar

Lives at `src/lib/views/copilot-bar/copilot-bar.md`. Trees live in the concern
documents linked below.

## Purpose

A persistent place to describe the next move, anchored at the bottom of the work
surface. Not a help input and not a detached chat product: from anywhere real
work happens, a user can say what they want next, watch the result arrive in the
inspector, and carry on without leaving the surface they were on.

That is why it floats over the work rather than occupying a row of the frame — a
zone of its own would cost the work surface height it never gets back.

## Boundary

This view owns:

- the composer, its growth, and the bottom anchor that keeps submit where the
  hand left it;
- the mode and persona selectors;
- its own translucency, and what counts as being in use;
- the decision to open the inspector when the composer is engaged.

It does not own:

- what is inspected. It records `copilot`; the inspector decides what that looks
  like.
- the inspector's width. It opens a collapsed panel and leaves an open one at
  whatever width its user chose.
- anything the prompt does. No agent capability exists.

## Public Contract

- **Entry:** [`copilot-bar.svelte`](copilot-bar.svelte)
- **Types:** `None`

| Kind | Name | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| — | — | — | — | Nothing. It reads the workbench directly and is placed by the frame. |

## Dependencies

### Client models

| Door | Usage |
| --- | --- |
| `$model/client` | `currentInspection`, `panels.inspectorCollapsed`; calls `inspect` and `resize` |

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
| `@lucide/svelte` | The submit glyph |
| Token domains: color, spacing, shape, typography, motion | Every value |

## Directory Documents

No concern directories. The bar reads two values and calls two methods; there is
nothing to coordinate and nothing to observe.

## Rendered States

| State | Trigger | Visible result | Available recovery |
| --- | --- | --- | --- |
| Idle | Nothing engaged | Translucent, one composer line | — |
| Hovered | Pointer over the dock | Solid | — |
| Active | Composer focused, or the inspector showing `copilot` | Solid | — |
| Grown | Prompt past one line | Up to four lines, then it scrolls inside itself | — |
| Loading | `None` | — | — |
| Failure | `None` | — | — |

Submitting clears the prompt and activates the surface. Nothing is dispatched —
there is no agent capability — so a turn produces no reply, and the panel it
opens says so rather than pretending to wait.

## Accessibility

- **Landmark and accessible name:** a form labelled "Copilot". Not a landmark of
  its own; it lives inside the frame's `main`.
- **Initial focus:** none taken. A composer that grabbed focus on load would
  steal the first keystroke of every session.
- **Keyboard model:** tab order. Enter submits, Shift+Enter adds a line. Mode and
  persona are native selects, so they carry their own keyboard behaviour.
- **Announcements:** `None` yet. A reply arriving in the inspector needs one, and
  that belongs to the surface that renders replies.
- **Focus restoration:** focusing the bar must not destroy the selection that
  preceded it — an inspection is set only by an explicit call, never derived from
  focus, so the prior selection survives in the tab that owns it.

## Layout and Overflow

- **Parent constraints:** absolutely placed against the frame's work zone, which
  owns the position context. The scroll belongs to an inner element, so the bar
  does not slide away with the content it sits over.
- **Responsive behavior:** centred, growing to a measure limit rather than the
  full width.
- **Scroll owner:** the composer, past four lines.
- **Minimum and maximum geometry:** the bar starts at 48px and the composer stops
  growing at 88px.

## View Invariants

- **Opening and inspecting are two calls, not one.** `inspect()` records what the
  user is looking at and nothing else; a model method that also moved panels
  would make every future caller of `inspect()` a layout change. The bar wants
  both, so the bar asks for both.
- **It opens a collapsed panel and never resizes an open one.** A composer that
  resized the inspector each time it took focus would be fighting its user.
- **The translucent gutter is not hit-testable.** Only the bar takes pointer
  events, so the space around it belongs to the work underneath.
- **Mode and persona are local state.** Neither survives a reload, and neither
  should until something can act on them — a mode nobody dispatches on is a
  label, and persisting a label costs a storage version.

## Supporting Documents

| Document | Subject |
| --- | --- |
| `None` | — |
