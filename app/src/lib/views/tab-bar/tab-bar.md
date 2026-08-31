# Tab Bar

Lives at `src/lib/views/tab-bar/tab-bar.md`. Trees live in the concern documents
linked below.

## Purpose

Which objects are open, and which one is active. It renders view state's tab list
and reports two intents back to it — activate this one, close that one.

It sits in the frame rather than in a route because tabs are view state and not
route state: opening a tab is not a navigation, closing one does not go back, and
no arrangement of URL segments describes a set of open objects with an order.

## Boundary

This view owns:

- how a tab looks, including which cues say "active";
- the division between the permanent tabs and the tabs a person opened;
- display copy — the label and icon — for every screen a tab can hold. A label is
  a function of the whole tab rather than of its screen alone, or every document
  tab would read "Document", which is the one thing a tab strip exists to
  prevent;
- the rule that a permanent tab shows no close affordance.

It does not own:

- the tab list, its order, or which tab is active. All three are model state.
- what happens after a close. The model chooses the next active tab.
- what a screen *renders as*. A screen names the path of its own centre, and the
  workspace loads it.

## Public Contract

- **Entry:** [`tab-bar.svelte`](tab-bar.svelte)
- **Types:** `None`

| Kind | Name | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| — | — | — | — | Nothing. It reads view state directly, so a parent has nothing to hand it. |

## Dependencies

### Client models

| Model | Usage |
| --- | --- |
| `$model/client/view-state` | `tabs`, `activeId`, `isSingleton`; calls `activate` and `close` |

### Capabilities

| Capability | Usage |
| --- | --- |
| `$capabilities/store` | `nameOf` — what the thing a tab holds is called |

### Composed views

| View | Root imported | Usage |
| --- | --- | --- |
| `None` | — | — |

### Presentation

| Dependency | Usage |
| --- | --- |
| `@lucide/svelte` | One icon per screen, plus the close glyph |
| Token domains: color, spacing, typography, shape | Every value |

## Directory Documents

| Concern | Document | What it owns |
| --- | --- | --- |
| Procedures | [procedures.md](procedures/procedures.md) | What a tab is called and what it looks like |

No other concern directory. The two intents are direct model calls with nothing
to coordinate — no optimistic update, no recovery, no capability — so they stay
in the component. `interactions/` arrives with the reorder drag, which has a
gesture, bounds, and a keyboard equivalent to own.

## Rendered States

| State | Trigger | Visible result | Available recovery |
| --- | --- | --- | --- |
| Initial | Always | The permanent tabs, icon-only, one of them active | — |
| Several | Something was opened | A divider, then one tab per opened thing; only those show a close control | Closing returns to a neighbour |
| Loading | A name has not arrived | The tab reads `…` | The name replaces it in place |
| Empty | `None` | — | — |
| Stale | `None` | — | — |
| Failure | The store answered with no name | The tab reads `Disconnected` | None here. The reference is broken, not slow |
| Denied | `None` | — | — |

There is no empty state, and that is a model invariant rather than an omission: a
permanent tab cannot be closed, so something is always open and `activeId` always
names a real tab.

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

- **A permanent tab never shows a close control.** `close()` throws for one, so
  offering it would be offering a crash — a correctness requirement, not a
  nicety.
- **Which tab is active never rides on colour alone.** The tint is paired with
  an underline on the shared edge and with `aria-current`.
- **The screen map is total.** `Record<Screen, ScreenEntry>` means a new screen
  fails to compile until it has a label and an icon.

## Supporting Documents

| Document | Subject |
| --- | --- |
| `None` | — |
