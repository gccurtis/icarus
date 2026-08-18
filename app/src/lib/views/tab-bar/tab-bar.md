# Tab Bar

Lives at `src/lib/views/tab-bar/tab-bar.md`. Trees live in the concern documents
linked below.

## Purpose

Which objects are open, and which one is active. It renders the workbench's tab
list and reports two intents back to it — activate this one, close that one.

It sits in the frame rather than in a route because tabs are workbench state and
not route state: opening a tab is not a navigation, closing one does not go
back, and no arrangement of URL segments describes a set of open objects with an
order.

## Boundary

This view owns:

- how a tab looks, including which cues say "active";
- display copy — the label and icon — for every screen kind a tab can hold. A
  label is a function of the whole resource rather than of its kind alone, or
  every document tab would read "Document", which is the one thing a tab strip
  exists to prevent;
- the rule that a singleton shows no close affordance.

It does not own:

- the tab list, its order, or which tab is active. All three are model state.
- what happens after a close. The model chooses the next active tab.
- what a screen kind *renders as*. That map belongs to the workspace.

## Public Contract

- **Entry:** [`tab-bar.svelte`](tab-bar.svelte)
- **Types:** `None`

| Kind | Name | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| — | — | — | — | Nothing. It reads the workbench directly, so a parent has nothing to hand it. |

## Dependencies

### Client models

| Door | Usage |
| --- | --- |
| `$model/client` | `workbench.tabs`, `activeId`; calls `activate` and `close` |

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
| `@lucide/svelte` | One icon per screen kind, plus the close glyph |
| Token domains: color, spacing, typography, shape | Every value |

## Directory Documents

No concern directories. The two intents are direct model calls with nothing to
coordinate — no optimistic update, no recovery, no capability — so they stay in
the component. `interactions/` arrives with the reorder drag, which has a
gesture, bounds, and a keyboard equivalent to own.

## Rendered States

| State | Trigger | Visible result | Available recovery |
| --- | --- | --- | --- |
| Initial | Always | At least one tab, one of them active | — |
| Several | A resource was opened | One tab per open resource; only transient ones show a close control | Closing returns to a neighbour |
| Loading | `None` | — | — |
| Empty | `None` | — | — |
| Stale | `None` | — | — |
| Failure | `None` | — | — |
| Denied | `None` | — | — |

There is no empty state, and that is a model invariant rather than an omission:
a singleton cannot be closed, so something is always open and `activeId`
always names a real tab.

## Accessibility

- **Landmark and accessible name:** none. It is a control strip inside the
  frame, not a landmark of its own.
- **Initial focus:** none taken.
- **Keyboard model:** tab order only. Each tab and each close button is an
  ordinary button reachable in sequence.
- **Announcements:** the active tab carries `aria-current`; the close button
  names the resource it closes.
- **Focus restoration:** `None` yet. Closing a focused tab currently drops focus
  to the document, which is the gap to fix when close gains a keyboard path.

**Not an ARIA tablist.** That pattern owes a `tabpanel` relationship and roving
tabindex, and an element carrying `role="tab"` may not contain a second
focusable control — which a close button is. Claiming the roles without the
behaviour would promise arrow-key traversal that does not exist. `aria-current`
describes what is actually implemented.

## Layout and Overflow

- **Parent constraints:** fills the frame's tab row, whose height the frame
  declares.
- **Responsive behavior:** tabs keep their width and run off the end rather than
  compressing to illegibility.
- **Scroll owner:** itself, horizontally. It is the only zone that scrolls on
  that axis.
- **Minimum and maximum geometry:** targets clear the 24px minimum on both axes
  at the row's declared height.

## View Invariants

- **A singleton never shows a close control.** `close()` throws for one, so
  offering it would be offering a crash — a correctness requirement, not a
  nicety.
- **Which tab is active never rides on colour alone.** The tint is paired with
  an underline on the shared edge and with `aria-current`.
- **The resource map is total.** `Record<ScreenKind, …>` means a new kind
  fails to compile until it has a label and an icon.

## Supporting Documents

| Document | Subject |
| --- | --- |
| `None` | — |
